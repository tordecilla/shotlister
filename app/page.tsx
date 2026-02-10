import VideoUploader from '@/components/VideoUploader';
import RecentUploads from '@/components/RecentUploads';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Shotlister
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Upload Your Video
          </p>
          <p className="text-base text-gray-500">
            Analyze scenes with AI-powered descriptions
          </p>
        </div>

        {/* Upload Component */}
        <VideoUploader />

        {/* Video Uploads */}
        <RecentUploads />

        {/* Info Section */}
        <div className="mt-12 text-center text-sm text-gray-500 space-y-2">
          <p>
            <strong>How it works:</strong> Upload a video file, and we&apos;ll scan it for scenes
          </p>
          <p>
            Supports all common video formats • No file size limit • Resumable uploads
          </p>
        </div>
      </div>
    </div>
  );
}
