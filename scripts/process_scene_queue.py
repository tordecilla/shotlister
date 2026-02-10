#!/usr/bin/env python3
"""
Persistent Python worker for scene detection and AI descriptions.

Modes:
  --persistent    Stay alive, read commands from stdin (used by Node.js queue)
  <metadata_path> Process a single file and exit (for testing)

Protocol (persistent mode):
  Input:   DETECT|<video_path>|<upload_id>|<output_dir>   → scene detection
  Output:  DETECT_DONE|<json_scenes_array>

  Input:   <metadata_path>                                 → AI descriptions
  Output:  DONE:<metadata_path>

  Output:  READY                                           → startup signal
"""
import sys
import os
import json
from pathlib import Path
import time
import numpy as np

try:
    from transformers import AutoProcessor, AutoModelForImageTextToText
    from PIL import Image
    import torch
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install transformers pillow torch torchvision", file=sys.stderr)
    sys.exit(1)

# Load config
CONFIG_PATH = Path(__file__).parent.parent / "shotlister.config.json"
config = {}
if CONFIG_PATH.exists():
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)
    print(f"Config loaded from {CONFIG_PATH}", file=sys.stderr)
else:
    print(f"No config file found at {CONFIG_PATH}, using defaults", file=sys.stderr)

MODEL_ID = config.get("vlmModel", "HuggingFaceTB/SmolVLM2-500M-Video-Instruct")
USE_CUDA = config.get("useCuda", True)
SCENE_DETECTOR = config.get("sceneDetector", "pyscenedetect")

# Determine device based on config and availability
if USE_CUDA and torch.cuda.is_available():
    device = "cuda"
    print(f"CUDA is available: {torch.cuda.get_device_name(0)}", file=sys.stderr)
    print(f"CUDA version: {torch.version.cuda}", file=sys.stderr)
elif USE_CUDA and not torch.cuda.is_available():
    device = "cpu"
    print("WARNING: CUDA requested in config but not available, falling back to CPU", file=sys.stderr)
else:
    device = "cpu"
    print("Using CPU (CUDA disabled in config)", file=sys.stderr)

print(f"VLM Model: {MODEL_ID}", file=sys.stderr)
print(f"Scene Detector: {SCENE_DETECTOR}", file=sys.stderr)


def update_metadata(metadata_path, **updates):
    """Read current metadata, apply updates, write back.

    This prevents overwriting fields (like videoTitle/videoDescription)
    that may have been saved by the PATCH endpoint while we're processing.
    """
    with open(metadata_path, 'r') as f:
        current = json.load(f)
    current.update(updates)
    with open(metadata_path, 'w') as f:
        json.dump(current, f, indent=2)
    return current


def load_vlm_model():
    """Load the SmolVLM2 model and processor."""
    print(f"Loading SmolVLM2 model on {device}...", file=sys.stderr)
    start_time = time.time()
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    dtype = torch.bfloat16 if device == "cuda" else torch.float32
    model = AutoModelForImageTextToText.from_pretrained(
        MODEL_ID,
        dtype=dtype,
        low_cpu_mem_usage=True,
    ).to(device)
    load_time = time.time() - start_time
    print(f"SmolVLM2 loaded in {load_time:.1f}s", file=sys.stderr)
    return processor, model


def load_transnet_model():
    """Load TransNetV2 model for scene detection."""
    try:
        from transnetv2_pytorch import TransNetV2
    except ImportError:
        print("ERROR: transnetv2-pytorch not installed. Run: pip install transnetv2-pytorch", file=sys.stderr)
        return None

    print(f"Loading TransNetV2 model on {device}...", file=sys.stderr)
    start_time = time.time()
    model = TransNetV2(device=device)
    model.eval()
    load_time = time.time() - start_time
    print(f"TransNetV2 loaded in {load_time:.1f}s", file=sys.stderr)
    return model


