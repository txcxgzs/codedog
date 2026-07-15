@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================================================
:: CodeDog 管理工具箱 (Windows)
:: 版本: 1.1.0
:: 说明: 支持 Docker 部署和本地/宝塔部署两种模式，自动检测数据库路径
:: ============================================================================

set "VERSION=1.1.0"
set "SCRIPT_DIR=%~dp0"

:: ============================================================================
:: 数据库路径自动检测
:: Docker 部署: 数据库在 %SCRIPT_DIR%data\database.sqlite (docker-compose 挂载)
:: 本地/宝塔部署: 数据库在 %SCRIPT_DIR%server\data\database.sqlite (server 默认路径)
:: ============================================================================
set "DOCKER_DB_PATH=%SCRIPT_DIR%data\database.sqlite"
set "LOCAL_DB_PATH=%SCRIPT_DIR%server\data\database.sqlite"

:: 自动检测数据库位置：优先 Docker 路径，其次本地路径
set "DB_PATH="
if exist "%DOCKER_DB_PATH%" (
    set "DB_PATH=%DOCKER_DB_PATH%"
    set "DEPLOY_MODE=Docker"
) else if exist "%LOCAL_DB_PATH%" (
    set "DB_PATH=%LOCAL_DB_PATH%"
    set "DEPLOY_MODE=本地"
) else (
    set "DEPLOY_MODE=未知"
)

:: ============================================================================
:: 数据诊断 & 修复工具箱 (Data Diagnostic & Repair Toolbox)
:: 独立于本交互菜单的命令行工具，复用项目 Sequelize 连接
:: 直接调用（无需启动本菜单）:
::   node "%SCRIPT_DIR%scripts\toolbox.js" <command> [options]
::
:: 子命令:
::   help                显示帮助
::   list-commands       列出可用子命令
::   consistency-check   扫描计数漂移 / 悬空引用 / 软删孤儿
::   repair-counts       重算并修复漂移计数（--dry-run 预览，不写库）
::   security-audit      扫描弱口令哈希 / nickname|bio 含 <,> / 非法 ENUM 状态
::   db-health           DB 文件/WAL 大小、连接池、表行数、孤儿外键
::
:: 选项:
::   --json              输出机器可读 JSON（人类信息转 stderr）
::   --dry-run           修复类命令仅预览不写库
:: ============================================================================

:main
cls
echo.
echo  ======================================================
echo    CodeDog 管理工具箱 v%VERSION%  [%DEPLOY_MODE% 模式]
echo  ======================================================
echo.
if "%DEPLOY_MODE%"=="unknown" (
    echo  [警告] 未找到数据库文件，数据库相关功能将不可用
    echo    已检查: %DOCKER_DB_PATH%
    echo    已检查: %LOCAL_DB_PATH%
    echo.
)
echo  请选择操作:
echo.
echo    1) 查看系统状态
echo    2) 查看服务日志
echo    3) 检查更新
echo    4) 执行更新
echo    5) 修复问题
echo    6) 数据库管理
echo    7) 敏感词管理
echo    8) 系统配置
echo    9) 验证码开关 (hCaptcha / 极验)
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
if "%choice%"=="9" goto captcha_toggle
if "%choice%"=="0" goto exit
goto main

:: ==================== 系统状态 ====================
:status
cls
echo.
echo  === 系统状态 ===
echo.

:: 检查 Docker
docker --version >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] Docker 已安装
    docker ps --filter "name=codedog" --format "table {{.ID}}\t{{.Status}}\t{{.Ports}}" 2>nul
) else (
    echo  [--] Docker 未安装
)

echo.

:: 检查后端服务
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] 后端服务运行正常
) else (
    echo  [!!] 后端服务未响应
)

:: 检查数据库
if defined DB_PATH (
    if exist "%DB_PATH%" (
        echo  [OK] 数据库文件存在: %DB_PATH%
    ) else (
        echo  [!!] 数据库文件不存在
    )
) else (
    echo  [!!] 未找到数据库文件
)

