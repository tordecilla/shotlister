@echo off
echo ========================================
echo   Shotlister - Installation
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python is not installed!
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Found:
node --version
python --version
echo.

REM Ask user about NVIDIA GPU
echo ========================================
echo   GPU Configuration
echo ========================================
echo.
echo Do you have an NVIDIA GPU and want to enable CUDA acceleration?
echo   [Y] Yes - Install with CUDA support (much faster processing)
echo   [N] No  - Install CPU-only version
echo.
set /p GPU_CHOICE="Enter choice (Y/N): "

if /i "%GPU_CHOICE%"=="Y" (
    set INSTALL_CUDA=1
    echo.
    echo Installing with CUDA support...
) else (
    set INSTALL_CUDA=0
    echo.
    echo Installing CPU-only version...
)
echo.

REM Install PyTorch with appropriate backend
echo Installing Python dependencies...
if "%INSTALL_CUDA%"=="1" (
    echo Installing PyTorch with CUDA 12.4 support...
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
) else (
    echo Installing PyTorch CPU-only...
    pip install torch torchvision
)

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PyTorch installation failed!
    pause
    exit /b 1
)

REM Install other dependencies
echo.
echo Installing other dependencies...
pip install transformers pillow accelerate scenedetect[opencv] num2words transnetv2-pytorch

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)

REM Install Node.js dependencies
echo.
echo Installing Node.js dependencies...
npm install

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js installation failed!
    pause
    exit /b 1
)

REM Write config file based on user's GPU choice
echo.
echo Writing configuration...
if "%INSTALL_CUDA%"=="1" (
    echo {"useCuda": true, "vlmModel": "HuggingFaceTB/SmolVLM2-500M-Video-Instruct", "sceneDetector": "transnetv2"} > shotlister.config.json
) else (
    echo {"useCuda": false, "vlmModel": "HuggingFaceTB/SmolVLM2-500M-Video-Instruct", "sceneDetector": "pyscenedetect"} > shotlister.config.json
)

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
if "%INSTALL_CUDA%"=="1" (
    echo GPU acceleration enabled! Processing will be much faster.
) else (
    echo CPU-only mode. Processing will be slower but works on any computer.
)
echo.
echo Configuration saved to shotlister.config.json
echo You can edit this file to change CUDA or model settings.
echo.
echo To start the app, run: start.bat
echo Or manually: npm run dev
echo.
pause
