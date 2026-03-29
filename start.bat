@echo off
title Hugo CMS - Start Development
echo ===================================
echo    Hugo CMS - Start Development
echo ===================================
echo.

echo [1/3] Checking environment...
if not exist "package.json" (
    echo ERROR: package.json not found
    echo Please run this script from hugo-cms folder
    pause
    exit /b 1
)

echo [2/3] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found
    pause
    exit /b 1
)
node --version

echo [3/3] Checking Rust...
rustc --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Rust not found
    pause
    exit /b 1
)
rustc --version

echo.
echo ===================================
echo Environment OK!
echo ===================================
echo.

if not exist "node_modules" (
    echo Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies
        pause
        exit /b 1
    )
    echo Dependencies installed!
    echo.
)

echo Starting Hugo CMS...
echo First startup may take a few minutes to compile Rust backend...
echo.
echo Press Ctrl+C to stop server
echo ===================================
echo.

cargo tauri dev

if errorlevel 1 (
    echo.
    echo cargo tauri failed, trying npm...
    npm run tauri:dev
)

pause