echo.
pause
goto main

:: ==================== 服务日志 ====================
:logs
cls
echo.
echo  === 服务日志 ===
echo.
echo  1) 实时日志 (Docker)
echo  2) 最近 50 行 (Docker)
echo  3) 最近 100 行 (Docker)
echo  4) 查看本地 server.log (本地部署)
echo.
set /p log_choice="请选择 [1-4]: "

if "%log_choice%"=="1" docker compose -f "%SCRIPT_DIR%docker-compose.yml" logs -f
if "%log_choice%"=="2" docker compose -f "%SCRIPT_DIR%docker-compose.yml" logs --tail=50
if "%log_choice%"=="3" docker compose -f "%SCRIPT_DIR%docker-compose.yml" logs --tail=100
if "%log_choice%"=="4" (
    if exist "%SCRIPT_DIR%server.log" (
        type "%SCRIPT_DIR%server.log" | more
    ) else (
        echo  server.log 不存在
    )
)

echo.
pause
goto main

:: ==================== 检查更新 ====================
:check_update
cls
echo.
echo  === 检查更新 ===
echo.

cd /d "%SCRIPT_DIR%"

:: 获取当前版本
for /f "tokens=*" %%i in ('git rev-parse --short HEAD 2^>nul') do set CURRENT_COMMIT=%%i
for /f "tokens=*" %%i in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%i

if not defined CURRENT_BRANCH (
    echo  [!!] 当前目录不是 git 仓库，无法检查更新
    echo.
    pause
    goto main
)

echo  当前版本: %CURRENT_COMMIT% (%CURRENT_BRANCH%)

:: 获取远程更新
echo  正在检查远程更新...
git fetch origin 2>nul
if %errorlevel% neq 0 (
    echo  [!!] git fetch 失败，请检查网络或远程仓库配置
    echo.
    pause
    goto main
)

:: 比较差异
for /f "tokens=*" %%i in ('git rev-parse HEAD') do set LOCAL=%%i
for /f "tokens=*" %%i in ('git rev-parse "origin/%CURRENT_BRANCH%" 2^>nul') do set REMOTE=%%i

if "%LOCAL%"=="%REMOTE%" (
    echo  [OK] 已是最新版本！
) else (
    echo  [!!] 有新版本可用
    echo.
    echo  最近更新:
    git log HEAD.."origin/%CURRENT_BRANCH%" --oneline --no-merges 2>nul
)

echo.
pause
goto main

:: ==================== 执行更新 ====================
:update
cls
echo.
echo  === 执行更新 ===
echo.

cd /d "%SCRIPT_DIR%"

set /p confirm="确定要更新系统吗？(y/n): "
if /i not "%confirm%"=="y" goto main

:: 获取当前分支
for /f "tokens=*" %%i in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%i
if not defined CURRENT_BRANCH (
    echo  [!!] 当前目录不是 git 仓库
    echo.
    pause
    goto main
)

:: 备份
echo  正在备份...
set BACKUP_DIR=backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=!BACKUP_DIR: =0!
mkdir "%BACKUP_DIR%" 2>nul
if exist "%SCRIPT_DIR%data" xcopy data "%BACKUP_DIR%\data" /E /I /Y >nul 2>&1
if exist "%SCRIPT_DIR%uploads" xcopy uploads "%BACKUP_DIR%\uploads" /E /I /Y >nul 2>&1
if exist "%SCRIPT_DIR%server\data" xcopy server\data "%BACKUP_DIR%\server-data" /E /I /Y >nul 2>&1
echo  [OK] 备份已保存到: %BACKUP_DIR%

