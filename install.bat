@echo off
title Hugo CMS - Install Dependencies
echo ===================================
echo    Hugo CMS - Install Dependencies
echo ===================================
echo.

cd /d "%~dp0"

echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found
    echo Please install Node.js v18+ from https://nodejs.org/
    start https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js OK

echo Checking Rust...
rustc --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Rust not found
    echo Please install Rust from https://rustup.rs/
    start https://rustup.rs/
    pause
    exit /b 1
)
echo Rust OK

echo Checking Hugo...
hugo version >nul 2>&1
if errorlevel 1 (
    echo WARNING: Hugo not found
    echo Install Hugo: winget install Hugo.Hugo.Extended
    echo.
    choice /C YN /M "Continue anyway"
    if errorlevel 2 exit /b 1
) else (
    echo Hugo OK
)

echo.
echo Installing npm dependencies...
call npm install

echo.
echo Installing Tauri CLI...
cargo install tauri-cli --locked

echo.
echo ===================================
echo Installation complete!
echo Run start.bat to launch
echo ===================================
pause
