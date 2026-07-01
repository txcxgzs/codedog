@echo off
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

:: Create .env if not exists
if not exist .env (
    echo Creating .env configuration...
    
    echo SERVER_PORT=3001> .env
    echo DB_TYPE=sqlite>> .env
    echo JWT_EXPIRES_IN=7d>> .env
    echo CORS_ORIGIN=http://localhost:3001>> .env
    
    :: Generate JWT_SECRET
    for /f %%i in ('powershell -NoProfile -Command "[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(64)).ToLower()"') do set JWT_SECRET=%%i
    echo JWT_SECRET=%JWT_SECRET%>> .env
    
    :: Generate SESSION_SECRET
    for /f %%i in ('powershell -NoProfile -Command "[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()"') do set SESSION_SECRET=%%i
    echo SESSION_SECRET=%SESSION_SECRET%>> .env
    
    echo .env created
) else (
    echo Using existing .env
)

:: Create directories
if not exist data mkdir data
if not exist uploads mkdir uploads
if not exist uploads\avatars mkdir uploads\avatars
if not exist uploads\works mkdir uploads\works

:: Build and start
echo Building Docker image...
docker compose build --no-cache

echo Starting service...
docker compose up -d

:: Wait for startup
echo Waiting for service...
timeout /t 10 /nobreak >nul

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
