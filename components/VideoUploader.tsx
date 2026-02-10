'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Uppy from '@uppy/core';
import XHR from '@uppy/xhr-upload';
import { UploadState } from '@/types/upload';
import { formatBytes, VIDEO_EXTENSIONS } from '@/lib/upload-config';

export default function VideoUploader() {
  const router = useRouter();
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [uppy] = useState(() => {
    const uppyInstance = new Uppy({
      restrictions: {
        maxNumberOfFiles: 1,
        allowedFileTypes: ['video/*'],
      },
      autoProceed: true,
    });

    uppyInstance.use(XHR, {
      endpoint: '/api/upload',
      formData: true,
      fieldName: 'file',
    });

    return uppyInstance;
  });

  useEffect(() => {
    // Handle file added
    uppy.on('file-added', (file) => {
      console.log('File added:', file.name);
      setUploadState({
        status: 'uploading',
        progress: {
          bytesUploaded: 0,
          bytesTotal: file.size || 0,
          percentage: 0,
        },
        filename: file.name,
      });
    });

    // Handle upload progress
    uppy.on('upload-progress', (file, progress) => {
      if (file) {
        const percentage = progress.bytesTotal && progress.bytesTotal > 0
          ? Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)
          : 0;

        setUploadState({
          status: 'uploading',
          progress: {
            bytesUploaded: progress.bytesUploaded,
            bytesTotal: progress.bytesTotal || 0,
            percentage,
          },
          filename: file.name,
        });
      }
    });

    // Handle upload success
    uppy.on('upload-success', (file, response) => {
      if (file && response.body) {
        console.log('Upload successful:', file.name);
        const uploadId = response.body.uploadId || '';

        setUploadState({
          status: 'success',
          uploadId,
          filename: file.name,
        });

        // Redirect to confirmation page after a brief delay
        setTimeout(() => {
          router.push(`/uploaded?id=${uploadId}`);
        }, 1000);
      }
    });

    // Handle upload error
    uppy.on('upload-error', (file, error) => {
      console.error('Upload error:', error);
      setUploadState({
        status: 'error',
        error: error?.message || 'Upload failed. Please try again.',
      });
    });

    // Handle restriction errors
    uppy.on('restriction-failed', (file, error) => {
      console.error('Restriction failed:', error);
      setUploadState({
        status: 'error',
        error: error?.message || 'File does not meet requirements.',
      });
    });

    return () => {
      uppy.cancelAll();
    };
  }, [uppy, router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      try {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
        });
      } catch (err: any) {
        setUploadState({
          status: 'error',
          error: err?.message || 'Failed to add file.',
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      try {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
        });
      } catch (err: any) {
        setUploadState({
          status: 'error',
          error: err?.message || 'Failed to add file.',
        });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const resetUploader = () => {
    uppy.cancelAll();
    setUploadState({ status: 'idle' });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {uploadState.status === 'idle' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-4 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-50 hover:bg-gray-100"
        >
          <div className="space-y-4">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <div>
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-500 font-semibold text-lg">
                  Click to upload
                </span>
                <span className="text-gray-600 text-lg"> or drag and drop</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept="video/*"
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            <p className="text-sm text-gray-500">
              Video files only ({VIDEO_EXTENSIONS.join(', ')})
            </p>
            <p className="text-xs text-gray-400">No file size limit</p>
          </div>
        </div>
      )}

      {uploadState.status === 'uploading' && (
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Uploading...</h3>
            <span className="text-sm text-gray-500">{uploadState.progress.percentage}%</span>
          </div>

          <p className="text-sm text-gray-600 truncate">{uploadState.filename}</p>

          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadState.progress.percentage}%` }}
            />
          </div>

          <p className="text-sm text-gray-500 text-center">
            {formatBytes(uploadState.progress.bytesUploaded)} of{' '}
            {formatBytes(uploadState.progress.bytesTotal)}
          </p>

          <p className="text-xs text-gray-400 text-center">
            Large files are uploaded in chunks. Don't close this window.
          </p>
        </div>
      )}

      {uploadState.status === 'success' && (
        <div className="bg-green-50 rounded-lg shadow-lg p-8 text-center space-y-4">
          <div className="flex justify-center">
            <svg
              className="h-16 w-16 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Upload Complete!</h3>
          <p className="text-gray-600">{uploadState.filename}</p>
          <p className="text-sm text-gray-500">Redirecting...</p>
        </div>
      )}

      {uploadState.status === 'error' && (
        <div className="bg-red-50 rounded-lg shadow-lg p-8 space-y-4">
          <div className="flex justify-center">
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
          <h3 className="text-xl font-semibold text-gray-900">Upload Failed</h3>
          <p className="text-red-600">{uploadState.error}</p>
          <button
            onClick={resetUploader}
            className="mx-auto block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
