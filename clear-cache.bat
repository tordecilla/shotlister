@echo off
echo ========================================
echo   Clearing Upload Cache
echo ========================================
echo.

if exist "uploads\" (
    echo Removing uploads directory...
    rmdir /s /q "uploads"
    echo Done!
) else (
    echo No uploads directory found.
)

echo.
echo Cache cleared. Ready for fresh upload.
echo.
pause
