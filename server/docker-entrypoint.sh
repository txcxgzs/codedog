#!/bin/sh

echo "=========================================="
echo "  编程狗 - Docker 启动"
echo "=========================================="

echo ""
echo "=== 环境信息 ==="
echo "NODE_ENV: ${NODE_ENV:-development}"
echo "DB_TYPE: ${DB_TYPE:-sqlite}"
echo "PORT: ${PORT:-3001}"

# 创建必要目录并修复权限
# Render 持久磁盘挂载后可能属主为 root,需确保目录可写
mkdir -p ./data ./uploads/avatars ./uploads/works
chmod -R 777 ./data ./uploads 2>/dev/null || true

if [ "$DB_TYPE" = "sqlite" ] || [ -z "$DB_TYPE" ]; then
    echo ""
    echo "=== SQLite 数据库 ==="
    DB_FILE="${DB_PATH:-./data/database.sqlite}"

    if [ ! -f "$DB_FILE" ]; then
        echo "创建数据库文件: $DB_FILE"
        touch "$DB_FILE" 2>/dev/null || {
            echo "权限不足，尝试使用 sudo..."
            sudo touch "$DB_FILE" 2>/dev/null || true
        }
        chmod 664 "$DB_FILE" 2>/dev/null || true
    else
        echo "数据库已存在: $DB_FILE"
        # 清理可能残留的 Sequelize alter 临时表，避免重启死锁
        if command -v sqlite3 >/dev/null 2>&1; then
            BACKUP_TABLES=$(sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_backup';" 2>/dev/null || true)
            if [ -n "$BACKUP_TABLES" ]; then
                echo "[启动] 发现残留临时表，正在清理..."
                echo "$BACKUP_TABLES" | while read -r t; do
                    [ -n "$t" ] && sqlite3 "$DB_FILE" "DROP TABLE IF EXISTS \"$t\";" 2>/dev/null && echo "[启动] 已删除: $t"
                done
            fi
        fi
        chmod 664 "$DB_FILE" 2>/dev/null || true
    fi

    # 确保 data 目录可写
    chmod -R 777 ./data 2>/dev/null || true
fi

if [ "$DB_TYPE" = "mysql" ]; then
    echo ""
    echo "=== 等待 MySQL 启动 ==="

    MAX_RETRIES=30
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if mysqladmin ping -h ${DB_HOST:-localhost} -P ${DB_PORT:-3306} -u ${DB_USER:-root} ${DB_PASSWORD:+-p$DB_PASSWORD} 2>/dev/null; then
            echo "MySQL 已连接！"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "等待中... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "错误：无法连接 MySQL"
        exit 1
    fi
fi

echo ""
echo "=== 启动服务 ==="
echo ""

exec node app.js