:: 拉取更新
echo  正在拉取更新...
git pull origin %CURRENT_BRANCH%
if %errorlevel% neq 0 (
    :: 检测是否有本地未提交改动
    git status --porcelain > "%TEMP%\codedog_status.txt" 2>nul
    for /f %%i in ("%TEMP%\codedog_status.txt") do set STATUS_SIZE=%%~zi
    if !STATUS_SIZE! gtr 0 (
        echo.
        echo  [!] 检测到本地有未提交改动,可能是之前调试时手动修改的:
        git status --short
        echo.
        echo  工具箱可以自动 stash 保存这些改动^(不会丢失^),然后继续更新。
        echo  如需恢复,更新完成后可手动执行: git stash pop
        echo.
        set /p stash_confirm="是否自动 stash 本地改动并继续更新? (y/n): "
        if /i "!stash_confirm!"=="y" (
            git stash push -m "toolbox-auto-stash-%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
            if !errorlevel! neq 0 (
                echo  [!!] git stash 失败!
                echo.
                pause
                goto main
            )
            echo  [OK] 本地改动已 stash 保存
            :: 重试 git pull
            git pull origin %CURRENT_BRANCH%
            if !errorlevel! neq 0 (
                echo  [!!] git pull 仍然失败！请检查网络问题或合并冲突
                echo  本地改动已 stash,可执行 git stash pop 恢复
                echo.
                pause
                goto main
            )
        ) else (
            echo  已取消更新
            echo.
            pause
            goto main
        )
    ) else (
        echo  [!!] git pull 失败！请检查网络问题或合并冲突
        echo.
        pause
        goto main
    )
)

:: 重新构建 (仅 Docker 模式)
docker --version >nul 2>&1
if %errorlevel%==0 (
    echo  正在重新构建（复用 Docker 缓存）...
    rem 普通重建复用依赖层；缓存异常时再手动执行 build --no-cache。
    docker compose -f "%SCRIPT_DIR%docker-compose.yml" build
    if %errorlevel% neq 0 (
        echo  [!!] Docker 构建失败
        echo.
        pause
        goto main
    )

    echo  正在重启服务...
    docker compose -f "%SCRIPT_DIR%docker-compose.yml" down
    docker compose -f "%SCRIPT_DIR%docker-compose.yml" up -d
    echo  [OK] 更新完成！
) else (
    echo  [--] Docker 未安装，请手动重启服务:
    echo    cd server ^&^& node app.js
)

echo.
pause
goto main

:: ==================== 修复问题 ====================
:fix
cls
echo.
echo  === 修复问题 ===
echo.
echo  1) 检查数据库状态
echo  2) 修复文件权限
echo  3) 修复敏感词表
echo  4) 清理 SQLite 残留备份表（解决启动崩溃）
echo  5) 全部修复
echo.
set /p fix_choice="请选择 [1-5]: "

if "%fix_choice%"=="1" goto fix_db_check
if "%fix_choice%"=="2" goto fix_perms
if "%fix_choice%"=="3" goto fix_words
if "%fix_choice%"=="4" goto fix_backup_tables
if "%fix_choice%"=="5" (
    call :fix_perms
    call :fix_words
    call :fix_backup_tables
    echo.
    echo  [OK] 全部修复完成
)
goto main

:fix_db_check
echo.
if not defined DB_PATH (
    echo  [!!] 未找到数据库文件
    goto :eof
)
echo  数据库路径: %DB_PATH%
if exist "%DB_PATH%" (
    echo  [OK] 数据库文件存在
    sqlite3 "%DB_PATH%" "SELECT name FROM sqlite_master WHERE type='table'" 2>nul
) else (
    echo  [!!] 数据库文件不存在
)
goto :eof

:fix_perms
echo.
echo  正在修复文件权限...
icacls "%SCRIPT_DIR%data" /grant "%USERNAME%:F" /T >nul 2>&1
icacls "%SCRIPT_DIR%uploads" /grant "%USERNAME%:F" /T >nul 2>&1
icacls "%SCRIPT_DIR%server\data" /grant "%USERNAME%:F" /T >nul 2>&1
echo  [OK] 权限修复完成
goto :eof

