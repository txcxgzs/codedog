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
        # 修复：权限收紧为 640 并归属 app 用户，避免 666 过于宽松（非 root 运行时 chown 失败可忽略）
        chown app:app "$DB_FILE" 2>/dev/null || true
        chmod 640 "$DB_FILE"
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
        # 修复：用 mysqladmin ping 真实检测 MySQL 可用性，而非仅检测端口是否监听
        if mysqladmin ping -h ${DB_HOST:-localhost} -P ${DB_PORT:-3306} -u ${DB_USER:-root} ${DB_PASSWORD:+-p$DB_PASSWORD} 2>/dev/null; then
            echo "MySQL连接成功!"
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "等待MySQL启动... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        # 修复：MySQL 不可用时直接退出，避免带着不可用的依赖启动
        echo "错误: 无法连接MySQL，启动失败"
        exit 1
    fi
fi

echo ""
echo "=== 启动服务器 ==="
echo ""

exec node app.js
