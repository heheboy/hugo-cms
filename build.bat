@echo off
title Hugo CMS - Build Production
echo ===================================
echo    Hugo CMS - Build Production
echo ===================================
echo.

if not exist "package.json" (
    echo ERROR: package.json not found
    pause
    exit /b 1
)

echo [1/2] Installing dependencies if needed...
if not exist "node_modules" (
    call npm install
)

echo [2/2] Building production version...
echo This may take a few minutes...
echo.

cargo tauri build

echo.
echo ===================================
if errorlevel 1 (
    echo Build FAILED!
) else (
    echo Build SUCCESS!
    echo Output: src-tauri\target\release\
)
echo ===================================
pause
