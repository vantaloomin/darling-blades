@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

echo Building Darling Blades for production...
call npm run build --host
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo Starting production preview server...
call npm run preview

pause
