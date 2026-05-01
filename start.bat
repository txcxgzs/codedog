@echo off
chcp 65001 >nul
title 编程狗社区 - 启动脚本

echo.
echo ========================================
echo   编程狗社区 - 启动脚本
echo ========================================
echo.

:: 检查是否已安装依赖
if not exist server\node_modules (
    echo [警告] 未检测到服务端依赖，请先运行 install.bat
    pause
    exit /b 1
)

if not exist client\node_modules (
    echo [警告] 未检测到客户端依赖，请先运行 install.bat
    pause
    exit /b 1
)

echo [启动] 正在启动服务端...
start "编程狗社区-服务端" cmd /k "cd /d %~dp0server && node app.js"

echo [等待] 等待服务端启动...
timeout /t 3 /nobreak >nul

echo [启动] 正在启动客户端...
start "编程狗社区-客户端" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo ========================================
echo   启动完成！
echo ========================================
echo.
echo 访问地址：
echo   前端: http://localhost:8080
echo   后端: http://localhost:3001
echo.
echo 首次使用请访问后台进行初始化：
echo   http://localhost:8080/admin
echo.
echo 按任意键打开浏览器访问...
pause >nul
start http://localhost:8080
