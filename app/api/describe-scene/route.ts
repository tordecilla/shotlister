import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { screenshotPath, uploadId } = await req.json();

    if (!screenshotPath || !uploadId) {
      return NextResponse.json(
        { error: 'Screenshot path and upload ID are required' },
        { status: 400 }
      );
    }

    // Get the screenshot file path
    const filename = screenshotPath.split('/').pop();
    const filepath = path.join(
      process.cwd(),
      'uploads',
      'scenes',
      uploadId,
      filename
    );

    const scriptPath = path.join(process.cwd(), 'scripts', 'describe_scene.py');

    // Call Python script directly (simple approach that works)
    // Note: This will reload the model each time (~60-90s), but it's reliable
    try {
      const { stdout, stderr } = await execAsync(
        `python "${scriptPath}" "${filepath}"`,
        {
          timeout: 120000, // 2 minute timeout (includes model loading time)
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );

      if (stderr && !stderr.includes('Some weights')) {
        console.error('Python stderr:', stderr);
      }

      const description = stdout.trim();

      if (!description || description.includes('Error:') || description.includes('Traceback')) {
        console.error('Invalid description output:', description);
        return NextResponse.json({
          description: 'Scene from video',
        });
      }

      return NextResponse.json({
        description,
      });
    } catch (error) {
      const err = error as Error & { killed?: boolean; signal?: string };
      if (err.killed) {
        console.error('SmolVLM2 timeout - script took too long');
      } else {
        console.error('Failed to call SmolVLM2:', err.message || error);
      }
      return NextResponse.json({
        description: 'Scene from video',
      });
    }
  } catch (error) {
    console.error('Description generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate description', message: String(error) },
      { status: 500 }
    );
  }
}