:fix_words
echo.
if not defined DB_PATH (
    echo  [!!] 未找到数据库文件
    goto :eof
)
echo  正在检查敏感词表...
if exist "%DB_PATH%" (
    sqlite3 "%DB_PATH%" "SELECT COUNT(*) FROM sensitive_words" 2>nul
    if %errorlevel%==0 (
        echo  [OK] 敏感词表检查完成
    ) else (
        echo  [!!] 敏感词表不存在或无法读取
    )
) else (
    echo  [!!] 数据库文件不存在
)
goto :eof

:fix_backup_tables
echo.
if not defined DB_PATH (
    echo  [!!] 未找到数据库文件
    goto :eof
)
echo  正在清理 SQLite 残留备份表...
if not exist "%DB_PATH%" (
    echo  [!!] 数据库文件不存在
    goto :eof
)
:: 查找并删除所有 *_backup 表（Sequelize alter 残留会导致启动崩溃）
for /f "delims=" %%t in ('sqlite3 "%DB_PATH%" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%%_backup'" 2^>nul') do (
    echo    正在删除: %%t
    sqlite3 "%DB_PATH%" "DROP TABLE IF EXISTS \"%%t\";" 2>nul
)
echo  [OK] 残留备份表清理完成
goto :eof

:: ==================== 数据库管理 ====================
:database
cls
echo.
echo  === 数据库管理 ===
echo.
if not defined DB_PATH (
    echo  [!!] 未找到数据库文件，此功能不可用
    echo.
    pause
    goto main
)
echo  数据库路径: %DB_PATH%
echo.
echo  1) 备份数据库
echo  2) 查看数据库信息
echo  3) 查看表列表
echo.
set /p db_choice="请选择 [1-3]: "

if "%db_choice%"=="1" (
    echo.
    set BACKUP_FILE=%SCRIPT_DIR%data\backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sqlite
    set BACKUP_FILE=!BACKUP_FILE: =0!
    :: 确保备份目录存在
    if not exist "%SCRIPT_DIR%data" mkdir "%SCRIPT_DIR%data" 2>nul
    if exist "!DB_PATH!" (
        copy "!DB_PATH!" "!BACKUP_FILE!" >nul
        echo  [OK] 数据库已备份到: !BACKUP_FILE!
    ) else (
        echo  [!!] 数据库文件不存在
    )
)
if "%db_choice%"=="2" (
    echo.
    if exist "!DB_PATH!" (
        echo  数据库文件信息:
        dir "!DB_PATH!"
        echo.
        echo  表行数统计:
        sqlite3 "!DB_PATH!" "SELECT name, (SELECT COUNT(*) FROM sqlite_master sm2 WHERE sm2.name = sm.name) FROM sqlite_master sm WHERE type='table'" 2>nul
    ) else (
        echo  [!!] 数据库文件不存在
    )
)
if "%db_choice%"=="3" (
    echo.
    if exist "!DB_PATH!" (
        echo  数据表列表:
        sqlite3 "!DB_PATH!" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" 2>nul
    ) else (
        echo  [!!] 数据库文件不存在
    )
)

echo.
pause
goto main

:: ==================== 敏感词管理 ====================
:sensitive
cls
echo.
echo  === 敏感词管理 ===
echo.
if not defined DB_PATH (
    echo  [!!] 未找到数据库文件，此功能不可用
    echo.
    pause
    goto main
)
echo  1) 查看敏感词统计
echo  2) 测试敏感词检测
echo.
set /p sw_choice="请选择 [1-2]: "

