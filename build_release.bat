@echo off
set ANDROID_HOME=C:\Users\Pierre-Louis\AppData\Local\Android\Sdk
echo.
echo ======================================
echo   Sillage - Build Release APK
echo ======================================
echo.
echo [%time%] Demarrage Gradle...
echo.
C:\dev\ParfumScan_react\android\gradlew.bat -p C:\dev\ParfumScan_react\android assembleRelease
if %errorlevel%==0 (
    echo.
    echo ======================================
    echo   BUILD REUSSI !
    echo   APK: android\app\build\outputs\apk\release\app-release.apk
    echo ======================================
) else (
    echo.
    echo ======================================
    echo   BUILD ECHOUE (code %errorlevel%)
    echo ======================================
)
pause
