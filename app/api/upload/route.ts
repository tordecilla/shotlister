import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, rm, access } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { saveFileMetadata, listUploads, getFileMetadata, deleteFileMetadata } from '@/lib/storage';
import { isValidVideoType } from '@/lib/upload-config';

const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || './uploads');

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureUploadDir();

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isValidVideoType(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only video files are allowed.` },
        { status: 400 }
      );
    }

    // Generate unique ID for the upload
    const uploadId = randomUUID();
    const filename = file.name;
    const fileExt = path.extname(filename); // Preserve file extension
    const filepath = path.join(uploadDir, `${uploadId}${fileExt}`);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(filepath, buffer);

    // Save metadata
    await saveFileMetadata({
      id: uploadId,
      filename,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      path: filepath,
    });

    console.log(`Upload completed: ${filename} (${uploadId})`);

    return NextResponse.json({
      success: true,
      uploadId,
      filename,
      size: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const uploads = await listUploads();

    // Enrich each upload with scene status
    const enriched = await Promise.all(
      uploads.map(async (upload) => {
        let status = 'Uploaded';
        let sceneCount = 0;
        let videoTitle = '';
        let videoDescription = '';
        let excelGenerated = false;
        let videoDeleted = false;

        // Check if video file still exists
        try {
          await access(upload.path);
        } catch {
          videoDeleted = true;
        }

        try {
          const scenesMetadataPath = path.join(
            process.cwd(), 'uploads', 'scenes', upload.id, 'metadata.json'
          );
          const data = await readFile(scenesMetadataPath, 'utf-8');
          const meta = JSON.parse(data);

          sceneCount = meta.scenes?.length ?? 0;
          videoTitle = meta.videoTitle ?? '';
          videoDescription = meta.videoDescription ?? '';
          excelGenerated = meta.excelGenerated ?? false;

          if (meta.descriptionsComplete && excelGenerated) {
            status = 'Complete';
          } else if (meta.descriptionsComplete) {
            status = 'Generating Excel';
          } else if ((meta.processingIndex ?? -1) >= 0) {
            status = 'Generating Descriptions';
          } else if (meta.queued) {
            status = 'Queued';
          } else if (sceneCount > 0) {
            status = 'Loading Model';
          } else {
            status = 'Detecting Scenes';
          }
        } catch {
          // No scenes metadata yet
        }

        return {
          id: upload.id,
          filename: upload.filename,
          size: upload.size,
          uploadedAt: upload.uploadedAt,
          videoTitle,
          videoDescription,
          sceneCount,
          status,
          excelGenerated,
          videoDeleted,
        };
      })
    );

    return NextResponse.json(enriched.reverse());
  } catch (error) {
    console.error('Error listing uploads:', error);
    return NextResponse.json(
      { error: 'Failed to list uploads', message: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const mode = searchParams.get('mode'); // 'video' or 'all'

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (mode !== 'video' && mode !== 'all') {
      return NextResponse.json({ error: 'Mode must be "video" or "all"' }, { status: 400 });
    }

    const metadata = await getFileMetadata(id);
    if (!metadata) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    // Prevent deletion of uploads that are currently being processed
    try {
      const scenesMetadataPath = path.join(
        process.cwd(), 'uploads', 'scenes', id, 'metadata.json'
      );
      const sceneData = await readFile(scenesMetadataPath, 'utf-8');
      const sceneMeta = JSON.parse(sceneData);

      const isActive = sceneMeta.queued ||
        (!sceneMeta.descriptionsComplete && (sceneMeta.scenes?.length ?? 0) > 0) ||
        (sceneMeta.descriptionsComplete && !sceneMeta.excelGenerated);

      if (isActive) {
        return NextResponse.json(
          { error: 'Cannot delete while processing is in progress. Wait until processing is complete.' },
          { status: 409 }
        );
      }
    } catch {
      // No scenes metadata = just uploaded, can delete
    }

    // Delete the video file
    try {
      await access(metadata.path);
      await rm(metadata.path);
      console.log(`Deleted video file: ${metadata.path}`);
    } catch {
      // File may already be deleted
    }

    if (mode === 'all') {
      // Delete scenes directory (screenshots, metadata, Excel)
      const scenesDir = path.join(process.cwd(), 'uploads', 'scenes', id);
      try {
        await rm(scenesDir, { recursive: true });
        console.log(`Deleted scenes directory: ${scenesDir}`);
      } catch {
        // Directory may not exist
      }

      // Remove from upload metadata
      await deleteFileMetadata(id);
      console.log(`Deleted upload metadata for: ${id}`);

      return NextResponse.json({ success: true, deleted: 'all' });
    }

    // mode === 'video': just the video file was deleted
    return NextResponse.json({ success: true, deleted: 'video' });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Delete failed', message: String(error) },
      { status: 500 }
    );
  }
}

// Body size is handled by Next.js config in next.config.js
