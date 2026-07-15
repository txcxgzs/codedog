@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================================================
:: CodeDog 更新脚本 (Windows)
:: 修复: 1) 备份同时包含 data/ 和 server/data/ 两种部署模式的数据库
::       2) 自动检测 docker compose vs docker-compose
::       3) 自动检测当前分支,不再硬编码
::       4) 增加更新失败提示
:: ============================================================================

echo 📦 CodeDog 更新脚本
echo ====================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 检查是否在 git 仓库中
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ❌ 当前目录不是 git 仓库
    pause
    exit /b 1
)

:: 检测 Docker Compose 命令（新版 docker compose / 旧版 docker-compose）
set "COMPOSE_CMD="
docker compose version >nul 2>&1 && set "COMPOSE_CMD=docker compose"
if "!COMPOSE_CMD!"=="" (
    docker-compose version >nul 2>&1 && set "COMPOSE_CMD=docker-compose"
)
if "!COMPOSE_CMD!"=="" (
    echo ❌ 未检测到 Docker Compose,请先安装
    pause
    exit /b 1
)
echo [OK] Docker Compose: !COMPOSE_CMD!

:: 备份当前版本
echo.
echo 💾 备份当前版本...
set BACKUP_DIR=backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%
mkdir "%BACKUP_DIR%" 2>nul

:: 修复: 备份两种部署模式的数据库目录
::   Docker 模式: data/ (docker-compose.yml 挂载)
::   本地/宝塔模式: server/data/ (server 默认路径)
if exist "%SCRIPT_DIR%data" (
    xcopy data "%BACKUP_DIR%\data" /E /I /Y >nul 2>&1
    echo   已备份: data/
)
if exist "%SCRIPT_DIR%server\data" (
    xcopy server\data "%BACKUP_DIR%\server-data" /E /I /Y >nul 2>&1
    echo   已备份: server/data/
)
if exist "%SCRIPT_DIR%uploads" (
    xcopy uploads "%BACKUP_DIR%\uploads" /E /I /Y >nul 2>&1
    echo   已备份: uploads/
)
if exist "%SCRIPT_DIR%.env" (
    copy .env "%BACKUP_DIR%\.env" >nul 2>&1
    echo   已备份: .env
)
echo 备份已保存到: %BACKUP_DIR%

:: 拉取最新代码
echo.
echo 📥 拉取最新代码...
git fetch origin
if errorlevel 1 (
    echo ⚠️ git fetch 失败,请检查网络
    pause
    exit /b 1
)

:: 修复: 自动检测当前分支,不再硬编码
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if "!CURRENT_BRANCH!"=="" (
    echo ⚠️ 无法检测当前分支,默认使用 main
    set CURRENT_BRANCH=main
)
echo   当前分支: !CURRENT_BRANCH!
git pull origin !CURRENT_BRANCH!
if errorlevel 1 (
    echo.
    echo ❌ git pull 失败! 更新已中止
    echo 可能原因: 本地有未提交改动 / 网络问题 / 合并冲突
    echo 处理方法:
    echo   1) 备份本地改动后执行: git stash
    echo   2) 重新运行此更新脚本
    echo.
    echo 服务当前已停止,如需启动可执行: !COMPOSE_CMD! up -d
    pause
    exit /b 1
)

:: 重新构建并重启
echo.
echo 🔨 重新构建（复用 Docker 缓存）...
:: 普通更新复用依赖层；缓存异常时再手动执行 build --no-cache。
!COMPOSE_CMD! build
if errorlevel 1 (
    echo ❌ Docker 构建失败
    pause
    exit /b 1
)

echo.
echo 🔄 重启服务...
!COMPOSE_CMD! down
!COMPOSE_CMD! up -d

:: 等待服务启动
echo.
echo ⏳ 等待服务启动...
set SERVICE_READY=0
for /l %%i in (1,1,30) do (
    if "!SERVICE_READY!"=="0" (
        curl -s http://localhost:3001/api/health >nul 2>&1
        if !errorlevel!==0 (
            set SERVICE_READY=1
            echo   服务已就绪
        ) else (
            echo   等待中... %%i/30
            timeout /t 2 /nobreak >nul
        )
    )
)
if "!SERVICE_READY!"=="0" (
    echo ⚠️ 服务未在 60 秒内响应,请检查日志: !COMPOSE_CMD! logs -f
)

echo.
echo ✅ 更新完成！
echo.
echo 如需回滚，执行：
echo   xcopy %BACKUP_DIR%\data data /E /I /Y
echo   xcopy %BACKUP_DIR%\uploads uploads /E /I /Y
echo   !COMPOSE_CMD! restart
pause
