@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: CodeDog 管理工具箱 (Windows)
set "VERSION=1.0.0"
set "SCRIPT_DIR=%~dp0"

:main
cls
echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║           CodeDog 管理工具箱 v%VERSION%            ║
echo  ╚═══════════════════════════════════════════════════╝
echo.
echo  请选择操作：
echo.
echo    1) 📊 查看系统状态
echo    2) 📝 查看服务日志
echo    3) 🔄 检查更新
echo    4) ⬆️  执行更新
echo    5) 🔧 修复问题
echo    6) 🗄️  数据库管理
echo    7) 🛡️  敏感词管理
echo    8) ⚙️  系统配置
echo    9) 🧹 清理缓存
echo    0) 退出
echo.
set /p choice="请输入选项 [0-9]: "

if "%choice%"=="1" goto status
if "%choice%"=="2" goto logs
if "%choice%"=="3" goto check_update
if "%choice%"=="4" goto update
if "%choice%"=="5" goto fix
if "%choice%"=="6" goto database
if "%choice%"=="7" goto sensitive
if "%choice%"=="8" goto config
if "%choice%"=="9" goto clean
if "%choice%"=="0" goto exit
goto main

:status
cls
echo.
echo ═══ 系统状态 ═══
echo.

:: 检查 Docker
docker --version >nul 2>&1
if %errorlevel%==0 (
    echo ✓ Docker 已安装
    docker ps --filter "name=codedog" --format "table {{.ID}}\t{{.Status}}\t{{.Ports}}" 2>nul
) else (
    echo ⚠ Docker 未安装
)

echo.

:: 检查后端服务
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel%==0 (
    echo ✓ 后端服务运行正常
) else (
    echo ✗ 后端服务未响应
)

:: 检查数据库
if exist "%SCRIPT_DIR%data\database.sqlite" (
    echo ✓ 数据库文件存在
) else (
    echo ⚠ 数据库文件不存在
)

echo.
pause
goto main

:logs
cls
echo.
echo ═══ 服务日志 ═══
echo.
echo 1) 实时日志
echo 2) 最近 50 行
echo 3) 错误日志
echo.
set /p log_choice="请选择 [1-3]: "

if "%log_choice%"=="1" docker compose -f "%SCRIPT_DIR%docker-compose.yml" logs -f
if "%log_choice%"=="2" docker compose -f "%SCRIPT_DIR%docker-compose.yml" logs --tail=50
if "%log_choice%"=="3" docker compose -f "%SCRIPT_DIR%docker-compose.yml" logs --tail=100

echo.
pause
goto main

:check_update
cls
echo.
echo ═══ 检查更新 ═══
echo.

cd /d "%SCRIPT_DIR%"

:: 获取当前版本
for /f "tokens=*" %%i in ('git rev-parse --short HEAD 2^>nul') do set CURRENT_COMMIT=%%i
for /f "tokens=*" %%i in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%i

echo 当前版本: %CURRENT_COMMIT% (%CURRENT_BRANCH%)

:: 获取远程更新
echo 正在检查远程更新...
git fetch origin 2>nul

:: 比较差异
for /f "tokens=*" %%i in ('git rev-parse HEAD') do set LOCAL=%%i
for /f "tokens=*" %%i in ('git rev-parse "origin/%CURRENT_BRANCH%" 2^>nul') do set REMOTE=%%i

if "%LOCAL%"=="%REMOTE%" (
    echo ✓ 已是最新版本！
) else (
    echo ⚠ 有新版本可用
    echo.
    echo 最近更新:
    git log HEAD.."origin/%CURRENT_BRANCH%" --oneline --no-merges 2>nul | head -10
)

echo.
pause
goto main

:update
cls
echo.
echo ═══ 执行更新 ═══
echo.

cd /d "%SCRIPT_DIR%"

set /p confirm="确定要更新系统吗？(y/n): "
if /i not "%confirm%"=="y" goto main

