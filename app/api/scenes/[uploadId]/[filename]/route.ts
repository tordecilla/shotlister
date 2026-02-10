import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uploadId: string; filename: string }> }
) {
  try {
    const { uploadId, filename } = await params;

    // Construct the path to the screenshot
    const screenshotPath = path.join(
      process.cwd(),
      'uploads',
      'scenes',
      uploadId,
      filename
    );

    // Read the file
    const file = await fs.readFile(screenshotPath);

    // Return the image
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving screenshot:', error);
    return new NextResponse('Image not found', { status: 404 });
  }
}