def format_timecode(seconds):
    """Convert seconds to HH:MM:SS.mmm timecode."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


def detect_scenes_transnet(video_path, upload_id, output_dir, transnet_model):
    """Detect scenes using TransNetV2 and extract screenshots with OpenCV."""
    import cv2

    os.makedirs(output_dir, exist_ok=True)

    print(f"Reading video: {video_path}", file=sys.stderr)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"ERROR: Could not open video: {video_path}", file=sys.stderr)
        return []

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Video: {total_frames} frames @ {fps:.2f} fps ({total_frames/fps:.1f}s)", file=sys.stderr)

    # Read all frames resized to 48x27 for TransNetV2
    print("Reading frames for TransNetV2...", file=sys.stderr)
    start_time = time.time()
    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        # OpenCV reads BGR, TransNetV2 expects RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frames.append(cv2.resize(frame_rgb, (48, 27)))
    cap.release()
    read_time = time.time() - start_time
    print(f"Read {len(frames)} frames in {read_time:.1f}s", file=sys.stderr)

    if not frames:
        print("ERROR: No frames read from video", file=sys.stderr)
        return []

    # Run TransNetV2 inference
    print("Running TransNetV2 inference...", file=sys.stderr)
    start_time = time.time()
    video_tensor = torch.from_numpy(np.array(frames)).to(transnet_model.device)
    single_frame_pred, _ = transnet_model.predict_frames(video_tensor, quiet=True)
    single_frame_np = single_frame_pred.cpu().detach().numpy()

    # Convert predictions to structured scene data
    scene_data = transnet_model.predictions_to_scenes_with_data(
        single_frame_np, fps=fps, threshold=0.5
    )
    infer_time = time.time() - start_time
    print(f"TransNetV2 detected {len(scene_data)} scenes in {infer_time:.1f}s", file=sys.stderr)

    # Extract screenshots at the start frame of each scene
    print("Extracting screenshots...", file=sys.stderr)
    video_basename = Path(video_path).stem
    cap = cv2.VideoCapture(video_path)
    scenes = []

    for i, scene in enumerate(scene_data):
        start_frame = scene['start_frame']
        timestamp = start_frame / fps
        timecode = format_timecode(timestamp)
        filename = f"{video_basename}-Scene-{i+1:03d}-01.jpg"
        filepath = os.path.join(output_dir, filename)

        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(filepath, frame)

        scenes.append({
            "timestamp": round(timestamp, 3),
            "timecode": timecode,
            "screenshotPath": f"/uploads/scenes/{upload_id}/{filename}"
        })

    cap.release()
    print(f"Saved {len(scenes)} screenshots", file=sys.stderr)
    return scenes


def describe_image(image_path: str, model, processor, max_tokens: int = 60) -> str:
    """Generate a description for an image"""
    try:
        # Load image
        image = Image.open(image_path).convert("RGB")

        # Prepare prompt with image token - use conversation format
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image"},
                    {"type": "text", "text": "Describe this image in one to two sentences."}
                ]
            }
        ]

        # Format the prompt
        prompt = processor.apply_chat_template(messages, add_generation_prompt=True)

        # Process inputs
        inputs = processor(
            text=prompt,
            images=[image],
            return_tensors="pt"
        ).to(device)

        # Generate description
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                do_sample=False,
            )

        # Decode output
        description = processor.decode(outputs[0], skip_special_tokens=True)

        # Extract just the response (remove prompt)
        if "Assistant:" in description:
            description = description.split("Assistant:")[-1].strip()
        elif "\n\n" in description:
            description = description.split("\n\n")[-1].strip()

        return description

    except Exception as e:
        return f"Error: {str(e)}"


def process_file(metadata_path_str, model, processor):
    """Process all scenes in a single metadata file."""
    metadata_path = Path(metadata_path_str)

    if not metadata_path.exists():
        print(f"ERROR: Metadata file not found: {metadata_path}", file=sys.stderr)
        return

    # Load metadata
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)

    scenes = metadata.get('scenes', [])

    if not scenes:
        print("No scenes to process", file=sys.stderr)
        return

    scenes_dir = metadata_path.parent
    total = len(scenes)

    for i, scene in enumerate(scenes):
        # Skip if already has description
        if scene.get('description'):
            print(f"[{i+1}/{total}] Skipping scene {i+1} (already has description)", file=sys.stderr)
            continue

        print(f"[{i+1}/{total}] Processing scene {i+1}...", file=sys.stderr)

        # Set processingIndex BEFORE processing so frontend shows correct status
        update_metadata(metadata_path,
            processingIndex=i,
            scenes=scenes,
            descriptionsComplete=False,
            progress=round((i / total) * 100)
        )

        # Get image path
        screenshot_filename = Path(scene['screenshotPath']).name
        image_path = scenes_dir / screenshot_filename

        if not image_path.exists():
            print(f"WARNING: Image not found: {image_path}", file=sys.stderr)
            scene['description'] = 'Scene from video'
        else:
            # Generate description
            description = describe_image(str(image_path), model, processor)
            scene['description'] = description
            print(f"  → {description}", file=sys.stderr)

        # Save again after description is generated
        update_metadata(metadata_path,
            scenes=scenes,
            progress=round(((i + 1) / total) * 100)
        )

    # Mark as complete
    update_metadata(metadata_path,
        processingIndex=-1,
        descriptionsComplete=True,
        progress=100,
        scenes=scenes
    )

    print(f"Completed processing {total} scenes!", file=sys.stderr)


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == '--persistent':
        # Persistent mode: load models once, process commands from stdin

        # Load TransNetV2 if configured
        transnet_model = None
        if SCENE_DETECTOR == "transnetv2":
            transnet_model = load_transnet_model()
            if transnet_model is None:
                print("WARNING: TransNetV2 failed to load, scene detection via worker unavailable", file=sys.stderr)

        # Load SmolVLM2 (always needed for descriptions)
        processor, vlm_model = load_vlm_model()

        # Signal to Node.js that all models are ready
        print("READY", flush=True)

        # Read commands from stdin
        for line in sys.stdin:
            line = line.strip()
            if not line or line == "EXIT":
                break

            if line.startswith("DETECT|"):
                # Scene detection command: DETECT|<video_path>|<upload_id>|<output_dir>
                parts = line.split("|")
                if len(parts) != 4:
                    print(f"ERROR: Invalid DETECT command: {line}", file=sys.stderr)
                    print(f"DETECT_DONE|[]", flush=True)
                    continue

                video_path, upload_id, output_dir = parts[1], parts[2], parts[3]
                print(f"\n--- Detecting scenes: {video_path} ---", file=sys.stderr)

                try:
                    if transnet_model is not None:
                        scenes = detect_scenes_transnet(video_path, upload_id, output_dir, transnet_model)
                    else:
                        print("ERROR: TransNetV2 not loaded", file=sys.stderr)
                        scenes = []
                except Exception as e:
                    print(f"ERROR detecting scenes: {e}", file=sys.stderr)
                    scenes = []

                print(f"DETECT_DONE|{json.dumps(scenes)}", flush=True)
            else:
                # Description command: <metadata_path>
                print(f"\n--- Processing descriptions: {line} ---", file=sys.stderr)
                try:
                    process_file(line, vlm_model, processor)
                except Exception as e:
                    print(f"ERROR processing {line}: {e}", file=sys.stderr)

                print(f"DONE:{line}", flush=True)

        print("Python worker exiting", file=sys.stderr)

    else:
        # Single-file mode (for testing)
        if len(sys.argv) < 2:
            print("Usage: process_scene_queue.py --persistent  OR  process_scene_queue.py <metadata_path>", file=sys.stderr)
            sys.exit(1)

        metadata_path = Path(sys.argv[1])
        if not metadata_path.exists():
            print(f"ERROR: Metadata file not found: {metadata_path}", file=sys.stderr)
            sys.exit(1)

        processor, model = load_vlm_model()
        process_file(str(metadata_path), model, processor)


if __name__ == "__main__":
    main()
