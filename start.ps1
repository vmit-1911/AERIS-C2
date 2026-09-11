# ====================================================================
# Virtual Drone GCS & ASTM F3411 Remote ID Telemetry Launcher
# ====================================================================

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  STARTING VIRTUAL DRONE GCS & TELEMETRY TRANSMITTER    " -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Starting Python ASTM F3411-22a Telemetry Transmitter on ws://0.0.0.0:8765..." -ForegroundColor Yellow

$backendProcess = Start-Process -FilePath "python" -ArgumentList "drone_transmitter.py" -PassThru

Write-Host "Starting Cockpit Web UI on http://localhost:5173..." -ForegroundColor Yellow
$frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru

Write-Host "`nSystem Online!" -ForegroundColor Green
Write-Host "  -> Cockpit UI: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  -> Telemetry WebSocket: ws://0.0.0.0:8765" -ForegroundColor Cyan
Write-Host "`nPress CTRL+C or close the window to stop.`n" -ForegroundColor DarkGray

try {
    # Keep script alive
    Wait-Process -Id $backendProcess.Id, $frontendProcess.Id
} finally {
    Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue
}
