#!/bin/bash
set -e

# CodeDog 更新脚本
echo "📦 CodeDog 更新脚本"
echo "===================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose 未安装"
    exit 1
fi

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 当前目录不是 git 仓库"
    exit 1
fi

HOST_DB_PATH="$SCRIPT_DIR/data/database.sqlite"

# 先停止服务，再进行备份，避免 WAL 模式热拷贝不一致
echo "🛑 正在停止服务..."
$COMPOSE_CMD down

# 备份当前版本
echo "💾 备份当前版本..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r data "$BACKUP_DIR/" 2>/dev/null || true
cp -r uploads "$BACKUP_DIR/" 2>/dev/null || true
cp .env "$BACKUP_DIR/.env" 2>/dev/null || true

# SQLite 使用 sqlite3 在线热备份
if command -v sqlite3 >/dev/null 2>&1 && [ -f "$HOST_DB_PATH" ]; then
    sqlite3 "$HOST_DB_PATH" ".backup '$BACKUP_DIR/database.sqlite'"
    echo "✅ 数据库已使用 sqlite3 .backup 热备份"
fi

echo "备份已保存到: $BACKUP_DIR"

# 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
CURRENT_BRANCH=$(git branch --show-current)
git pull origin "$CURRENT_BRANCH"

# 确保持久化目录可写
mkdir -p data uploads/avatars uploads/works
chmod -R a+rwX data uploads 2>/dev/null || true

# 重新构建并重启
echo "🔨 重新构建..."
$COMPOSE_CMD build

echo "🔄 重启服务..."
$COMPOSE_CMD up -d

echo "⏳ 等待服务启动..."
for i in $(seq 1 60); do
    if curl -fs http://localhost:3001/api/health > /dev/null 2>&1; then
        echo ""
        echo "✅ 更新完成，服务已运行！"
        exit 0
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "❌ 服务未正常响应，最近日志："
$COMPOSE_CMD ps
$COMPOSE_CMD logs --tail=120 codedog

echo ""
echo "如需回滚，执行："
echo "  cp -r $BACKUP_DIR/data ./data"
echo "  cp -r $BACKUP_DIR/uploads ./uploads"
echo "  cp $BACKUP_DIR/.env ./.env"
echo "  $COMPOSE_CMD up -d"
exit 1
