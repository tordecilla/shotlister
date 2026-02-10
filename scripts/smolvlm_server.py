#!/usr/bin/env python3
"""
SmolVLM2 HTTP server - keeps model loaded in memory for fast inference
"""
import sys
import json
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

try:
    from transformers import AutoProcessor, AutoModelForImageTextToText
    from PIL import Image
    import torch
except ImportError:
    print("Error: Required packages not installed. Run: pip install transformers pillow torch torchvision", file=sys.stderr)
    sys.exit(1)

# Model configuration
MODEL_ID = "HuggingFaceTB/SmolVLM-Instruct"
device = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Loading SmolVLM2 model on {device}...", file=sys.stderr)
processor = AutoProcessor.from_pretrained(MODEL_ID)
model = AutoModelForImageTextToText.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    low_cpu_mem_usage=True,
).to(device)
print(f"Model loaded successfully!", file=sys.stderr)

def describe_image(image_path: str, max_tokens: int = 50) -> str:
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
                    {"type": "text", "text": "Describe this scene in one concise sentence (10-15 words max)."}
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

class SmolVLMHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default logging
        pass

    def do_POST(self):
        if self.path == '/describe':
            try:
                # Read request body
                content_length = int(self.headers['Content-Length'])
                body = self.rfile.read(content_length)
                data = json.loads(body.decode('utf-8'))

                image_path = data.get('image_path')
                if not image_path or not Path(image_path).exists():
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Invalid image path"}).encode())
                    return

                # Generate description
                description = describe_image(image_path)

                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"description": description}).encode())

            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ready", "device": device}).encode())
        else:
            self.send_response(404)
            self.end_headers()

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

    server = HTTPServer(('localhost', port), SmolVLMHandler)
    print(f"SmolVLM2 server listening on http://localhost:{port}", file=sys.stderr)
    print(f"Ready to process images!", file=sys.stderr)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...", file=sys.stderr)
        server.shutdown()

if __name__ == "__main__":
    main()
