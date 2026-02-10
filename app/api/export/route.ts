import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

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

    // Path to the scenes directory and Excel file
    const scenesDir = path.join(process.cwd(), 'uploads', 'scenes', uploadId);
    const excelPath = path.join(scenesDir, 'scenes.xlsx');

    try {
      // Check if file exists
      await fs.access(excelPath);

      // Read the file
      const buffer = await fs.readFile(excelPath);

      // Read metadata to get video title for filename
      let filename = `scenes-${uploadId}.xlsx`;
      try {
        const metadataPath = path.join(scenesDir, 'metadata.json');
        const metaData = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metaData);
        if (metadata.videoTitle) {
          const safeTitle = metadata.videoTitle.replace(/[<>:"/\\|?*]/g, '').trim();
          if (safeTitle) filename = `${safeTitle}.xlsx`;
        }
      } catch {
        // Fall back to default filename
      }

      // Return Excel file as download
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Excel file not found. Descriptions may still be processing.' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Excel download error:', error);
    return NextResponse.json(
      { error: 'Failed to download Excel file', message: String(error) },
      { status: 500 }
    );
  }
}
