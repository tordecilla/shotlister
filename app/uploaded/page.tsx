import { Suspense } from 'react';
import Link from 'next/link';
import { getFileMetadata } from '@/lib/storage';
import { formatBytes } from '@/lib/upload-config';
import SceneDetection from '@/components/SceneDetection';

// This component will be wrapped in Suspense to handle async data fetching
async function UploadedContent({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const params = await searchParams;
  const id = params.id;

  if (!id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <svg
                className="h-16 w-16 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Invalid Upload ID</h1>
            <p className="text-gray-600 mb-8">
              No upload ID was provided. Please upload a video first.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch metadata for the uploaded file
  const metadata = await getFileMetadata(id);

  if (!metadata) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <svg
                className="h-16 w-16 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Upload Not Found</h1>
            <p className="text-gray-600 mb-8">
              Could not find upload with ID: <code className="bg-gray-100 px-2 py-1 rounded">{id}</code>
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Another Video
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Format the upload date
  const uploadDate = new Date(metadata.uploadedAt);
  const formattedDate = uploadDate.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Success Message */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <svg
                className="h-20 w-20 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Upload Complete!</h1>
            <p className="text-gray-600">Your video has been successfully uploaded</p>
          </div>

          {/* File Details */}
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Filename</span>
              <span className="text-sm text-gray-900 font-semibold truncate max-w-xs" title={metadata.filename}>
                {metadata.filename}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">File Size</span>
              <span className="text-sm text-gray-900 font-semibold">
                {formatBytes(metadata.size)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Upload Time</span>
              <span className="text-sm text-gray-900 font-semibold">{formattedDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Upload ID</span>
              <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                {metadata.id}
              </span>
            </div>
          </div>
        </div>

        {/* Scene Detection */}
        <div className="mb-6">
          <SceneDetection uploadId={id} />
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Upload Another Video
          </Link>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function UploadedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <UploadedContent searchParams={searchParams} />
    </Suspense>
  );
}
