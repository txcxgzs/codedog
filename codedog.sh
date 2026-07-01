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

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

DATA_PATH="$SCRIPT_DIR/data"
UPLOADS_PATH="$SCRIPT_DIR/uploads"
HOST_DB_PATH="$DATA_PATH/database.sqlite"
LEGACY_DB_PATH="$SCRIPT_DIR/server/data/database.sqlite"
CONTAINER_DB_PATH="/app/server/data/database.sqlite"

get_env_value() {
    local key="$1"
    if [ -f "$SCRIPT_DIR/.env" ]; then
        grep -E "^${key}=" "$SCRIPT_DIR/.env" | tail -1 | cut -d= -f2-
    fi
}

get_db_type() {
    local value
    value=$(get_env_value "DB_TYPE")
    echo "${value:-sqlite}"
}

show_database_status() {
    local db_type
    db_type=$(get_db_type)

    if [ "$db_type" = "mysql" ]; then
        echo "数据库: MySQL（使用外部数据库，不检查 SQLite 文件）"
        return
    fi

    if [ -f "$HOST_DB_PATH" ]; then
        echo "数据库: 存在 ($HOST_DB_PATH)"
        ls -lh "$HOST_DB_PATH" 2>/dev/null || true
        return
    fi

    if [ -f "$LEGACY_DB_PATH" ]; then
        echo "数据库: 存在（旧路径：$LEGACY_DB_PATH）"
        echo "提示：当前 Docker 部署推荐使用 $HOST_DB_PATH"
        ls -lh "$LEGACY_DB_PATH" 2>/dev/null || true
        return
    fi

    if $COMPOSE_CMD exec -T codedog test -f "$CONTAINER_DB_PATH" >/dev/null 2>&1; then
        echo "数据库: 存在（容器内：$CONTAINER_DB_PATH）"
        echo "提示：宿主机未在 $HOST_DB_PATH 看到数据库，请检查 docker-compose.yml 的 data 挂载。"
        $COMPOSE_CMD exec -T codedog ls -lh "$CONTAINER_DB_PATH" 2>/dev/null || true
        return
    fi

    echo "数据库: 不存在"
    echo "已检查："
    echo "  - 宿主机新路径: $HOST_DB_PATH"
    echo "  - 宿主机旧路径: $LEGACY_DB_PATH"
    echo "  - 容器内路径: $CONTAINER_DB_PATH"
    echo ""
    echo "容器内数据目录："
    $COMPOSE_CMD exec -T codedog ls -lah /app/server/data 2>/dev/null || true
}

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

    echo ""
    echo "容器状态:"
    docker ps --filter "name=codedog" 2>/dev/null || true

    echo ""
    echo "健康检查:"
    HEALTH_LINE=$(docker inspect codedog 2>/dev/null | grep -m1 '"Status"' || true)
    if [ -n "$HEALTH_LINE" ]; then
        echo "$HEALTH_LINE" | sed 's/^[[:space:]]*//'
    else
        echo "Docker Health: 未知"
    fi

    echo ""
    if curl -fs http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "后端服务: 运行中"
    else
        echo "后端服务: 未响应"
        echo ""
        echo "最近日志:"
        $COMPOSE_CMD logs --tail=40 codedog 2>/dev/null || true
    fi

    echo ""
    show_database_status

    echo ""
    read -p "按回车返回菜单..."
    show_menu
}

show_logs() {
    echo "=== 服务日志 ==="
    echo "1) 实时日志"
    echo "2) 最近50行"
    echo "3) 最近100行"
    echo ""
    read -p "请选择 [1-3]: " log_choice
    case $log_choice in
        1) $COMPOSE_CMD logs -f codedog ;;
        2) $COMPOSE_CMD logs --tail=50 codedog ;;
        3) $COMPOSE_CMD logs --tail=100 codedog ;;
    esac
    read -p "按回车返回菜单..."
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
    cp -r data "$BACKUP/" 2>/dev/null || true
    cp -r uploads "$BACKUP/" 2>/dev/null || true
    cp .env "$BACKUP/.env" 2>/dev/null || true
    echo "备份已保存到 $BACKUP"

    echo "正在拉取更新..."
    git pull origin $(git branch --show-current)

    echo "正在修复持久化目录权限..."
    mkdir -p "$DATA_PATH" "$UPLOADS_PATH/avatars" "$UPLOADS_PATH/works"
    chmod -R a+rwX "$DATA_PATH" "$UPLOADS_PATH" 2>/dev/null || true

    echo "正在重新构建..."
    $COMPOSE_CMD build --no-cache
    $COMPOSE_CMD down
    $COMPOSE_CMD up -d

    echo "等待服务启动..."
    SERVICE_READY=0
    for i in $(seq 1 60); do
        if curl -fs http://localhost:3001/api/health > /dev/null 2>&1; then
            SERVICE_READY=1
            echo "更新完成，服务已运行!"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
    if [ "$SERVICE_READY" != "1" ]; then
        echo "服务未正常响应，最近日志："
        $COMPOSE_CMD logs --tail=120 codedog
    fi
    read -p "按回车返回菜单..."
    show_menu
}

