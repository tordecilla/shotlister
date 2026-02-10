#!/bin/bash

echo "========================================"
echo "  Shotlister - Starting Development Server"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "After installation, restart this script."
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "ERROR: Dependencies not installed!"
    echo ""
    echo "Please run ./install.sh first to install dependencies."
    echo ""
    exit 1
fi

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "WARNING: Port 3000 is already in use!"
    echo ""
    echo "Stopping existing servers..."
    npm run stop
    sleep 2
    echo ""
fi

echo "Starting the development server..."
echo ""
echo "Once started, open your browser to:"
echo "  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server, or run ./stop.sh"
echo ""
echo "========================================"
echo ""

npm run dev:managed
