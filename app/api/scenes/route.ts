import { NextRequest, NextResponse } from 'next/server';
import { detectScenes } from '@/lib/scene-detection';
import { getFileMetadata } from '@/lib/storage';
import { generateExcelFile } from '@/lib/excel-generator';
import { promises as fs } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// ===== Sequential Processing Queue =====
// Only one video processes at a time (GPU can't handle parallel model loads).
// Uses globalThis to survive Next.js HMR module reloads in dev mode.
interface QueueItem {
  uploadId: string;
  metadataPath: string;
  videoPath: string;
}

interface QueueState {
  queue: QueueItem[];
  processing: string | null;
}

// ===== Persistent Python Worker =====
// The Python process loads the model once (~90s) and stays alive.
// Node.js sends metadata paths via stdin; Python sends DONE via stdout.
interface PythonWorker {
  process: ChildProcess;
  ready: Promise<void>;
  alive: boolean;
  currentResolve: ((data?: any) => void) | null;
  currentReject: ((err: Error) => void) | null;
  stdoutBuffer: string;
}

const g = globalThis as unknown as {
  __shotlisterQueue?: QueueState;
  __shotlisterPython?: PythonWorker | null;
};
if (!g.__shotlisterQueue) {
  g.__shotlisterQueue = { queue: [], processing: null };
}
if (g.__shotlisterPython === undefined) {
  g.__shotlisterPython = null;
}

// ===== Config =====

async function getConfig(): Promise<{ useCuda: boolean; vlmModel: string; sceneDetector: string }> {
  const configPath = path.join(process.cwd(), 'shotlister.config.json');
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { useCuda: true, vlmModel: 'HuggingFaceTB/SmolVLM2-500M-Video-Instruct', sceneDetector: 'pyscenedetect' };
  }
}

// ===== Python Worker Management =====

function getOrCreatePythonWorker(): Promise<PythonWorker> {
  if (g.__shotlisterPython?.alive) {
    return g.__shotlisterPython.ready.then(() => g.__shotlisterPython!);
  }

  const scriptPath = path.join(process.cwd(), 'scripts', 'process_scene_queue.py');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  console.log('[Python Worker] Starting persistent Python process...');

  const proc = spawn(pythonCmd, [scriptPath, '--persistent'], {
    stdio: ['pipe', 'pipe', 'inherit'] // stdin: pipe (send paths), stdout: pipe (READY/DONE), stderr: inherit (logging)
  });

  let readyResolve: () => void;
  let readyReject: (err: Error) => void;

  const worker: PythonWorker = {
    process: proc,
    ready: undefined as unknown as Promise<void>,
    alive: true,
    currentResolve: null,
    currentReject: null,
    stdoutBuffer: '',
  };

  worker.ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  proc.stdout!.on('data', (chunk: Buffer) => {
    worker.stdoutBuffer += chunk.toString();
    const lines = worker.stdoutBuffer.split('\n');
    worker.stdoutBuffer = lines.pop()!; // keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'READY') {
        console.log('[Python Worker] Model loaded and ready');
        readyResolve();
      } else if (trimmed.startsWith('DETECT_DONE|')) {
        const json = trimmed.substring('DETECT_DONE|'.length);
        try {
          const scenes = JSON.parse(json);
          if (worker.currentResolve) {
            const cb = worker.currentResolve;
            worker.currentResolve = null;
            worker.currentReject = null;
            cb(scenes);
          }
        } catch (e) {
          console.error('[Python Worker] Failed to parse DETECT_DONE JSON:', e);
          if (worker.currentReject) {
            const cb = worker.currentReject;
            worker.currentResolve = null;
            worker.currentReject = null;
            cb(new Error('Failed to parse scene detection results'));
          }
        }
      } else if (trimmed.startsWith('DONE:')) {
        if (worker.currentResolve) {
          const cb = worker.currentResolve;
          worker.currentResolve = null;
          worker.currentReject = null;
          cb();
        }
      }
    }
  });

  proc.on('exit', (code) => {
    console.log(`[Python Worker] Process exited with code ${code}`);
    worker.alive = false;
    // Reject pending work
    if (worker.currentReject) {
      const cb = worker.currentReject;
      worker.currentResolve = null;
      worker.currentReject = null;
      cb(new Error(`Python process exited with code ${code}`));
    }
    // If model never loaded, reject the ready promise (no-op if already resolved)
    readyReject(new Error(`Python process exited with code ${code} before model loaded`));
    g.__shotlisterPython = null;
  });

  proc.on('error', (err) => {
    console.error('[Python Worker] Process error:', err);
    worker.alive = false;
    if (worker.currentReject) {
      const cb = worker.currentReject;
      worker.currentResolve = null;
      worker.currentReject = null;
      cb(err);
    }
    readyReject(err);
    g.__shotlisterPython = null;
  });

  g.__shotlisterPython = worker;

  return worker.ready.then(() => worker);
}