do_fix() {
    echo "=== 修复问题 ==="
    echo "1) 检查数据库状态"
    echo "2) 修复文件权限"
    echo "3) 修复敏感词表"
    echo "4) 全部修复"
    echo ""
    read -p "请选择 [1-4]: " fix_choice

    case $fix_choice in
        1)
            show_database_status
            ;;
        2)
            mkdir -p "$DATA_PATH" "$UPLOADS_PATH/avatars" "$UPLOADS_PATH/works"
            chmod -R a+rwX "$DATA_PATH" "$UPLOADS_PATH" 2>/dev/null || true
            echo "权限修复完成"
            ;;
        3)
            if [ -f "$HOST_DB_PATH" ]; then
                sqlite3 "$HOST_DB_PATH" "SELECT COUNT(*) FROM sensitive_words" 2>/dev/null && echo "敏感词表正常" || echo "无法读取敏感词表"
            else
                echo "数据库文件不存在: $HOST_DB_PATH"
            fi
            ;;
        4)
            mkdir -p "$DATA_PATH" "$UPLOADS_PATH/avatars" "$UPLOADS_PATH/works"
            chmod -R a+rwX "$DATA_PATH" "$UPLOADS_PATH" 2>/dev/null || true
            $COMPOSE_CMD restart codedog
            echo "全部修复完成，已重启服务"
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

    case $db_choice in
        1)
            if [ -f "$HOST_DB_PATH" ]; then
                BACKUP_FILE="$DATA_PATH/backup_$(date +%Y%m%d_%H%M%S).sqlite"
                cp "$HOST_DB_PATH" "$BACKUP_FILE"
                echo "备份已保存到: $BACKUP_FILE"
            elif $COMPOSE_CMD exec -T codedog test -f "$CONTAINER_DB_PATH" >/dev/null 2>&1; then
                BACKUP_FILE="$DATA_PATH/backup_$(date +%Y%m%d_%H%M%S).sqlite"
                $COMPOSE_CMD cp codedog:"$CONTAINER_DB_PATH" "$BACKUP_FILE" && echo "备份已保存到: $BACKUP_FILE"
            else
                echo "数据库文件不存在"
            fi
            ;;
        2)
            if [ -f "$HOST_DB_PATH" ]; then
                if command -v sqlite3 >/dev/null 2>&1; then
                    echo "数据表:"
                    sqlite3 "$HOST_DB_PATH" "SELECT name FROM sqlite_master WHERE type='table'" 2>/dev/null
                else
                    echo "sqlite3 未安装，显示文件信息:"
                    ls -lh "$HOST_DB_PATH"
                fi
            else
                show_database_status
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

    if [ "$sw_choice" = "1" ] && [ -f "$HOST_DB_PATH" ]; then
        if command -v sqlite3 >/dev/null 2>&1; then
            echo "活跃敏感词:"
            sqlite3 "$HOST_DB_PATH" "SELECT COUNT(*) FROM sensitive_words WHERE status='active'" 2>/dev/null
            echo "按分类:"
            sqlite3 "$HOST_DB_PATH" "SELECT category, COUNT(*) FROM sensitive_words WHERE status='active' GROUP BY category" 2>/dev/null
        else
            echo "sqlite3 未安装，无法直接查看统计"
        fi
    else
        show_database_status
    fi
    echo ""
    read -p "按回车返回菜单..."
    show_menu
}

do_config() {
    echo "=== 系统配置 ==="
    if [ -f "$SCRIPT_DIR/.env" ]; then
        echo "当前配置:"
        sed -E 's/^(JWT_SECRET|SESSION_SECRET)=.*/\1=******/' "$SCRIPT_DIR/.env"
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
