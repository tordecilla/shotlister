#!/usr/bin/env python3
"""
Scene description using SmolVLM2 locally
"""
import sys
import json
from pathlib import Path

try:
    from transformers import AutoProcessor, AutoModelForImageTextToText
    from PIL import Image
    import torch
except ImportError:
    print(json.dumps({
        "error": "Required packages not installed. Run: pip install transformers pillow torch torchvision"
    }))
    sys.exit(1)

# Model configuration
MODEL_ID = "HuggingFaceTB/SmolVLM2-500M-Video-Instruct"
device = "cuda" if torch.cuda.is_available() else "cpu"

# Cache the model globally to avoid reloading
_model = None
_processor = None

def load_model():
    """Load the model and processor (cached)"""
    global _model, _processor

    if _model is None:
        print("Loading SmolVLM2 model...", file=sys.stderr)
        _processor = AutoProcessor.from_pretrained(MODEL_ID)
        # SmolVLM2 uses bfloat16 for CUDA, float32 for CPU
        dtype = torch.bfloat16 if device == "cuda" else torch.float32
        _model = AutoModelForImageTextToText.from_pretrained(
            MODEL_ID,
            dtype=dtype,
            low_cpu_mem_usage=True,
        ).to(device)
        print(f"Model loaded on {device}", file=sys.stderr)

    return _model, _processor

def describe_image(image_path: str, max_tokens: int = 60) -> str:
    """Generate a description for an image"""
    try:
        model, processor = load_model()

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

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: describe_scene.py <image_path>"}))
        sys.exit(1)

    image_path = sys.argv[1]

    if not Path(image_path).exists():
        print(json.dumps({"error": f"Image not found: {image_path}"}))
        sys.exit(1)

    description = describe_image(image_path)
    # Output just the description text (no JSON wrapping)
    print(description)

if __name__ == "__main__":
    main()