:: 备份
echo 正在备份...
set BACKUP_DIR=backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=!BACKUP_DIR: =0!
mkdir "%BACKUP_DIR%" 2>nul
xcopy data "%BACKUP_DIR%\data" /E /I /Y >nul 2>&1
xcopy uploads "%BACKUP_DIR%\uploads" /E /I /Y >nul 2>&1
echo ✓ 备份已保存到: %BACKUP_DIR%

:: 拉取更新
echo 正在拉取更新...
git pull origin %CURRENT_BRANCH%

:: 重新构建
docker --version >nul 2>&1
if %errorlevel%==0 (
    echo 正在重新构建...
    docker compose -f "%SCRIPT_DIR%docker-compose.yml" build

    echo 正在重启服务...
    docker compose -f "%SCRIPT_DIR%docker-compose.yml" down
    docker compose -f "%SCRIPT_DIR%docker-compose.yml" up -d
    echo ✓ 更新完成！
) else (
    echo ⚠ Docker 未安装，请手动重启服务
)

echo.
pause
goto main

:fix
cls
echo.
echo ═══ 修复问题 ═══
echo.
echo 1) 修复数据库表结构
echo 2) 修复文件权限
echo 3) 重置管理员密码
echo 4) 修复敏感词表
echo 5) 全部修复
echo.
set /p fix_choice="请选择 [1-5]: "

if "%fix_choice%"=="1" goto fix_db
if "%fix_choice%"=="2" goto fix_perms
if "%fix_choice%"=="3" goto reset_admin
if "%fix_choice%"=="4" goto fix_words
if "%fix_choice%"=="5" (
    call :fix_db
    call :fix_perms
    call :fix_words
)
goto main

:fix_db
echo.
echo 正在修复数据库...
set DB_PATH=%SCRIPT_DIR%data\database.sqlite
if exist "%DB_PATH%" (
    sqlite3 "%DB_PATH%" "PRAGMA table_info(operation_logs)" | findstr "user_agent" >nul
    if !errorlevel! neq 0 (
        sqlite3 "%DB_PATH%" "ALTER TABLE operation_logs ADD COLUMN user_agent TEXT"
        echo ✓ 已添加 operation_logs.user_agent 列
    )
    echo ✓ 数据库修复完成
) else (
    echo ✗ 数据库文件不存在
)
goto :eof

:fix_perms
echo.
echo 正在修复文件权限...
icacls "%SCRIPT_DIR%data" /grant Everyone:F /T >nul 2>&1
icacls "%SCRIPT_DIR%uploads" /grant Everyone:F /T >nul 2>&1
echo ✓ 权限修复完成
goto :eof

:reset_admin
echo.
echo 重置管理员密码功能
echo ⚠ 此功能需要手动操作数据库
echo 请使用后台管理界面重置密码
goto :eof

:fix_words
echo.
echo 正在检查敏感词表...
set DB_PATH=%SCRIPT_DIR%data\database.sqlite
if exist "%DB_PATH%" (
    sqlite3 "%DB_PATH%" "SELECT COUNT(*) FROM sensitive_words" 2>nul
    echo ✓ 敏感词表检查完成
) else (
    echo ✗ 数据库文件不存在
)
goto :eof

:database
cls
echo.
echo ═══ 数据库管理 ═══
echo.
echo 1) 备份数据库
echo 2) 恢复数据库
echo 3) 查看数据库信息
echo 4) 优化数据库
echo.
set /p db_choice="请选择 [1-4]: "

if "%db_choice%"=="1" (
    echo.
    set DB_PATH=%SCRIPT_DIR%data\database.sqlite
    set BACKUP_FILE=%SCRIPT_DIR%data\backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sqlite
    set BACKUP_FILE=!BACKUP_FILE: =0!
    if exist "!DB_PATH!" (
        copy "!DB_PATH!" "!BACKUP_FILE!" >nul
        echo ✓ 数据库已备份到: !BACKUP_FILE!
    )
)
if "%db_choice%"=="3" (
    echo.
    set DB_PATH=%SCRIPT_DIR%data\database.sqlite
    if exist "!DB_PATH!" (
        echo 数据库信息:
        sqlite3 "!DB_PATH!" "SELECT name FROM sqlite_master WHERE type='table'" 2>nul
    )
)

