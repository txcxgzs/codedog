@echo off
chcp 65001 >/dev/null

echo 🚀 CodeDog 部署脚本
echo ====================

:: 检查 Docker
docker --version >/dev/null 2>&1
if errorlevel 1 (
    echo ❌ 请先安装 Docker Desktop
    pause
    exit /b 1
)

:: 创建数据目录
if not exist data mkdir data
if not exist uploads mkdir uploads
if not exist uploads\avatars mkdir uploads\avatars
if not exist uploads\works mkdir uploads\works

:: 构建并启动
echo 📦 构建 Docker 镜像...
docker compose build

echo 🚀 启动服务...
docker compose up -d

echo.
echo ✅ 部署完成！
echo 访问地址: http://localhost:3001
echo.
echo 常用命令：
echo   查看日志: docker compose logs -f
echo   停止服务: docker compose down
echo   重启服务: docker compose restart
pause
