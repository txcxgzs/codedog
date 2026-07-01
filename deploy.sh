#!/bin/bash

# CodeDog 一键部署脚本
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 CodeDog 部署脚本"
echo "===================="

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main 2>/dev/null || echo "⚠ 无法拉取更新，使用本地代码继续"

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

# 强制创建 .env 文件
if [ ! -f .env ] || [ ! -s .env ]; then
    echo "📦 创建环境配置..."
    
    echo ""
    echo "请选择数据库类型:"
    echo "  1) SQLite (默认，轻量级)"
    echo "  2) MySQL (需要提前安装MySQL)"
    echo ""
    read -p "请输入选项 [1-2]: " db_choice
    
    DB_TYPE="sqlite"
    DB_HOST="localhost"
    DB_PORT="3306"
    DB_NAME="coding_dog"
    DB_USER="root"
    DB_PASSWORD=""
    
    if [ "$db_choice" = "2" ]; then
        DB_TYPE="mysql"
        read -p "MySQL主机地址 [localhost]: " input_host
        DB_HOST=${input_host:-localhost}
        read -p "MySQL端口 [3306]: " input_port
        DB_PORT=${input_port:-3306}
        read -p "MySQL数据库名 [coding_dog]: " input_name
        DB_NAME=${input_name:-coding_dog}
        read -p "MySQL用户名 [root]: " input_user
        DB_USER=${input_user:-root}
        read -sp "MySQL密码: " input_pass
        DB_PASSWORD=${input_pass}
        echo ""
    fi
    
    JWT_SECRET=$(openssl rand -hex 64 2>/dev/null || head -c 128 /dev/urandom | base64)
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64)
    
    cat > .env << ENVEOF
SERVER_PORT=3001
DB_TYPE=$DB_TYPE
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
SESSION_SECRET=$SESSION_SECRET
CORS_ORIGIN=http://localhost:3001
ENVEOF
    
    echo "✅ .env 创建完成"
else
    echo "✅ 使用现有 .env 配置"
fi

# 创建数据目录
mkdir -p data uploads/avatars uploads/works

# 构建并启动
echo "📦 构建 Docker 镜像..."
docker compose build --no-cache

echo "🚀 启动服务..."
docker compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
for i in $(seq 1 30); do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo ""
        echo "✅ 服务启动成功！"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# 安装 CLI 工具箱
echo "🛠️ 安装管理工具箱..."
if [ -f "$SCRIPT_DIR/install-cli.sh" ]; then
    chmod +x "$SCRIPT_DIR/install-cli.sh"
    bash "$SCRIPT_DIR/install-cli.sh"
fi

echo ""
echo "✅ 部署完成！"
echo "📍 访问地址: http://localhost:3001"
echo "🛠️ 管理工具: 输入 codedog"
