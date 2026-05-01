@echo off
chcp 65001 >nul
title 编程狗社区 - 停止脚本

echo.
echo ========================================
echo   编程狗社区 - 停止脚本
echo ========================================
echo.

echo [停止] 正在停止Node.js进程...
taskkill /f /im node.exe >nul 2>nul

echo [完成] 已停止所有Node.js进程
echo.
pause