async function processSceneDescriptions(metadataPath: string): Promise<void> {
  const worker = await getOrCreatePythonWorker();

  return new Promise<void>((resolve, reject) => {
    worker.currentResolve = resolve;
    worker.currentReject = reject;
    worker.process.stdin!.write(metadataPath + '\n');
  });
}

async function detectScenesWithWorker(videoPath: string, uploadId: string, outputDir: string): Promise<any[]> {
  const worker = await getOrCreatePythonWorker();

  return new Promise<any[]>((resolve, reject) => {
    worker.currentResolve = (data?: any) => resolve(data || []);
    worker.currentReject = reject;
    worker.process.stdin!.write(`DETECT|${videoPath}|${uploadId}|${outputDir}\n`);
  });
}

// ===== Processing Queue =====

function enqueueForProcessing(item: QueueItem) {
  const state = g.__shotlisterQueue!;

  // Prevent duplicate enqueuing (React Strict Mode fires effects twice in dev)
  if (state.processing === item.uploadId || state.queue.some(q => q.uploadId === item.uploadId)) {
    console.log(`[Queue] ${item.uploadId} already queued/processing, skipping duplicate`);
    return;
  }

  state.queue.push(item);
  console.log(`[Queue] Added ${item.uploadId} to queue (position ${state.queue.length}, currently processing: ${state.processing ?? 'none'})`);
  processNextInQueue();
}

async function processNextInQueue() {
  const state = g.__shotlisterQueue!;
  if (state.processing || state.queue.length === 0) return;

  const item = state.queue.shift()!;
  state.processing = item.uploadId;
  console.log(`[Queue] Starting processing for ${item.uploadId} (${state.queue.length} remaining in queue)`);

  // Update metadata: mark as no longer queued
  try {
    const data = await fs.readFile(item.metadataPath, 'utf-8');
    const metadata = JSON.parse(data);
    metadata.queued = false;
    await fs.writeFile(item.metadataPath, JSON.stringify(metadata, null, 2));
  } catch (err) {
    console.error(`[Queue] Failed to update metadata for ${item.uploadId}:`, err);
  }

  try {
    // Step 1: Detect scenes (choose method based on config)
    const config = await getConfig();
    console.log(`[Queue] Detecting scenes for ${item.uploadId} using ${config.sceneDetector}...`);

    let scenes;
    if (config.sceneDetector === 'transnetv2') {
      const outputDir = path.dirname(item.metadataPath);
      scenes = await detectScenesWithWorker(item.videoPath, item.uploadId, outputDir);
    } else {
      scenes = await detectScenes(item.videoPath, item.uploadId);
    }

    // Update metadata with detected scenes
    const data = await fs.readFile(item.metadataPath, 'utf-8');
    const metadata = JSON.parse(data);
    metadata.scenes = scenes;
    await fs.writeFile(item.metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`[Queue] Detected ${scenes.length} scenes for ${item.uploadId}`);

    if (scenes.length > 0) {
      // Step 2: AI descriptions (persistent Python worker)
      console.log(`\n========================================`);
      console.log(`Processing ${scenes.length} scenes for ${item.uploadId}...`);
      console.log(`========================================\n`);

      await processSceneDescriptions(item.metadataPath);

      // Step 3: Generate Excel
      console.log(`\n========================================`);
      console.log(`Generating Excel file for ${item.uploadId}...`);
      console.log(`========================================\n`);

      const updatedContent = await fs.readFile(item.metadataPath, 'utf-8');
      const updatedMetadata = JSON.parse(updatedContent);
      const scenesDir = path.dirname(item.metadataPath);

      await generateExcelFile(item.uploadId, updatedMetadata.scenes || [], scenesDir);

      updatedMetadata.excelGenerated = true;
      await fs.writeFile(item.metadataPath, JSON.stringify(updatedMetadata, null, 2));
      console.log('✓ Excel file generated successfully');
    } else {
      // No scenes found — mark as complete
      metadata.descriptionsComplete = true;
      metadata.excelGenerated = true;
      await fs.writeFile(item.metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`[Queue] No scenes found for ${item.uploadId}, marked complete`);
    }
  } catch (err) {
    console.error(`[Queue] Processing failed for ${item.uploadId}:`, err);
  }

  state.processing = null;
  console.log(`[Queue] Finished processing ${item.uploadId}`);
  processNextInQueue();
}