if "%sw_choice%"=="1" (
    echo.
    if exist "!DB_PATH!" (
        echo  活跃敏感词总数:
        sqlite3 "!DB_PATH!" "SELECT COUNT(*) FROM sensitive_words WHERE status='active'" 2>nul
        echo.
        echo  按分类统计:
        sqlite3 "!DB_PATH!" "SELECT category, COUNT(*) FROM sensitive_words WHERE status='active' GROUP BY category" 2>nul
    ) else (
        echo  [!!] 数据库文件不存在
    )
)
if "%sw_choice%"=="2" (
    echo.
    set /p test_content="请输入要测试的内容: "
    if exist "!DB_PATH!" (
        :: 转义单引号
        set "test_content=!test_content:'=''!"
        echo.
        echo  检测结果（匹配到的敏感词）:
        sqlite3 "!DB_PATH!" "SELECT word FROM sensitive_words WHERE status='active' AND '!test_content!' LIKE '%%' || word || '%%'" 2>nul
    ) else (
        echo  [!!] 数据库文件不存在
    )
)

echo.
pause
goto main

:: ==================== 系统配置 ====================
:config
cls
echo.
echo  === 系统配置 ===
echo.
echo  1) 查看当前配置
echo  2) 修改端口
echo  3) 查看环境变量（脱敏）
echo.
set /p cfg_choice="请选择 [1-3]: "

if "%cfg_choice%"=="1" (
    echo.
    if exist "%SCRIPT_DIR%docker-compose.yml" (
        echo  Docker 配置:
        type "%SCRIPT_DIR%docker-compose.yml" | findstr "PORT DB_TYPE DB_PATH"
        echo.
    )
    if exist "%SCRIPT_DIR%.env" (
        echo  环境变量（脱敏）:
        :: 脱敏显示 .env 中的敏感信息
        for /f "usebackq delims=" %%a in ("%SCRIPT_DIR%.env") do (
            set "line=%%a"
            echo !line! | findstr /r "^JWT_SECRET= ^SESSION_SECRET= ^DB_PASSWORD= ^.*_KEY= ^.*_SECRET= ^.*_TOKEN=" >nul 2>&1
            if !errorlevel! equ 0 (
                echo !line! | findstr "=" >nul
                for /f "tokens=1 delims==" %%k in ("!line!") do echo  %%k=******
            ) else (
                echo  !line!
            )
        )
    )
)
if "%cfg_choice%"=="2" (
    echo.
    set /p new_port="请输入新端口 (默认 3001): "
    if "!new_port!"=="" set new_port=3001
    echo  [!] 端口修改需要手动编辑 docker-compose.yml 或 .env
    echo      请将 SERVER_PORT 改为 !new_port! 并重启服务
)
if "%cfg_choice%"=="3" (
    echo.
    if exist "%SCRIPT_DIR%.env" (
        echo  环境变量（脱敏）:
        for /f "usebackq delims=" %%a in ("%SCRIPT_DIR%.env") do (
            set "line=%%a"
            echo !line! | findstr /r "^JWT_SECRET= ^SESSION_SECRET= ^DB_PASSWORD= ^.*_KEY= ^.*_SECRET= ^.*_TOKEN=" >nul 2>&1
            if !errorlevel! equ 0 (
                for /f "tokens=1 delims==" %%k in ("!line!") do echo  %%k=******
            ) else (
                echo  !line!
            )
        )
    ) else (
        echo  [!!] .env 文件不存在
    )
)

echo.
pause
goto main

:: ==================== 验证码开关 ====================
:: 直接修改数据库 system_configs 表的 hcaptcha_enabled / geetest_enabled 字段
:: 用于验证码服务异常时紧急关闭，避免登录/发帖/评论被全部拦截
:: 注意：hCaptcha 中间件有 60 秒缓存，关闭后最多 60 秒生效；
::       也可重启服务立即生效
:captcha_toggle
cls
echo.
echo  === 验证码开关 ===
echo.

if not defined DB_PATH (
    echo  [!!] 未找到数据库文件，此功能不可用
    echo    已检查:
    echo      %DOCKER_DB_PATH%
    echo      %LOCAL_DB_PATH%
    echo.
    echo    可能原因:
    echo      1) 项目尚未部署（请先运行 deploy.bat 或 install.sh）
    echo      2) 数据库在其他位置（请手动修改 DB_PATH 变量）
    echo.
    pause
    goto main
)

