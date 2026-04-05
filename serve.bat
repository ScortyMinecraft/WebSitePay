@echo off
setlocal
cd /d "%~dp0"
echo Starting local server on http://localhost:8000
echo Press Ctrl+C to stop.
python -m http.server 8000
