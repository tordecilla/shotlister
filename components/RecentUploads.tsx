'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatBytes } from '@/lib/upload-config';

interface UploadEntry {
  id: string;
  filename: string;
  size: number;
  uploadedAt: string;
  videoTitle: string;
  videoDescription: string;
  sceneCount: number;
  status: string;
  excelGenerated: boolean;
  videoDeleted: boolean;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  'Uploaded': { label: 'Uploaded', color: 'bg-gray-100 text-gray-700' },
  'Detecting Scenes': { label: 'Detecting Scenes', color: 'bg-yellow-100 text-yellow-800' },
  'Queued': { label: 'Queued', color: 'bg-amber-100 text-amber-800' },
  'Loading Model': { label: 'Loading Model', color: 'bg-blue-100 text-blue-800' },
  'Generating Descriptions': { label: 'Generating Descriptions', color: 'bg-blue-100 text-blue-800' },
  'Generating Excel': { label: 'Generating Excel', color: 'bg-purple-100 text-purple-800' },
  'Complete': { label: 'Complete', color: 'bg-green-100 text-green-800' },
};

const activeStatuses = new Set(['Detecting Scenes', 'Queued', 'Loading Model', 'Generating Descriptions', 'Generating Excel']);

export default function RecentUploads() {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchUploads();
  }, []);

  async function fetchUploads() {
    try {
      const res = await fetch('/api/upload');
      if (res.ok) {
        const data = await res.json();
        setUploads(data);
      }
    } catch (err) {
      console.error('Failed to fetch uploads:', err);
    } finally {
      setLoaded(true);
    }
  }

  async function handleDeleteVideo(upload: UploadEntry) {
    const name = upload.videoTitle || upload.filename;
    if (!window.confirm(`Delete the video file for "${name}"?\n\nThe scene analysis, screenshots, and Excel file will be kept.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/upload?id=${upload.id}&mode=video`, { method: 'DELETE' });
      if (res.ok) {
        setUploads((prev) =>
          prev.map((u) => (u.id === upload.id ? { ...u, videoDeleted: true } : u))
        );
      }
    } catch (err) {
      console.error('Failed to delete video:', err);
    }
  }

  async function handleDeleteProject(upload: UploadEntry) {
    const name = upload.videoTitle || upload.filename;
    if (!window.confirm(`Permanently delete the entire project "${name}"?\n\nThis will remove the video, all screenshots, descriptions, and the Excel file. This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/upload?id=${upload.id}&mode=all`, { method: 'DELETE' });
      if (res.ok) {
        setUploads((prev) => prev.filter((u) => u.id !== upload.id));
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  }

  if (!loaded || uploads.length === 0) return null;

  const filtered = search.trim()
    ? uploads.filter((u) => {
        const q = search.toLowerCase();
        return (
          (u.videoTitle && u.videoTitle.toLowerCase().includes(q)) ||
          (u.videoDescription && u.videoDescription.toLowerCase().includes(q)) ||
          u.filename.toLowerCase().includes(q)
        );
      })
    : uploads;

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold text-gray-700 mb-4 text-center">
        Video Uploads
      </h2>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, description, or filename..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
        />
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No uploads match your search.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filtered.map((upload) => {
              const date = new Date(upload.uploadedAt);
              const formattedDate = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const displayName = upload.videoTitle || upload.filename;
              const { label, color } = statusConfig[upload.status] ?? statusConfig['Uploaded'];
              const isActive = activeStatuses.has(upload.status);

              return (
                <li key={upload.id}>
                  <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                    <Link
                      href={`/uploaded?id=${upload.id}`}
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      <svg
                        className="w-5 h-5 text-gray-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {displayName}
                        </p>
                        {upload.videoTitle && (
                          <p className="text-xs text-gray-500 truncate">{upload.filename}</p>
                        )}
                      </div>
                    </Link>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${color}`}>
                        {label}
                      </span>
                      {upload.videoDeleted && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                          Video removed
                        </span>
                      )}
                      <span className="text-xs text-gray-500 hidden sm:inline">
                        {formatBytes(upload.size)}
                      </span>
                      <span className="text-xs text-gray-400 hidden sm:inline">
                        {formattedDate}
                      </span>
                      {upload.excelGenerated && (
                        <a
                          href={`/api/export?uploadId=${upload.id}`}
                          className="text-green-600 hover:text-green-700 flex-shrink-0"
                          title="Download Excel"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </a>
                      )}
                      {/* Delete video file only */}
                      <button
                        onClick={() => handleDeleteVideo(upload)}
                        disabled={upload.videoDeleted || isActive}
                        className={`flex-shrink-0 transition-colors ${upload.videoDeleted || isActive ? 'text-gray-300 cursor-not-allowed' : 'text-orange-500 hover:text-orange-600'}`}
                        title={isActive ? 'Cannot delete while processing' : upload.videoDeleted ? 'Video file already removed' : 'Delete video file (keeps analysis data)'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 4V2h10v2m-2 0h4v2H5V4h2m0 2v14a2 2 0 002 2h6a2 2 0 002-2V6"
                          />
                        </svg>
                      </button>
                      {/* Delete entire project */}
                      <button
                        onClick={() => handleDeleteProject(upload)}
                        disabled={isActive}
                        className={`flex-shrink-0 transition-colors ${isActive ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:text-red-600'}`}
                        title={isActive ? 'Cannot delete while processing' : 'Delete entire project'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                      <Link
                        href={`/uploaded?id=${upload.id}`}
                        className="text-blue-500 flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
