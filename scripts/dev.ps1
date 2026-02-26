# CyberForge Development Script
# Runs FastAPI backend + Vite dev server simultaneously

Write-Host "Starting CyberForge Development Environment..." -ForegroundColor Cyan

# Start FastAPI backend
$backend = Start-Process -NoNewWindow -PassThru -FilePath "python" -ArgumentList "-m", "backend.main" -WorkingDirectory $PSScriptRoot/..
Write-Host "Backend started (PID: $($backend.Id))" -ForegroundColor Green

# Start Vite dev server
$frontend = Start-Process -NoNewWindow -PassThru -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $PSScriptRoot/..
Write-Host "Frontend started (PID: $($frontend.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "CyberForge is running:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8008" -ForegroundColor White
Write-Host "  Health:   http://localhost:8008/api/health" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all processes" -ForegroundColor Yellow

try {
    Wait-Process -Id $backend.Id
} finally {
    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
    Write-Host "All processes stopped" -ForegroundColor Red
}
