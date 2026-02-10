# Shotlister

Video scene analysis tool. Upload a video, automatically detect scene changes, generate AI descriptions for each scene, and export to Excel.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API routes (TypeScript)
- **AI Model:** SmolVLM2-500M-Video-Instruct (HuggingFace) via Python
- **Scene Detection:** PySceneDetect (Python CLI, `detect-adaptive` algorithm)
- **Excel:** ExcelJS with embedded scene screenshots
- **Upload:** Uppy (drag-and-drop file upload)
- **Config:** `shotlister.config.json` (CUDA toggle, model selection)

## Project Structure

```
app/
  page.tsx                          # Home page (upload + video list)
  layout.tsx                        # Root layout with nav header
  uploaded/page.tsx                 # Scene detection view for a single upload
  api/
    upload/route.ts                 # POST upload, GET list, DELETE video/project
    scenes/route.ts                 # POST detect scenes, GET poll status, PATCH save title/desc
    scenes/[uploadId]/[filename]/   # Serve scene screenshot images
    export/route.ts                 # GET download Excel file
    describe-scene/route.ts         # Single scene description endpoint (legacy)

components/
  VideoUploader.tsx                 # Uppy-based video upload component
  SceneDetection.tsx                # Scene grid with status, polling, title/desc editing
  RecentUploads.tsx                 # Video uploads list with search, status, delete actions

lib/
  storage.ts                        # File metadata CRUD (JSON-based, uploads/metadata.json)
  scene-detection.ts                # PySceneDetect wrapper (spawns python CLI)
  excel-generator.ts                # ExcelJS workbook builder with embedded images
  upload-config.ts                  # Allowed video types, max file size, formatBytes()

scripts/
  process_scene_queue.py            # Main AI processor: loads model once, processes all scenes
  describe_scene.py                 # Single image description (for testing)
  test_smolvlm.py                   # Model test script
  stop-server.js                    # Kill Next.js server by PID
  stop-smolvlm.js                   # Kill SmolVLM server process

shotlister.config.json              # User config: { useCuda, vlmModel }
```

## Data Flow

1. User uploads video -> saved to `uploads/` with metadata in `uploads/metadata.json`
2. User navigates to `/uploaded?id=<uploadId>` -> `SceneDetection` component triggers processing
3. `POST /api/scenes` creates empty metadata with `queued: true` -> enqueues full pipeline -> returns immediately
4. Frontend starts polling every 2s for updates
5. When it's this video's turn in the queue: PySceneDetect runs -> screenshots + scenes saved to metadata
6. Python script loads AI model -> generates descriptions -> updates metadata after each scene
7. After all descriptions complete, Excel is generated with embedded screenshots
8. Frontend polls until both `descriptionsComplete` AND `excelGenerated` are true

## Processing Queue

The entire processing pipeline (scene detection + AI descriptions + Excel) runs sequentially via an in-memory queue in `scenes/route.ts` stored on `globalThis` (survives Next.js HMR). Only one video processes at a time. POST returns immediately; the frontend polls for progress.

### Metadata Status Flow
```
Uploaded -> Detecting Scenes -> Queued -> Loading Model -> Generating Descriptions -> Generating Excel -> Complete
```

### Metadata Fields (`uploads/scenes/<id>/metadata.json`)
- `uploadId` - UUID
- `scenes[]` - array of { timestamp, timecode, screenshotPath, description? }
- `descriptionsComplete` - boolean
- `processingIndex` - which scene is being processed (-1 = not started or done)
- `progress` - 0-100
- `excelGenerated` - boolean
- `queued` - boolean (waiting in processing queue)
- `videoTitle` / `videoDescription` - user-editable fields

## Key Patterns

- **Progressive loading:** Return scenes immediately, generate AI descriptions in background. Frontend polls every 2 seconds for updates.
- **Queue-based processing:** Model loads once (~90s), processes all images sequentially (~2-5s each on GPU). Never spawn multiple model instances.
- **Delete protection:** Cannot delete uploads that are queued or being processed. Enforced both frontend (disabled buttons) and backend (409 response).
- **Video title for Excel:** If user sets a video title, it's used as the Excel download filename.

## Environment

- **Python 3.13** (system install, no venv)
- **CUDA:** PyTorch with `--index-url https://download.pytorch.org/whl/cu124` for GPU support
- **Platform:** Windows primary, macOS/Linux compatible
- **Python command:** `python` on Windows, `python3` on macOS/Linux
- **Install:** `install.bat` / `install.sh` (interactive GPU prompt, creates config)
- **Run:** `npm run dev` for development

## Important Constraints

- PySceneDetect requires file extensions on video files (MP4, MOV, etc.)
- SmolVLM2 requires `num2words` package
- Uses `bfloat16` on CUDA, `float32` on CPU
- First few detected scenes may be black/gray (normal for videos with fade-ins)
- The processing queue is in-memory only; if the server restarts, queued items are lost
