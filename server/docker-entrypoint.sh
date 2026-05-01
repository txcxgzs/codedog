#!/bin/sh

echo "=========================================="
echo "  Coding Dog 社区 - Docker 启动脚本"
echo "=========================================="

echo ""
echo "=== 检查环境变量 ==="
echo "NODE_ENV: ${NODE_ENV:-development}"
echo "DB_TYPE: ${DB_TYPE:-sqlite}"
echo "PORT: ${PORT:-3001}"

# 确保目录存在
mkdir -p ./data
mkdir -p ./uploads/avatars

if [ "$DB_TYPE" = "sqlite" ] || [ -z "$DB_TYPE" ]; then
    echo ""
    echo "=== 初始化SQLite数据库 ==="
    DB_FILE="${DB_PATH:-./data/database.sqlite}"
    
    if [ ! -f "$DB_FILE" ]; then
        echo "创建SQLite数据库文件: $DB_FILE"
        touch "$DB_FILE"
        chmod 666 "$DB_FILE"
    else
        echo "SQLite数据库文件已存在: $DB_FILE"
    fi
fi

if [ "$DB_TYPE" = "mysql" ]; then
    echo ""
    echo "=== 等待MySQL连接 ==="
    echo "MySQL主机: ${DB_HOST:-localhost}"
    echo "MySQL端口: ${DB_PORT:-3306}"
    echo "数据库名: ${DB_NAME:-coding_dog}"
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if nc -z ${DB_HOST:-localhost} ${DB_PORT:-3306} 2>/dev/null; then
            echo "MySQL连接成功!"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "等待MySQL启动... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "警告: 无法连接MySQL，继续启动..."
    fi
fi

echo ""
echo "=== 启动服务器 ==="
echo ""

exec node app.js
