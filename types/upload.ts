/**
 * Metadata for an uploaded video file
 */
export interface UploadMetadata {
  /** Unique identifier for the upload */
  id: string;

  /** Original filename */
  filename: string;

  /** File size in bytes */
  size: number;

  /** MIME type (e.g., 'video/mp4') */
  mimeType: string;

  /** ISO timestamp of when the upload completed */
  uploadedAt: string;

  /** Path to the uploaded file */
  path: string;
}

/**
 * Upload progress information
 */
export interface UploadProgress {
  /** Bytes uploaded so far */
  bytesUploaded: number;

  /** Total bytes to upload */
  bytesTotal: number;

  /** Progress percentage (0-100) */
  percentage: number;
}

/**
 * Upload state for UI management
 */
export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: UploadProgress; filename: string }
  | { status: 'success'; uploadId: string; filename: string }
  | { status: 'error'; error: string };
