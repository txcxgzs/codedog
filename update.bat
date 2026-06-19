@echo off
chcp 65001 >/dev/null

echo 📦 CodeDog 更新脚本
echo ====================

:: 检查是否在 git 仓库中
git rev-parse --git-dir >/dev/null 2>&1
if errorlevel 1 (
    echo ❌ 当前目录不是 git 仓库
    pause
    exit /b 1
)

:: 备份当前版本
echo 💾 备份当前版本...
set BACKUP_DIR=backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%
mkdir "%BACKUP_DIR%" 2>/dev/null
xcopy data "%BACKUP_DIR%\data" /E /I /Y >/dev/null 2>&1
xcopy uploads "%BACKUP_DIR%\uploads" /E /I /Y >/dev/null 2>&1
echo 备份已保存到: %BACKUP_DIR%

:: 拉取最新代码
echo 📥 拉取最新代码...
git fetch origin
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
git pull origin %CURRENT_BRANCH%

:: 重新构建并重启
echo 🔨 重新构建...
docker compose build

echo 🔄 重启服务...
docker compose down
docker compose up -d

echo.
echo ✅ 更新完成！
echo.
echo 如需回滚，执行：
echo   xcopy %BACKUP_DIR%\data data /E /I /Y
echo   xcopy %BACKUP_DIR%\uploads uploads /E /I /Y
echo   docker compose restart
pause
