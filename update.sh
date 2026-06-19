#!/bin/bash

# CodeDog 更新脚本
echo "📦 CodeDog 更新脚本"
echo "===================="

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 当前目录不是 git 仓库"
    exit 1
fi

# 备份当前版本
echo "💾 备份当前版本..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r data "$BACKUP_DIR/" 2>/dev/null || true
cp -r uploads "$BACKUP_DIR/" 2>/dev/null || true
echo "备份已保存到: $BACKUP_DIR"

# 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
CURRENT_BRANCH=$(git branch --show-current)
git pull origin "$CURRENT_BRANCH"

# 重新构建并重启
echo "🔨 重新构建..."
docker compose build

echo "🔄 重启服务..."
docker compose down
docker compose up -d

echo ""
echo "✅ 更新完成！"
echo ""
echo "如需回滚，执行："
echo "  cp -r $BACKUP_DIR/data ./data"
echo "  cp -r $BACKUP_DIR/uploads ./uploads"
echo "  docker compose restart"
