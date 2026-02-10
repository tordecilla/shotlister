import { promises as fs } from 'fs';
import path from 'path';
import { UploadMetadata } from '@/types/upload';

const METADATA_FILE = path.join(process.cwd(), 'uploads', 'metadata.json');

/**
 * Ensures the metadata file exists
 */
async function ensureMetadataFile(): Promise<void> {
  try {
    await fs.access(METADATA_FILE);
  } catch {
    // File doesn't exist, create it with empty array
    await fs.mkdir(path.dirname(METADATA_FILE), { recursive: true });
    await fs.writeFile(METADATA_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Reads all upload metadata from the metadata file
 */
async function readMetadata(): Promise<UploadMetadata[]> {
  await ensureMetadataFile();
  const data = await fs.readFile(METADATA_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Writes upload metadata to the metadata file
 */
async function writeMetadata(metadata: UploadMetadata[]): Promise<void> {
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

/**
 * Saves metadata for a newly uploaded file
 */
export async function saveFileMetadata(metadata: UploadMetadata): Promise<void> {
  const allMetadata = await readMetadata();
  allMetadata.push(metadata);
  await writeMetadata(allMetadata);
}

/**
 * Retrieves metadata for a specific upload by ID
 */
export async function getFileMetadata(id: string): Promise<UploadMetadata | null> {
  const allMetadata = await readMetadata();
  return allMetadata.find(m => m.id === id) || null;
}

/**
 * Retrieves all upload metadata
 */
export async function listUploads(): Promise<UploadMetadata[]> {
  return await readMetadata();
}

/**
 * Deletes metadata for a specific upload (does not delete the actual file)
 */
export async function deleteFileMetadata(id: string): Promise<boolean> {
  const allMetadata = await readMetadata();
  const filtered = allMetadata.filter(m => m.id !== id);

  if (filtered.length === allMetadata.length) {
    return false; // ID not found
  }

  await writeMetadata(filtered);
  return true;
}
