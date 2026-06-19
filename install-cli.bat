@echo off
chcp 65001 >nul

:: CodeDog CLI 安装脚本 (Windows)
echo 📦 安装 CodeDog CLI 工具...
echo.

set "SCRIPT_DIR=%~dp0"
set "CLI_NAME=codedog.bat"
set "INSTALL_DIR=%USERPROFILE%\AppData\Local\Microsoft\WindowsApps"

:: 创建执行脚本
echo @echo off > "%INSTALL_DIR%\%CLI_NAME%"
echo chcp 65001 ^>nul >> "%INSTALL_DIR%\%CLI_NAME%"
echo cd /d "%SCRIPT_DIR%" >> "%INSTALL_DIR%\%CLI_NAME%"
echo call "%SCRIPT_DIR%codedog.bat" %%* >> "%INSTALL_DIR%\%CLI_NAME%"

:: 验证安装
where %CLI_NAME% >nul 2>&1
if %errorlevel%==0 (
    echo ✅ 安装成功！
    echo.
    echo 使用方法：
    echo   在任意终端输入: %CLI_NAME%
    echo.
    echo 功能菜单：
    echo   1) 查看系统状态
    echo   2) 查看服务日志
    echo   3) 检查更新
    echo   4) 执行更新
    echo   5) 修复问题
    echo   6) 数据库管理
    echo   7) 敏感词管理
    echo   8) 系统配置
    echo   9) 清理缓存
) else (
    echo ⚠ 安装可能未完全成功
    echo 请尝试以下方法：
    echo   1. 将 %SCRIPT_DIR% 添加到 PATH 环境变量
    echo   2. 或直接运行: %SCRIPT_DIR%codedog.bat
)

echo.
pause
