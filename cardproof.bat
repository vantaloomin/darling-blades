@echo off
rem Darling Blades card proof sheet (non-production, developer-only).
rem Builds the standalone previewer and serves it on http://localhost:5175,
rem then opens it in the default browser. Ctrl+C in this window stops it.
setlocal
cd /d "%~dp0"

echo Building the card proof sheet...
call npm run cardproof:build
if errorlevel 1 (
  echo Build failed - see output above.
  exit /b 1
)

rem Open the browser a moment after the preview server starts listening.
start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:5175"

echo Serving on http://localhost:5175 (Ctrl+C to stop)...
call npx vite preview --config vite.cardproof.config.ts --host localhost --port 5175
