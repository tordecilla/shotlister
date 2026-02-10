# 🎬 Shotlister

**AI-Powered Video Scene Detection and Description**

Upload videos and automatically detect scenes with AI-generated descriptions. Built with Next.js, React, TypeScript, and SmolVLM2.

## ✨ Features

- 📤 **Drag-and-Drop Upload** - Intuitive file upload interface
- 🎥 **All Video Formats** - Supports MP4, MOV, AVI, MKV, WebM, and more
- 📊 **Progress Tracking** - Real-time upload and processing progress
- 🎬 **Scene Detection** - Automatic scene detection using PySceneDetect
- 🤖 **AI Descriptions** - SmolVLM2 generates descriptions for each scene
- 🖼️ **Scene Thumbnails** - Visual preview of every detected scene
- ⏱️ **Timecode Display** - Precise timestamps for each scene
- 🚀 **GPU Acceleration** - 10x faster with NVIDIA CUDA support
- 🔐 **Local Processing** - All processing happens on your machine, no cloud required

## 📋 Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Python** 3.11 to 3.13 ([Download](https://www.python.org/downloads/))
- **Git** ([Download](https://git-scm.com/downloads))
- *Optional but recommended:* NVIDIA GPU with 4GB+ VRAM for faster processing

## ⚡ Performance Comparison

| Setup | Model Load | Per Scene | 100 Scenes | Recommended For |
|-------|-----------|-----------|------------|-----------------|
| **🚀 GPU (CUDA)** | 5-10s | 2-5s | **5-10 min** | NVIDIA GPUs |
| **💻 CPU Only** | 20-30s | 60-90s | **2-3 hours** | All computers |

## 🚀 Installation

**Simple one-command installation that auto-detects your GPU!**

### Windows:
```bash
# 1. Clone repository
git clone https://github.com/tordecilla/shotlister.git
cd shotlister

# 2. Run installation script
install.bat
```

The installer will:
- ✓ Check for NVIDIA GPU and automatically install CUDA support if available
- ✓ Install PyTorch (CPU or GPU version based on your hardware)
- ✓ Set up Python virtual environment with all dependencies
- ✓ Install Node.js dependencies

### Mac/Linux:
```bash
# 1. Clone repository
git clone https://github.com/tordecilla/shotlister.git
cd shotlister

# 2. Make installer executable and run
chmod +x install.sh
./install.sh
```

The installer automatically detects your GPU and installs the appropriate version!

## 🎮 Running the App

### Windows:
```bash
start.bat
```

### Mac/Linux:
```bash
./start.sh
```

The start script automatically activates the Python environment and starts the server.

Then open **http://localhost:3000** in your browser!

## 📖 How to Use

1. **Upload a Video**
   - Drag and drop a video file onto the upload zone, or
   - Click to browse and select a video file

2. **Wait for Upload**
   - Watch the progress bar as your video uploads
   - Don't close the browser window during upload
   - For large files, this may take several minutes

3. **View Confirmation**
   - Once complete, you'll see an upload confirmation
   - Your video details will be displayed

## 🗂️ Project Structure

```
shotlister/
├── app/                    # Next.js pages
│   ├── page.tsx           # Homepage (upload interface)
│   ├── uploaded/          # Upload confirmation page
│   └── api/upload/        # Upload API endpoint
├── components/            # React components
│   └── VideoUploader.tsx  # Main upload component
├── lib/                   # Utility functions
├── types/                 # TypeScript type definitions
├── uploads/              # Uploaded videos (created automatically)
└── public/               # Static assets
```

## ⚙️ Configuration

Shotlister is configured through `shotlister.config.json` in the project root. This file is created automatically by the install script, but you can edit it at any time. Changes take effect the next time a video is processed (no restart required).

```json
{
  "useCuda": true,
  "vlmModel": "HuggingFaceTB/SmolVLM2-500M-Video-Instruct",
  "sceneDetector": "transnetv2"
}
```

### `useCuda` (boolean)

Controls whether GPU acceleration is used for AI processing.

- `true` — Use your NVIDIA GPU via CUDA. Requires an NVIDIA GPU and the CUDA version of PyTorch (installed automatically if you chose "Yes" during setup).
- `false` — Use CPU only. Works on any machine but is significantly slower.

If you're unsure whether you have a compatible GPU, run `nvidia-smi` in your terminal. If it shows your GPU, you can use CUDA.

### `vlmModel` (string)

The HuggingFace model used to generate scene descriptions. The default model is optimized for video scene understanding at a small size.

- `"HuggingFaceTB/SmolVLM2-500M-Video-Instruct"` — Default. Fast, lightweight (500M parameters). Good balance of speed and quality.

You can swap this for any compatible HuggingFace vision-language model, but larger models will require more VRAM and will be slower to load.

### `sceneDetector` (string)

Which scene detection engine to use for finding shot boundaries in videos.

- `"transnetv2"` — GPU-accelerated neural network for shot boundary detection. Faster than PySceneDetect, especially on longer videos. Requires PyTorch.
- `"pyscenedetect"` — Traditional CPU-based scene detection using the `detect-adaptive` algorithm. Reliable fallback if you run into issues with TransNetV2.

If scene detection feels slow (2-3+ minutes for a single video), make sure you're using `"transnetv2"` with `"useCuda": true`.

## 🐛 Troubleshooting

### "npm: command not found"
- Node.js is not installed or not in your PATH
- Install Node.js from https://nodejs.org/
- Restart your terminal after installation

### "Port 3000 is already in use"
- Another app is using port 3000
- Stop the other app, or run on a different port:
  ```bash
  npm run dev -- -p 3001
  ```

### Upload fails
- Try a smaller video file first
- Make sure the dev server is running (`npm run dev`)
- Look at the browser console for errors (F12 → Console tab)

### "Permission denied" errors
- Make sure you have write permissions in the project folder
- On Mac/Linux, you may need to run: `chmod +x install.sh start.sh`

## 📝 License

This project is open source and available for personal and commercial use.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

**Need help?** Open an issue on GitHub or check the troubleshooting section above.
