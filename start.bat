@echo off
echo ========================================
echo   Shotlister - Starting Development Server
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, restart this script.
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules\" (
    echo ERROR: Dependencies not installed!
    echo.
    echo Please run install.bat first to install dependencies.
    echo.
    pause
    exit /b 1
)

REM Check if port 3000 is already in use
netstat -ano | findstr ":3000.*LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo WARNING: Port 3000 is already in use!
    echo.
    echo Stopping existing servers...
    npm run stop
    timeout /t 2 /nobreak >nul 2>nul
    echo.
)

echo Starting the development server...
echo.
echo Once started, open your browser to:
echo   http://localhost:3000
echo.
echo Press Ctrl+C to stop the server, or run stop.bat
echo.
echo ========================================
echo.

npm run dev:managed