export async function POST(req: NextRequest) {
  try {
    const { uploadId } = await req.json();

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      );
    }

    // Get the uploaded file metadata
    const metadata = await getFileMetadata(uploadId);

    if (!metadata) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Check if already processing/queued (e.g. user refreshed the page)
    const scenesMetadataPath = path.join(
      process.cwd(),
      'uploads',
      'scenes',
      uploadId,
      'metadata.json'
    );

    try {
      const existingData = await fs.readFile(scenesMetadataPath, 'utf-8');
      const existingMeta = JSON.parse(existingData);
      if (!existingMeta.descriptionsComplete || !existingMeta.excelGenerated) {
        // Already in progress — don't re-enqueue
        return NextResponse.json({
          success: true,
          sceneCount: existingMeta.scenes?.length || 0,
          scenes: existingMeta.scenes || [],
          descriptionsInProgress: true,
        });
      }
    } catch {
      // No metadata file yet — proceed with enqueueing
    }

    // Create scenes directory and initial metadata
    await fs.mkdir(path.dirname(scenesMetadataPath), { recursive: true });

    await fs.writeFile(
      scenesMetadataPath,
      JSON.stringify({
        uploadId,
        scenes: [],
        descriptionsComplete: false,
        processingIndex: -1,
        progress: 0,
        excelGenerated: false,
        queued: true,
      }, null, 2)
    );

    // Enqueue the full pipeline (scene detection + AI + Excel)
    console.log(`Enqueuing full processing pipeline for: ${metadata.filename}`);
    enqueueForProcessing({ uploadId, metadataPath: scenesMetadataPath, videoPath: metadata.path });

    // Return immediately — polling will pick up progress
    return NextResponse.json({
      success: true,
      sceneCount: 0,
      scenes: [],
      descriptionsInProgress: true,
    });
  } catch (error) {
    console.error('Scene detection error:', error);
    return NextResponse.json(
      { error: 'Scene detection failed', message: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { uploadId, videoTitle, videoDescription } = await req.json();

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      );
    }

    const scenesMetadataPath = path.join(
      process.cwd(),
      'uploads',
      'scenes',
      uploadId,
      'metadata.json'
    );

    try {
      const data = await fs.readFile(scenesMetadataPath, 'utf-8');
      const metadata = JSON.parse(data);

      if (videoTitle !== undefined) metadata.videoTitle = videoTitle;
      if (videoDescription !== undefined) metadata.videoDescription = videoDescription;

      await fs.writeFile(scenesMetadataPath, JSON.stringify(metadata, null, 2));

      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json(
        { error: 'Metadata not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error updating metadata:', error);
    return NextResponse.json(
      { error: 'Failed to update metadata', message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get('uploadId');

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      );
    }

    // Try to read existing scenes metadata
    const scenesMetadataPath = path.join(
      process.cwd(),
      'uploads',
      'scenes',
      uploadId,
      'metadata.json'
    );

    try {
      const data = await fs.readFile(scenesMetadataPath, 'utf-8');
      const metadata = JSON.parse(data);

      // Return all metadata including progress info
      return NextResponse.json({
        uploadId: metadata.uploadId,
        scenes: metadata.scenes || [],
        descriptionsComplete: metadata.descriptionsComplete ?? true,
        progress: metadata.progress ?? 100,
        processingIndex: metadata.processingIndex ?? -1,
        excelGenerated: metadata.excelGenerated ?? false,
        queued: metadata.queued ?? false,
        videoTitle: metadata.videoTitle ?? '',
        videoDescription: metadata.videoDescription ?? '',
      });
    } catch (error) {
      // No scenes detected yet
      return NextResponse.json({
        uploadId,
        scenes: [],
        descriptionsComplete: true,
        progress: 0,
      });
    }
  } catch (error) {
    console.error('Error fetching scenes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scenes', message: String(error) },
      { status: 500 }
    );
  }
}
