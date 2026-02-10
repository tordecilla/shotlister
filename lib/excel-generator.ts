import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import path from 'path';

interface Scene {
  timestamp: number;
  timecode: string;
  screenshotPath: string;
  description?: string;
}

export async function generateExcelFile(
  uploadId: string,
  scenes: Scene[],
  scenesDir: string
): Promise<string> {
  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Scenes');

  // Set column widths
  worksheet.columns = [
    { header: 'Scene Number', key: 'sceneNumber', width: 15 },
    { header: 'Timestamp', key: 'timestamp', width: 15 },
    { header: 'Description', key: 'description', width: 60 },
    { header: 'Image', key: 'image', width: 30 },
  ];

  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 12 };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  headerRow.height = 25;

  // Add scenes data
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const rowNumber = i + 2; // +2 because row 1 is header and Excel is 1-indexed

    // Add row data
    const row = worksheet.addRow({
      sceneNumber: i + 1,
      timestamp: scene.timecode || '',
      description: scene.description || 'No description',
    });

    // Set row height to accommodate image
    row.height = 120;

    // Set text alignment
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // Add image if it exists
    if (scene.screenshotPath) {
      const imagePath = path.join(scenesDir, path.basename(scene.screenshotPath));

      try {
        // Check if file exists
        await fs.access(imagePath);

        // Read image file
        const imageBuffer = await fs.readFile(imagePath);

        // Add image to workbook
        const imageId = workbook.addImage({
          buffer: imageBuffer,
          extension: 'png',
        });

        // Insert image into cell
        worksheet.addImage(imageId, {
          tl: { col: 3, row: rowNumber - 1 }, // Top-left corner (0-indexed)
          ext: { width: 160, height: 90 }, // 16:9 aspect ratio thumbnail
          editAs: 'oneCell'
        });
      } catch (error) {
        console.error(`Failed to add image for scene ${i + 1}:`, error);
        // Continue without image if it fails
      }
    }
  }

  // Save Excel file
  const excelPath = path.join(scenesDir, 'scenes.xlsx');
  await workbook.xlsx.writeFile(excelPath);

  console.log(`✓ Excel file saved: ${excelPath}`);
  return excelPath;
}
