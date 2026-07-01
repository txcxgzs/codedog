@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

echo CodeDog Deployment Script
echo =========================

:: Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Desktop not installed
    pause
    exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Compose not available. Please update Docker Desktop.
    pause
    exit /b 1
)

:: Create .env if not exists
if not exist .env (
    echo Creating .env configuration...
    echo SERVER_PORT=3001> .env
    echo DB_TYPE=sqlite>> .env
    echo DB_PATH=/app/server/data/database.sqlite>> .env
    echo DB_HOST=localhost>> .env
    echo DB_PORT=3306>> .env
    echo DB_NAME=coding_dog>> .env
    echo DB_USER=root>> .env
    echo DB_PASSWORD=>> .env
    echo JWT_EXPIRES_IN=7d>> .env
    echo CORS_ORIGIN=http://localhost:3001>> .env
    call :append_secret JWT_SECRET 64
    call :append_secret SESSION_SECRET 32
    echo .env created
) else (
    echo Using existing .env
)

:: Repair incomplete .env files from older installers.
findstr /B /C:"DB_PATH=" .env >nul 2>&1 || echo DB_PATH=/app/server/data/database.sqlite>> .env
findstr /B /C:"JWT_EXPIRES_IN=" .env >nul 2>&1 || echo JWT_EXPIRES_IN=7d>> .env
findstr /B /C:"CORS_ORIGIN=" .env >nul 2>&1 || echo CORS_ORIGIN=http://localhost:3001>> .env
findstr /R /B /C:"JWT_SECRET=................................" .env >nul 2>&1 || call :append_secret JWT_SECRET 64
findstr /R /B /C:"SESSION_SECRET=................................" .env >nul 2>&1 || call :append_secret SESSION_SECRET 32

:: Create directories
if not exist data mkdir data
if not exist uploads mkdir uploads
if not exist uploads\avatars mkdir uploads\avatars
if not exist uploads\works mkdir uploads\works

:: Build and start
echo Building Docker image...
docker compose build --no-cache
if errorlevel 1 goto fail

echo Starting service...
docker compose down
docker compose up -d
if errorlevel 1 goto fail

:: Wait for startup
echo Waiting for service...
set READY=0
for /L %%i in (1,1,60) do (
    curl -fs http://localhost:3001/api/health >nul 2>&1
    if not errorlevel 1 (
        set READY=1
        goto service_ready
    )
    timeout /t 2 /nobreak >nul
)

:service_ready
if not "%READY%"=="1" (
    echo ERROR: Service did not become healthy. Recent logs:
    docker compose ps
    docker compose logs --tail=120 codedog
    pause
    exit /b 1
)

:: Install CLI
echo Installing management tool...
if exist "%~dp0install-cli.bat" (
    call "%~dp0install-cli.bat"
)

echo.
echo Deployment Complete!
echo URL: http://localhost:3001
echo Admin: http://localhost:3001/admin
echo Tool: codedog
echo.
pause
exit /b 0

:append_secret
for /f %%i in ('powershell -NoProfile -Command "[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(%2)).ToLower()"') do set SECRET_VALUE=%%i
echo %1=!SECRET_VALUE!>> .env
exit /b 0

:fail
echo ERROR: Deployment failed. Recent logs:
docker compose logs --tail=120 codedog
pause
exit /b 1
