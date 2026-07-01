@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

echo CodeDog 一键部署脚本
echo ======================

:: 检查 Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo 错误：未安装 Docker Desktop，请先安装 Docker Desktop
    pause
    exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
    echo 错误：Docker Compose 不可用，请升级 Docker Desktop
    pause
    exit /b 1
)

:: 创建 .env 配置文件
if not exist .env (
    echo 正在创建 .env 环境配置...
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
    echo .env 创建完成
) else (
    echo 使用现有 .env 配置
)

:: 修复旧版本安装器生成的不完整 .env
findstr /B /C:"DB_PATH=" .env >nul 2>&1 || echo DB_PATH=/app/server/data/database.sqlite>> .env
findstr /B /C:"JWT_EXPIRES_IN=" .env >nul 2>&1 || echo JWT_EXPIRES_IN=7d>> .env
findstr /B /C:"CORS_ORIGIN=" .env >nul 2>&1 || echo CORS_ORIGIN=http://localhost:3001>> .env
findstr /R /B /C:"JWT_SECRET=................................" .env >nul 2>&1 || call :append_secret JWT_SECRET 64
findstr /R /B /C:"SESSION_SECRET=................................" .env >nul 2>&1 || call :append_secret SESSION_SECRET 32

:: 创建数据目录和上传目录
if not exist data mkdir data
if not exist uploads mkdir uploads
if not exist uploads\avatars mkdir uploads\avatars
if not exist uploads\works mkdir uploads\works

:: 构建并启动
echo 正在构建 Docker 镜像...
docker compose build --no-cache
if errorlevel 1 goto fail

echo 正在启动服务...
docker compose down
docker compose up -d
if errorlevel 1 goto fail

:: 等待服务启动
echo 正在等待服务启动...
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
    echo 错误：服务未能正常启动。最近日志如下：
    docker compose ps
    docker compose logs --tail=120 codedog
    pause
    exit /b 1
)

:: 安装管理工具
echo 正在安装 codedog 管理工具...
if exist "%~dp0install-cli.bat" (
    call "%~dp0install-cli.bat"
)

echo.
echo 部署完成！
echo 访问地址：http://localhost:3001
echo 后台地址：http://localhost:3001/admin
echo 管理工具：codedog
echo.
pause
exit /b 0

:append_secret
for /f %%i in ('powershell -NoProfile -Command "[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(%2)).ToLower()"') do set SECRET_VALUE=%%i
echo %1=!SECRET_VALUE!>> .env
exit /b 0

:fail
echo 错误：部署失败。最近日志如下：
docker compose logs --tail=120 codedog
pause
exit /b 1
