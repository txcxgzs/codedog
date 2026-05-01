@echo off
chcp 65001 >nul
title 编程狗社区 - 一键安装脚本

:: ========================================
:: 编程狗社区 - Windows一键安装脚本
:: ========================================

echo.
echo ╔════════════════════════════════════════╗
echo ║                                        ║
echo ║      编程狗社区 - 一键安装脚本         ║
echo ║                                        ║
echo ╚════════════════════════════════════════╝
echo.

:: 检查Node.js
echo [1/5] 检查Node.js环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    echo 建议下载LTS版本
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [成功] Node.js版本: %NODE_VERSION%

:: 检查npm
echo.
echo [2/5] 检查npm...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到npm
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [成功] npm版本: %NPM_VERSION%

:: 创建环境配置
echo.
echo [3/5] 创建环境配置...
cd /d "%~dp0"
if not exist server\.env (
    echo 正在创建.env配置文件...
    (
        echo # 服务端口配置
        echo CLIENT_PORT=8080
        echo SERVER_PORT=3001
        echo.
        echo # 数据库配置
        echo # 可选值: sqlite, mysql
        echo DB_TYPE=sqlite
        echo.
        echo # MySQL配置（当DB_TYPE=mysql时使用）
        echo DB_HOST=localhost
        echo DB_PORT=3306
        echo DB_NAME=coding_dog
        echo DB_USER=root
        echo DB_PASSWORD=
        echo.
        echo # JWT配置
        echo JWT_SECRET=please-change-this-to-a-random-string-at-least-64-characters
        echo JWT_EXPIRES_IN=7d
    ) > server\.env
    echo [成功] 已创建 server\.env 配置文件
    echo [提示] 请根据需要修改配置文件
) else (
    echo [跳过] .env文件已存在
)

:: 创建必要目录
if not exist server\uploads\avatars mkdir server\uploads\avatars
if not exist server\uploads\works mkdir server\uploads\works
if not exist server\data mkdir server\data
echo [成功] 目录创建完成

:: 安装服务端依赖
echo.
echo [4/5] 安装服务端依赖...
cd server
if not exist package.json (
    echo [错误] server目录下未找到package.json
    pause
    exit /b 1
)
echo 正在安装服务端依赖，请稍候...
call npm install
if %errorlevel% neq 0 (
    echo [错误] 服务端依赖安装失败
    pause
    exit /b 1
)
echo [成功] 服务端依赖安装完成
cd ..

:: 安装客户端依赖
echo.
echo [5/5] 安装客户端依赖...
cd client
if not exist package.json (
    echo [错误] client目录下未找到package.json
    pause
    exit /b 1
)
echo 正在安装客户端依赖，请稍候...
call npm install
if %errorlevel% neq 0 (
    echo [错误] 客户端依赖安装失败
    pause
    exit /b 1
)
echo [成功] 客户端依赖安装完成
cd ..

:: 完成
echo.
echo ╔════════════════════════════════════════╗
echo ║             安装成功！                 ║
echo ╚════════════════════════════════════════╝
echo.
echo 启动方式：
echo   方式1: 运行 start.bat 启动项目
echo   方式2: 手动启动
echo     - 后端: cd server ^&^& npm run dev
echo     - 前端: cd client ^&^& npm run dev
echo.
echo 访问地址：
echo   前端: http://localhost:8080
echo   后端: http://localhost:3001
echo.
echo 管理员说明: 第一个使用编程猫登录的用户自动成为管理员
echo.
echo 首次使用请访问后台进行初始化：
echo   http://localhost:8080/admin
echo.
pause
