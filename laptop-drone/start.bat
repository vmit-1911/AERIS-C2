@echo off
title Virtual Drone GCS & ASTM F3411 Telemetry Transmitter
color 0B

echo =========================================================
echo   STARTING VIRTUAL DRONE GCS & TELEMETRY TRANSMITTER    
echo =========================================================
echo [1/2] Launching Python 3.11+ ASTM Transmitter on ws://0.0.0.0:8765...
start "GCS Backend Telemetry Daemon" cmd /k "python drone_transmitter.py"

echo [2/2] Launching Cockpit Web UI on http://localhost:5173...
start "GCS Cockpit Frontend" cmd /k "npm run dev"

echo.
echo =========================================================
echo   SYSTEM ONLINE:
echo   - Cockpit Web UI:        http://localhost:5173
echo   - WebSocket Transmitter: ws://0.0.0.0:8765
echo =========================================================
echo.
pause
