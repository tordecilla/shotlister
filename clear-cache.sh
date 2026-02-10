#!/bin/bash

echo "========================================"
echo "  Clearing Upload Cache"
echo "========================================"
echo ""

if [ -d "uploads" ]; then
    echo "Removing uploads directory..."
    rm -rf uploads
    echo "Done!"
else
    echo "No uploads directory found."
fi

echo ""
echo "Cache cleared. Ready for fresh upload."
echo ""
