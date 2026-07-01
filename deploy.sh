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

# 创建 .env 文件（如果不存在）
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "📦 创建环境配置..."
    
    # 询问数据库类型
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
    
    # 生成安全密钥
    JWT_SECRET=$(openssl rand -hex 64 2>/dev/null || head -c 128 /dev/urandom | base64)
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64)
    
    cat > "$SCRIPT_DIR/.env" << EOF
# 服务端口
SERVER_PORT=3001

# 数据库配置
DB_TYPE=$DB_TYPE
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# 安全密钥
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
SESSION_SECRET=$SESSION_SECRET

# CORS配置
CORS_ORIGIN=http://localhost:3001
EOF
    
    echo "✅ 环境配置创建完成"
fi

# 创建数据目录
mkdir -p data uploads/avatars uploads/works

# 构建并启动
echo "📦 构建 Docker 镜像..."
docker compose build

echo "🚀 启动服务..."
docker compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
for i in $(seq 1 30); do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ 服务启动成功"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

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
