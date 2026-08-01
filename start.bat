@echo off
setlocal enabledelayedexpansion
cd /d C:\dev\ParfumScan_react
set ANDROID_HOME=C:\Users\Pierre-Louis\AppData\Local\Android\Sdk
set PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%PATH%

echo.
echo ======================================
echo   Sillage - Dev
echo ======================================
echo.
echo   start.bat          Metro rapide (cache conserve)
echo   start.bat clear    Metro + cache vide (si code pas pris en compte)
echo   start.bat build    Gradle complet + install + Metro
echo.

:: --- 1. Kill old Metro / node (prevents port 8081 conflicts) ---
echo [~] Killing old Metro/node processes...
taskkill /f /im node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: --- 2. Clean ADB ---
echo [~] Resetting ADB...
adb kill-server >nul 2>&1
timeout /t 1 /nobreak >nul
adb start-server >nul 2>&1
timeout /t 1 /nobreak >nul

:: --- 3. Check emulator ---
echo [~] Checking emulator...
set DEVICE_FOUND=0
for /f "tokens=1,2" %%a in ('adb devices 2^>nul ^| findstr /r "device$"') do (
    set DEVICE_FOUND=1
    set DEVICE_ID=%%a
)

if %DEVICE_FOUND%==1 (
    echo [ok] Emulator connected: %DEVICE_ID%
    goto :check_mode
)

:: --- 4. Start emulator ---
echo [^>] Starting emulator Pixel_7_Pro...
start "" "%ANDROID_HOME%\emulator\emulator.exe" -avd Pixel_7_Pro -no-snapshot-load >nul 2>&1

echo [..] Waiting for device (60s max)...
set /a TRIES=0
:wait_device
adb wait-for-device >nul 2>&1
for /f "delims=" %%i in ('adb shell getprop sys.boot_completed 2^>nul') do (
    if "%%i"=="1" goto :booted
)
set /a TRIES+=1
if %TRIES% geq 30 (
    echo [!] Emulator boot timeout. Trying anyway...
    goto :check_mode
)
timeout /t 2 /nobreak >nul
goto :wait_device

:booted
echo [ok] Emulator booted.

:: --- 5. Mode selection ---
:check_mode
if "%1"=="build" goto :build
if "%1"=="--build" goto :build
if "%1"=="clear" goto :clear
if "%1"=="--clear" goto :clear

echo.
echo   Mode: FAST (Metro, cache conserve)
echo.
echo [^>] Starting Metro...
npx expo start --dev-client
goto :end

:clear
echo.
echo   Mode: CLEAR (Metro, cache vide)
echo.
echo [~] Clearing Metro cache...
if exist "node_modules\.cache" rd /s /q "node_modules\.cache" >nul 2>&1
if exist ".expo\dev" rd /s /q ".expo\dev" >nul 2>&1
echo [ok] Cache cleared.
echo.
echo [^>] Starting Metro...
npx expo start --dev-client --clear
goto :end

:build
echo.
echo   Mode: BUILD (Gradle + install + Metro)
echo.
echo [~] Clearing Metro cache...
if exist "node_modules\.cache" rd /s /q "node_modules\.cache" >nul 2>&1
echo [^>] Building and installing...
npx expo run:android
goto :end

:end
pause
