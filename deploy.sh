#!/bin/bash

# CodeDog 一键部署脚本
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 CodeDog 部署脚本"
echo "===================="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 请先安装 Docker Compose"
    exit 1
fi

# 创建数据目录
mkdir -p data uploads/avatars uploads/works

# 构建并启动
echo "📦 构建 Docker 镜像..."
docker compose build

echo "🚀 启动服务..."
docker compose up -d

# 安装 CLI 工具箱
echo ""
echo "🛠️ 安装管理工具箱..."
if [ -f "$SCRIPT_DIR/install-cli.sh" ]; then
    chmod +x "$SCRIPT_DIR/install-cli.sh"
    bash "$SCRIPT_DIR/install-cli.sh"
else
    echo "⚠ 安装脚本不存在，跳过工具箱安装"
fi

echo ""
echo "✅ 部署完成！"
echo ""
echo "📍 访问地址: http://localhost:3001"
echo ""
echo "🛠️ 管理工具: 输入 codedog 启动管理工具箱"
echo ""
echo "常用命令："
echo "  管理工具箱: codedog"
echo "  查看日志: docker compose logs -f"
echo "  停止服务: docker compose down"
echo "  重启服务: docker compose restart"
