#!/bin/bash

# CodeDog 一键部署脚本
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

echo ""
echo "✅ 部署完成！"
echo "访问地址: http://localhost:3001"
echo ""
echo "常用命令："
echo "  查看日志: docker compose logs -f"
echo "  停止服务: docker compose down"
echo "  重启服务: docker compose restart"