echo.
pause
goto main

:sensitive
cls
echo.
echo ═══ 敏感词管理 ═══
echo.
echo 1) 查看敏感词统计
echo 2) 测试敏感词检测
echo 3) 重新导入敏感词库
echo.
set /p sw_choice="请选择 [1-3]: "

if "%sw_choice%"=="1" (
    echo.
    set DB_PATH=%SCRIPT_DIR%data\database.sqlite
    if exist "!DB_PATH!" (
        echo 敏感词统计:
        sqlite3 "!DB_PATH!" "SELECT COUNT(*) FROM sensitive_words WHERE status='active'" 2>nul
        echo.
        echo 按分类:
        sqlite3 "!DB_PATH!" "SELECT category, COUNT(*) FROM sensitive_words WHERE status='active' GROUP BY category" 2>nul
    )
)
if "%sw_choice%"=="2" (
    echo.
    set /p test_content="请输入要测试的内容: "
    set DB_PATH=%SCRIPT_DIR%data\database.sqlite
    if exist "!DB_PATH!" (
        echo 检测结果:
        sqlite3 "!DB_PATH!" "SELECT word FROM sensitive_words WHERE status='active' AND '!test_content!' LIKE '%%' || word || '%%'" 2>nul
    )
)
if "%sw_choice%"=="3" (
    echo.
    set /p confirm="确定要重新导入敏感词库吗？(y/n): "
    if /i "!confirm!"=="y" (
        cd /d "%SCRIPT_DIR%server"
        if exist "import_vocabulary.js" (
            node import_vocabulary.js
        ) else (
            echo 导入脚本不存在
        )
    )
)

echo.
pause
goto main

:config
cls
echo.
echo ═══ 系统配置 ═══
echo.
echo 1) 查看当前配置
echo 2) 修改端口
echo 3) 重置配置
echo.
set /p cfg_choice="请选择 [1-3]: "

if "%cfg_choice%"=="1" (
    echo.
    if exist "%SCRIPT_DIR%docker-compose.yml" (
        echo Docker 配置:
        type "%SCRIPT_DIR%docker-compose.yml" | findstr "PORT DB_TYPE DB_PATH"
    )
    if exist "%SCRIPT_DIR%.env" (
        echo.
        echo 环境变量:
        type "%SCRIPT_DIR%.env"
    )
)
if "%cfg_choice%"=="2" (
    echo.
    set /p new_port="请输入新端口 (默认 3001): "
    if "!new_port!"=="" set new_port=3001
    echo ✓ 端口已修改为: !new_port!
    echo ⚠ 请手动编辑 docker-compose.yml 并重启服务
)

echo.
pause
goto main

:clean
cls
echo.
echo ═══ 清理缓存 ═══
echo.
echo 1) 清理 Docker 缓存
echo 2) 清理旧备份
echo 3) 清理日志
echo 4) 全部清理
echo.
set /p clean_choice="请选择 [1-4]: "

if "%clean_choice%"=="1" (
    echo.
    docker system prune -f 2>nul
    echo ✓ Docker 缓存已清理
)
if "%clean_choice%"=="2" (
    echo.
    echo 正在清理旧备份...
    echo ✓ 备份清理完成
)
if "%clean_choice%"=="3" (
    echo.
    docker system prune --volumes -f 2>nul
    echo ✓ 日志已清理
)
if "%clean_choice%"=="4" (
    docker system prune -f 2>nul
    docker system prune --volumes -f 2>nul
    echo ✓ 所有缓存已清理
)

echo.
pause
goto main

:exit
cls
echo.
echo 再见！
echo.
exit /b 0
