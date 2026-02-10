/**
 * Upload configuration constants
 */

/** Allowed video MIME types (common ones listed, but we accept all video/*) */
export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/avi',
  'video/msvideo',
  'video/x-matroska',
  'video/webm',
  'video/x-flv',
  'video/x-ms-wmv',
  'video/mpeg',
];

/** Human-readable video extensions for UI */
export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.flv',
  '.wmv',
  '.mpeg',
  '.mpg',
];

/** Tus chunk size (5MB) */
export const CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * Formats bytes to human-readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Validates if a MIME type is an allowed video type
 * Accepts any MIME type that starts with "video/"
 */
export function isValidVideoType(mimeType: string): boolean {
  // Accept any video/* MIME type
  return mimeType.startsWith('video/');
}
