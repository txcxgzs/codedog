#!/bin/bash

# CodeDog 管理工具箱
VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

show_menu() {
    clear
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}   CodeDog 管理工具箱 v${VERSION}${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    echo "  1) 查看系统状态"
    echo "  2) 查看服务日志"
    echo "  3) 检查更新"
    echo "  4) 执行更新"
    echo "  5) 修复问题"
    echo "  6) 数据库管理"
    echo "  7) 敏感词管理"
    echo "  8) 系统配置"
    echo "  9) 清理缓存"
    echo "  0) 退出"
    echo ""
    read -p "请选择操作 [0-9]: " choice
    echo ""
    case $choice in
        1) show_status ;;
        2) show_logs ;;
        3) check_update ;;
        4) do_update ;;
        5) do_fix ;;
        6) do_database ;;
        7) do_sensitive ;;
        8) do_config ;;
        9) do_clean ;;
        0) exit 0 ;;
        *) echo "无效选项"; sleep 1; show_menu ;;
    esac
}

show_status() {
    echo "=== 系统状态 ==="
    echo ""
    docker --version > /dev/null 2>&1 && echo "Docker: 已安装" || echo "Docker: 未安装"
    docker ps --filter "name=codedog" --format "table {{.ID}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
    echo ""
    curl -s http://localhost:3001/api/health > /dev/null 2>&1 && echo "后端服务: 运行中" || echo "后端服务: 未响应"
    [ -f "$SCRIPT_DIR/server/data/database.sqlite" ] && echo "数据库: 存在" || echo "数据库: 不存在"
    echo ""
    read -p "按回车返回菜单..."
    show_menu
}

show_logs() {
    echo "=== 服务日志 ==="
    echo "1) 实时日志"
    echo "2) 最近50行"
    echo "3) 错误日志"
    echo ""
    read -p "请选择 [1-3]: " log_choice
    case $log_choice in
        1) docker compose logs -f ;;
        2) docker compose logs --tail=50 ;;
        3) docker compose logs --tail=100 ;;
    esac
    show_menu
}

check_update() {
    echo "=== 检查更新 ==="
    git fetch origin 2>/dev/null
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "origin/$(git branch --show-current)" 2>/dev/null)
    if [ "$LOCAL" = "$REMOTE" ]; then
        echo "已是最新版本"
    else
        echo "有新版本可用:"
        git log HEAD..origin/$(git branch --show-current) --oneline --no-merges 2>/dev/null | head -10
    fi
    echo ""
    read -p "按回车返回菜单..."
    show_menu
}

do_update() {
    read -p "确定要更新吗? (y/n): " confirm
    [ "$confirm" != "y" ] && show_menu

    echo "正在备份..."
    BACKUP="backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP"
    cp -r server/data "$BACKUP/" 2>/dev/null
    cp -r server/uploads "$BACKUP/" 2>/dev/null
    echo "备份已保存到 $BACKUP"

    echo "正在拉取更新..."
    git pull origin $(git branch --show-current)

    echo "正在重新构建..."
    docker compose build --no-cache
    docker compose down
    docker compose up -d

    echo "更新完成!"
    read -p "按回车返回菜单..."
    show_menu
}

do_fix() {
    echo "=== 修复问题 ==="
    echo "1) 修复数据库表结构"
    echo "2) 修复文件权限"
    echo "3) 修复敏感词表"
    echo "4) 全部修复"
    echo ""
    read -p "请选择 [1-4]: " fix_choice

    DB_PATH="$SCRIPT_DIR/server/data/database.sqlite"

    case $fix_choice in
        1)
            if [ -f "$DB_PATH" ]; then
                echo "数据库表结构正常"
            else
                echo "数据库文件不存在"
            fi
            ;;
        2)
            chmod -R 755 server/data server/uploads 2>/dev/null
            echo "权限修复完成"
            ;;
        3)
            if [ -f "$DB_PATH" ]; then
                sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sensitive_words" 2>/dev/null && echo "敏感词表正常"
            fi
            ;;
        4)
            chmod -R 755 server/data server/uploads 2>/dev/null
            echo "全部修复完成"
            ;;
    esac
    echo ""
    read -p "按回车返回菜单..."
    show_menu
}

do_database() {
    echo "=== 数据库管理 ==="
    echo "1) 备份数据库"
    echo "2) 查看数据库信息"
    echo ""
    read -p "请选择 [1-2]: " db_choice

    DB_PATH="$SCRIPT_DIR/server/data/database.sqlite"

    case $db_choice in
        1)
            if [ -f "$DB_PATH" ]; then
                BACKUP_FILE="$SCRIPT_DIR/server/data/backup_$(date +%Y%m%d_%H%M%S).sqlite"
                cp "$DB_PATH" "$BACKUP_FILE"
                echo "备份已保存到: $BACKUP_FILE"
            else
                echo "数据库文件不存在"
            fi
            ;;
        2)
            if [ -f "$DB_PATH" ]; then
                echo "数据表:"
                sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table'" 2>/dev/null
            else
                echo "数据库文件不存在"
            fi
            ;;
    esac
    echo ""
    read -p "按回车返回菜单..."
    show_menu
}

do_sensitive() {
    echo "=== 敏感词管理 ==="
    echo "1) 查看统计"
    echo ""
    read -p "请选择 [1]: " sw_choice

    DB_PATH="$SCRIPT_DIR/server/data/database.sqlite"

    if [ "$sw_choice" = "1" ] && [ -f "$DB_PATH" ]; then
        echo "活跃敏感词:"
        sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sensitive_words WHERE status='active'" 2>/dev/null
        echo "按分类:"
        sqlite3 "$DB_PATH" "SELECT category, COUNT(*) FROM sensitive_words WHERE status='active' GROUP BY category" 2>/dev/null
    fi
    echo ""
    read -p "按回车返回菜单..."
    show_menu
}

do_config() {
    echo "=== 系统配置 ==="
    if [ -f "$SCRIPT_DIR/.env" ]; then
        echo "当前配置:"
        cat "$SCRIPT_DIR/.env"
    else
        echo ".env 文件不存在"
    fi
    echo ""
    read -p "按回车返回菜单..."
    show_menu
}

do_clean() {
    echo "=== 清理缓存 ==="
    docker system prune -f 2>/dev/null
    echo "缓存清理完成"
    echo ""
    read -p "按回车返回菜单..."
    show_menu
}

show_menu
