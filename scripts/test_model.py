#!/usr/bin/env python3
"""
Test script to verify SmolVLM2 model works correctly
"""
import sys

print("Testing SmolVLM2 model loading...", file=sys.stderr)

try:
    from transformers import AutoProcessor, AutoModelForImageTextToText
    import torch
    print("✓ Imports successful", file=sys.stderr)
except ImportError as e:
    print(f"✗ Import error: {e}", file=sys.stderr)
    sys.exit(1)

MODEL_ID = "HuggingFaceTB/SmolVLM2-500M-Video-Instruct"
device = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Device: {device}", file=sys.stderr)
print(f"Attempting to load model: {MODEL_ID}", file=sys.stderr)

try:
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    print("✓ Processor loaded", file=sys.stderr)
except Exception as e:
    print(f"✗ Processor error: {e}", file=sys.stderr)
    sys.exit(1)

try:
    # SmolVLM2 uses bfloat16 for CUDA, float32 for CPU
    dtype = torch.bfloat16 if device == "cuda" else torch.float32
    print(f"Using dtype: {dtype}", file=sys.stderr)

    model = AutoModelForImageTextToText.from_pretrained(
        MODEL_ID,
        dtype=dtype,
        low_cpu_mem_usage=True,
    ).to(device)
    print("✓ Model loaded successfully", file=sys.stderr)
except Exception as e:
    print(f"✗ Model loading error: {e}", file=sys.stderr)
    print(f"   Error type: {type(e).__name__}", file=sys.stderr)
    sys.exit(1)

print("\n✓ All tests passed! Model is ready to use.", file=sys.stderr)
print("Model loaded successfully")
