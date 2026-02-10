#!/bin/bash

echo "========================================"
echo "  Shotlister - Installation"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed!"
    echo ""
    echo "Please install Python from: https://www.python.org/downloads/"
    exit 1
fi

echo "Found:"
node --version
python3 --version
echo ""

# Ask user about NVIDIA GPU
echo "========================================"
echo "  GPU Configuration"
echo "========================================"
echo ""
echo "Do you have an NVIDIA GPU and want to enable CUDA acceleration?"
echo "  [Y] Yes - Install with CUDA support (much faster processing)"
echo "  [N] No  - Install CPU-only version"
echo ""
read -p "Enter choice (Y/N): " GPU_CHOICE

if [[ "$GPU_CHOICE" =~ ^[Yy]$ ]]; then
    INSTALL_CUDA=1
    echo ""
    echo "Installing with CUDA support..."
else
    INSTALL_CUDA=0
    echo ""
    echo "Installing CPU-only version..."
fi
echo ""

# Install PyTorch with appropriate backend
echo "Installing Python dependencies..."
if [ $INSTALL_CUDA -eq 1 ]; then
    echo "Installing PyTorch with CUDA 12.4 support..."
    pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu124
else
    echo "Installing PyTorch CPU-only..."
    pip3 install torch torchvision
fi

if [ $? -ne 0 ]; then
    echo "ERROR: PyTorch installation failed!"
    exit 1
fi

# Install other dependencies
echo ""
echo "Installing other dependencies..."
pip3 install transformers pillow accelerate "scenedetect[opencv]" num2words transnetv2-pytorch

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies!"
    exit 1
fi

# Install Node.js dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "ERROR: Node.js installation failed!"
    exit 1
fi

# Write config file based on user's GPU choice
echo ""
echo "Writing configuration..."
if [ $INSTALL_CUDA -eq 1 ]; then
    cat > shotlister.config.json << 'CONF'
{
  "useCuda": true,
  "vlmModel": "HuggingFaceTB/SmolVLM2-500M-Video-Instruct",
  "sceneDetector": "transnetv2"
}
CONF
else
    cat > shotlister.config.json << 'CONF'
{
  "useCuda": false,
  "vlmModel": "HuggingFaceTB/SmolVLM2-500M-Video-Instruct",
  "sceneDetector": "pyscenedetect"
}
CONF
fi

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
if [ $INSTALL_CUDA -eq 1 ]; then
    echo "GPU acceleration enabled! Processing will be much faster."
else
    echo "CPU-only mode. Processing will be slower but works on any computer."
fi
echo ""
echo "Configuration saved to shotlister.config.json"
echo "You can edit this file to change CUDA or model settings."
echo ""
echo "To start the app, run: ./start.sh"
echo "Or manually: npm run dev"
echo ""