if not exist "%DB_PATH%" (
    echo  [!!] 数据库文件不存在: %DB_PATH%
    echo.
    pause
    goto main
)

echo  数据库: %DB_PATH%
echo.
echo  当前状态:
:: 读取当前 hCaptcha 状态（config_value 为 'true'/'false'，可能不存在）
set "hcaptcha_state=未配置(默认关闭)"
for /f "delims=" %%i in ('sqlite3 "%DB_PATH%" "SELECT config_value FROM system_configs WHERE config_key='hcaptcha_enabled'" 2^>nul') do set "hcaptcha_state=%%i"
if "!hcaptcha_state!"=="" set "hcaptcha_state=未配置(默认关闭)"
if "!hcaptcha_state!"=="true" set "hcaptcha_state=已开启"
if "!hcaptcha_state!"=="false" set "hcaptcha_state=已关闭"
echo    hCaptcha: !hcaptcha_state!

set "geetest_state=未配置(默认关闭)"
for /f "delims=" %%i in ('sqlite3 "%DB_PATH%" "SELECT config_value FROM system_configs WHERE config_key='geetest_enabled'" 2^>nul') do set "geetest_state=%%i"
if "!geetest_state!"=="" set "geetest_state=未配置(默认关闭)"
if "!geetest_state!"=="true" set "geetest_state=已开启"
if "!geetest_state!"=="false" set "geetest_state=已关闭"
echo    极验Geetest: !geetest_state!
echo.
echo  1) 关闭 hCaptcha 验证码（紧急放行）
echo  2) 开启 hCaptcha 验证码
echo  3) 关闭 极验Geetest 验证码
echo  4) 开启 极验Geetest 验证码
echo  5) 全部关闭 (验证码服务故障时使用)
echo  6) 全部开启
echo  0) 返回
echo.
set /p cap_choice="请选择 [0-6]: "

if "!cap_choice!"=="1" call :set_config hcaptcha_enabled false
if "!cap_choice!"=="2" call :set_config hcaptcha_enabled true
if "!cap_choice!"=="3" call :set_config geetest_enabled false
if "!cap_choice!"=="4" call :set_config geetest_enabled true
if "!cap_choice!"=="5" (
    call :set_config hcaptcha_enabled false
    call :set_config geetest_enabled false
)
if "!cap_choice!"=="6" (
    call :set_config hcaptcha_enabled true
    call :set_config geetest_enabled true
)
if "!cap_choice!"=="0" goto main

echo.
echo  提示: hCaptcha 中间件有 60 秒缓存，最多 60 秒后生效；重启服务立即生效。
echo.
pause
goto main

:: 写入 system_configs 表的辅助函数：存在则更新，不存在则插入
:set_config
set "CFG_KEY=%~1"
set "CFG_VAL=%~2"
:: 先查是否存在
set "EXISTS="
for /f "delims=" %%i in ('sqlite3 "%DB_PATH%" "SELECT config_key FROM system_configs WHERE config_key='!CFG_KEY!'" 2^>nul') do set "EXISTS=%%i"
if "!EXISTS!"=="" (
    sqlite3 "%DB_PATH%" "INSERT INTO system_configs (config_key, config_value, created_at, updated_at) VALUES ('!CFG_KEY!', '!CFG_VAL!', datetime('now'), datetime('now'))" 2>nul
) else (
    sqlite3 "%DB_PATH%" "UPDATE system_configs SET config_value='!CFG_VAL!', updated_at=datetime('now') WHERE config_key='!CFG_KEY!'" 2>nul
)
echo  [OK] !CFG_KEY! 已设置为 !CFG_VAL!
goto :eof

:: ==================== 退出 ====================
:exit
cls
echo.
echo  再见！
echo.
exit /b 0
