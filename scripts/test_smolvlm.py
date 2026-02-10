#!/usr/bin/env python3
"""
Test SmolVLM2 with a sample image
"""
import sys
from pathlib import Path

# Create a simple test image
from PIL import Image, ImageDraw, ImageFont

# Create test image
img = Image.new('RGB', (640, 360), color=(73, 109, 137))
d = ImageDraw.Draw(img)
d.text((320, 180), "Test Scene", fill=(255, 255, 255), anchor="mm")

test_image_path = Path(__file__).parent / "test_image.jpg"
img.save(test_image_path)
print(f"Created test image: {test_image_path}")

# Now test the description
sys.path.insert(0, str(Path(__file__).parent))
from describe_scene import describe_image

print("\nTesting SmolVLM2...")
print("-" * 50)

try:
    description = describe_image(str(test_image_path))
    print(f"[OK] Description generated: {description}")
    print("\nSmolVLM2 is working correctly!")
except Exception as e:
    print(f"[ERROR] {e}")
    print("\nSmolVLM2 test failed!")
    sys.exit(1)
