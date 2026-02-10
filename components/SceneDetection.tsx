'use client';

import { useEffect, useState } from 'react';

interface Scene {
  timestamp: number;
  timecode: string;
  screenshotPath: string;
  description?: string;
}

interface SceneDetectionProps {
  uploadId: string;
}

export default function SceneDetection({ uploadId }: SceneDetectionProps) {
  const [loading, setLoading] = useState(true);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [descriptionsInProgress, setDescriptionsInProgress] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(-1);
  const [excelGenerated, setExcelGenerated] = useState(false);
  const [queued, setQueued] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const [savedDescription, setSavedDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const hasUnsavedChanges = videoTitle !== savedTitle || videoDescription !== savedDescription;

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await fetch('/api/scenes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, videoTitle, videoDescription }),
      });
      setSavedTitle(videoTitle);
      setSavedDescription(videoDescription);
    } catch (err) {
      console.error('Failed to save video details:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    async function detectScenes() {
      try {
        setLoading(true);

        // First, check if scenes already exist
        const checkResponse = await fetch(`/api/scenes?uploadId=${uploadId}`);
        const checkData = await checkResponse.json();

        if (checkData.scenes && checkData.scenes.length > 0) {
          // Scenes already detected — show them and poll if still processing
          setScenes(checkData.scenes);
          setLoading(false);
          setDescriptionsInProgress(!checkData.descriptionsComplete || !checkData.excelGenerated);
          setProcessingIndex(checkData.processingIndex ?? -1);
          setExcelGenerated(checkData.excelGenerated ?? false);
          setQueued(checkData.queued ?? false);
          setVideoTitle(checkData.videoTitle ?? '');
          setVideoDescription(checkData.videoDescription ?? '');
          setSavedTitle(checkData.videoTitle ?? '');
          setSavedDescription(checkData.videoDescription ?? '');
          return;
        }

        // Check if already queued/processing (e.g. user refreshed during detection)
        if (checkData.descriptionsComplete === false) {
          setLoading(false);
          setDescriptionsInProgress(true);
          setQueued(checkData.queued ?? false);
          return;
        }

        // Nothing started yet — trigger processing pipeline
        const response = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId }),
        });

        if (!response.ok) {
          throw new Error('Scene detection failed');
        }

        const data = await response.json();
        setScenes(data.scenes || []);
        setDescriptionsInProgress(data.descriptionsInProgress || false);
        setQueued(true);
        setLoading(false);
      } catch (err) {
        console.error('Scene detection error:', err);
        setError(String(err));
        setLoading(false);
      }
    }

    detectScenes();
  }, [uploadId]);

  // Poll for description updates
  useEffect(() => {
    if (!descriptionsInProgress) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/scenes?uploadId=${uploadId}`);
        const data = await response.json();

        console.log(`[SceneDetection] Poll update: ${data.scenes?.length || 0} scenes, ${data.progress}% complete, processing index: ${data.processingIndex}`);

        setScenes(data.scenes || []);
        setProcessingIndex(data.processingIndex ?? -1);
        setExcelGenerated(data.excelGenerated ?? false);
        setQueued(data.queued ?? false);

        if (data.descriptionsComplete && data.excelGenerated) {
          console.log('[SceneDetection] All descriptions complete and Excel generated!');
          setDescriptionsInProgress(false);
          setExcelGenerated(true);
          clearInterval(interval);
        } else if (data.descriptionsComplete) {
          console.log('[SceneDetection] Descriptions complete, waiting for Excel generation...');
        }
      } catch (err) {
        console.error('Failed to fetch scene updates:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [uploadId, descriptionsInProgress]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center space-x-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Detecting Scenes...
            </h3>
            <p className="text-sm text-gray-500">
              This may take a few moments depending on video length
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg shadow-lg p-8">
        <h3 className="text-lg font-semibold text-red-900 mb-2">
          Scene Detection Failed
        </h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (scenes.length === 0 && descriptionsInProgress) {
    // Still processing — scenes not detected yet (queued or detecting)
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center space-x-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {queued ? 'Queued for processing' : 'Detecting Scenes...'}
            </h3>
            <p className="text-sm text-gray-500">
              {queued
                ? 'Another video is currently being processed — this one will start automatically'
                : 'This may take a few moments depending on video length'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="bg-yellow-50 rounded-lg shadow-lg p-8">
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">
          No Scenes Detected
        </h3>
        <p className="text-sm text-yellow-700">
          No scene changes were found in this video.
        </p>
      </div>
    );
  }

  const handleDownloadExcel = () => {
    window.location.href = `/api/export?uploadId=${uploadId}`;
  };

  const isQueued = descriptionsInProgress && queued;
  const modelLoading = descriptionsInProgress && !queued && processingIndex === -1 && scenes.length > 0;
  const scenesProcessing = descriptionsInProgress && processingIndex >= 0;

  return (
    <div className="space-y-6">
      {/* Video Title & Description */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="video-title" className="block text-sm font-medium text-gray-700 mb-1">
              Video Title
            </label>
            <input
              id="video-title"
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Enter a title for this video..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
            />
          </div>
          <div>
            <label htmlFor="video-description" className="block text-sm font-medium text-gray-700 mb-1">
              Video Description
            </label>
            <textarea
              id="video-description"
              value={videoDescription}
              onChange={(e) => setVideoDescription(e.target.value)}
              placeholder="Enter a description for this video..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 resize-vertical"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDetails}
              disabled={!hasUnsavedChanges || saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {hasUnsavedChanges && !saving && (
              <span className="text-xs text-amber-600">Unsaved changes</span>
            )}
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {descriptionsInProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent flex-shrink-0"></div>
            <div className="flex-1">
              {isQueued ? (
                <>
                  <p className="text-sm font-medium text-blue-900">Queued for processing</p>
                  <p className="text-xs text-blue-700">Another video is currently being processed — this one will start automatically</p>
                </>
              ) : modelLoading ? (
                <>
                  <p className="text-sm font-medium text-blue-900">Loading AI model...</p>
                  <p className="text-xs text-blue-700">This may take a minute or two on first run</p>
                </>
              ) : scenesProcessing ? (
                <>
                  <p className="text-sm font-medium text-blue-900">
                    Processing scene {processingIndex + 1} of {scenes.length}...
                  </p>
                  <p className="text-xs text-blue-700">
                    You can safely navigate away — processing continues in the background
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-blue-900">Generating Excel file...</p>
                  <p className="text-xs text-blue-700">Almost done</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scene Grid */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Detected Scenes ({scenes.length})
          </h2>
          <button
            onClick={handleDownloadExcel}
            disabled={!excelGenerated || descriptionsInProgress}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            title={descriptionsInProgress || !excelGenerated ? 'Excel file is being generated...' : 'Download as Excel spreadsheet'}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download Excel
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenes.map((scene, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100 relative">
                <img
                  src={`/api/scenes/${uploadId}/${scene.screenshotPath.split('/').pop()}`}
                  alt={`Scene ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect fill="%23ddd" width="640" height="360"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Preview%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    Scene {index + 1}
                  </span>
                  <span className="text-sm font-mono text-blue-600">
                    {scene.timecode}
                  </span>
                </div>
                {scene.description ? (
                  <p className="text-sm text-gray-700 mb-2">
                    {scene.description}
                  </p>
                ) : descriptionsInProgress ? (
                  index === processingIndex ? (
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                      <p className="text-sm text-blue-600 italic">
                        Processing...
                      </p>
                    </div>
                  ) : index > processingIndex ? (
                    <p className="text-sm text-gray-400 italic mb-2">
                      In queue
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 italic mb-2">
                      Generating description...
                    </p>
                  )
                ) : null}
                <div className="text-xs text-gray-500">
                  {scene.timestamp.toFixed(2)}s
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
