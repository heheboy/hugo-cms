@echo off
title Hugo CMS Launcher
echo ===================================
echo    Hugo CMS Launcher
echo ===================================
echo.
echo Please select an option:
echo.
echo  [1] Install dependencies (first time)
echo  [2] Start development server
echo  [3] Build production version
echo  [4] Exit
echo.
echo ===================================
set /p choice=Enter option (1-4):

if "%choice%"=="1" goto install
if "%choice%"=="2" goto start
if "%choice%"=="3" goto build
if "%choice%"=="4" exit /b 0

echo Invalid option
pause
exit /b 1

:install
call install.bat
goto end

:start
call start.bat
goto end

:build
call build.bat
goto end

:end
