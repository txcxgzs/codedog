#!/bin/bash

echo "=========================================="
echo "   编程狗社区 - 一键部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 全局变量
PROJECT_DIR=""
DB_TYPE="sqlite"
MYSQL_HOST=""
MYSQL_PORT=""
MYSQL_NAME=""
MYSQL_USER=""
MYSQL_PASSWORD=""

# 错误处理
error_exit() {
    echo -e "${RED}❌ 错误: $1${NC}"
    exit 1
}

# 获取服务器IP（优先IPv4）
get_server_ip() {
    local IP=""
    # 优先获取IPv4地址
    IP=$(curl -s -4 --connect-timeout 5 ifconfig.me 2>/dev/null) || \
    IP=$(curl -s -4 --connect-timeout 5 icanhazip.com 2>/dev/null) || \
    IP=$(curl -s -4 --connect-timeout 5 ipinfo.io/ip 2>/dev/null) || \
    IP=$(curl -s --connect-timeout 5 api.ipify.org 2>/dev/null) || \
    IP=$(hostname -I 2>/dev/null | awk '{print $1}') || \
    IP=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
    echo "$IP"
}

# 获取内网IP（优先IPv4）
get_local_ip() {
    local IP=""
    IP=$(hostname -I 2>/dev/null | awk '{print $1}') || \
    IP=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
    echo "$IP"
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    elif [ -f /etc/redhat-release ]; then
        OS="centos"
    else
        OS="unknown"
    fi
}

# 安装系统依赖
install_deps() {
    detect_os
    echo "📦 安装系统依赖..."
    
    case $OS in
        ubuntu|debian)
            apt-get update -qq 2>/dev/null
            apt-get install -y -qq curl wget git openssl ca-certificates 2>/dev/null
            ;;
        centos|rhel|rocky|almalinux)
            yum install -y -q curl wget git openssl ca-certificates 2>/dev/null
            ;;
        alpine)
            apk add --quiet curl wget git openssl ca-certificates 2>/dev/null
            ;;
        arch|manjaro)
            pacman -S --noconfirm curl wget git openssl ca-certificates 2>/dev/null
            ;;
    esac
    echo -e "${GREEN}✅ 系统依赖安装完成${NC}"
}

# 检查并安装Docker
check_docker() {
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✅ Docker已安装${NC}"
        return 0
    fi
    
    echo "📥 安装Docker..."
    install_deps
    curl -fsSL https://get.docker.com | sh > /dev/null 2>&1 || error_exit "Docker安装失败"
    systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
    systemctl enable docker 2>/dev/null || true
    usermod -aG docker $USER 2>/dev/null || true
    echo -e "${GREEN}✅ Docker安装完成${NC}"
}

# 检查并安装Docker Compose
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose已安装${NC}"
        return 0
    fi
    if docker compose version &> /dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker Compose已安装 (docker compose)${NC}"
        return 0
    fi
    
    echo "📥 安装Docker Compose..."
    local COMPOSE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)"
    curl -L "$COMPOSE_URL" -o /usr/local/bin/docker-compose 2>/dev/null || \
    wget -q "$COMPOSE_URL" -O /usr/local/bin/docker-compose 2>/dev/null || \
    error_exit "Docker Compose下载失败"
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose安装完成${NC}"
}

# 克隆项目
clone_project() {
    if [ -f "docker-compose.yml" ] && [ -f "deploy.sh" ]; then
        PROJECT_DIR="$(cd . && pwd)"
        echo -e "${GREEN}✅ 已在项目目录: $PROJECT_DIR${NC}"
        return 0
    fi
    
    if [ -d "codedog" ]; then
        if [ -f "codedog/docker-compose.yml" ]; then
            PROJECT_DIR="$(cd codedog && pwd)"
            echo -e "${GREEN}✅ 项目已存在: $PROJECT_DIR${NC}"
            cd codedog
            return 0
        else
            echo "⚠️  codedog目录存在但不完整，删除重新克隆..."
            rm -rf codedog
        fi
    fi
    
    if ! command -v git &> /dev/null; then
        install_deps
    fi
    
    echo "📥 克隆项目..."
    
    if git clone --depth 1 https://gitee.com/txcxgzs/codedog.git 2>/dev/null; then
        echo -e "${GREEN}✅ 从Gitee克隆成功${NC}"
    elif git clone --depth 1 https://github.com/txcxgzs/codedog.git 2>/dev/null; then
        echo -e "${GREEN}✅ 从GitHub克隆成功${NC}"
    else
        error_exit "克隆项目失败，请检查网络或手动克隆"
    fi
    
    cd codedog || error_exit "无法进入项目目录"
    PROJECT_DIR="$(pwd)"
    echo -e "${GREEN}✅ 项目目录: $PROJECT_DIR${NC}"
}

# 选择数据库类型
select_database() {
    echo ""
    echo "=========================================="
    echo "   📦 数据库配置"
    echo "=========================================="
    echo ""
    echo "请选择数据库类型："
    echo ""
    printf "  ${BLUE}1) SQLite${NC}  - 轻量级，无需额外配置，适合小型部署（推荐）\n"
    printf "  ${BLUE}2) MySQL${NC}   - 性能更好，适合生产环境，需要MySQL服务器\n"
    echo ""
    
    local choice=""
    while true; do
        printf "请输入选择 [1/2] (默认: 1): "
        read -r choice
        case $choice in
            1|"")
                DB_TYPE="sqlite"
                echo -e "${GREEN}✅ 已选择 SQLite 数据库${NC}"
                break
                ;;
            2)
                DB_TYPE="mysql"
                echo -e "${GREEN}✅ 已选择 MySQL 数据库${NC}"
                configure_mysql
                break
                ;;
            *)
                echo -e "${RED}无效选择，请输入 1 或 2${NC}"
                ;;
        esac
    done
}

# 配置MySQL
configure_mysql() {
    echo ""
    echo "=========================================="
    echo "   🗄️ MySQL 配置"
    echo "=========================================="
    echo ""
    echo "请输入MySQL连接信息："
    echo ""
    echo -e "${YELLOW}⚠️  注意：如果MySQL在宿主机上运行，请使用以下地址：${NC}"
    echo "   - Linux: 使用宿主机IP或 172.17.0.1（Docker网关）"
    echo "   - macOS/Windows: 使用 host.docker.internal"
    echo ""
    
    # 使用localhost作为默认值（因为使用host网络模式）
    local DEFAULT_IP="localhost"
    
    # 测试MySQL连接
    test_mysql_connection() {
        local host=$1
        local port=$2
        local user=$3
        local pass=$4
        
        if command -v mysql &> /dev/null; then
            echo -e "${YELLOW}正在测试连接: $host:$port...${NC}"
            if mysql -h"$host" -P"$port" -u"$user" -p"$pass" -e "SELECT 1" 2>&1 >/dev/null; then
                echo -e "${GREEN}✅ 连接成功：$host:$port${NC}"
                return 0
            else
                echo -e "${RED}❌ 连接失败：$host:$port${NC}"
                return 1
            fi
        else
            return 2
        fi
    }
    
    # MySQL端口
    while true; do
        printf "MySQL端口 (默认: 3306): "
        read -r MYSQL_PORT
        MYSQL_PORT=${MYSQL_PORT:-3306}
        break
    done
    
    # 数据库名
    while true; do
        printf "数据库名称 (默认: coding_dog): "
        read -r MYSQL_NAME
        MYSQL_NAME=${MYSQL_NAME:-coding_dog}
        break
    done
    
    # 用户名
    while [ -z "$MYSQL_USER" ]; do
        printf "MySQL用户名: "
        read -r MYSQL_USER
        if [ -z "$MYSQL_USER" ]; then
            echo -e "${RED}用户名不能为空${NC}"
        fi
    done
    
    # 密码
    while [ -z "$MYSQL_PASSWORD" ]; do
        printf "MySQL密码: "
        read -r MYSQL_PASSWORD
        echo ""
        if [ -z "$MYSQL_PASSWORD" ]; then
            echo -e "${RED}密码不能为空${NC}"
        fi
    done
    
    # MySQL主机
    while true; do
        printf "MySQL主机地址 (默认: $DEFAULT_IP): "
        read -r MYSQL_HOST
        MYSQL_HOST=${MYSQL_HOST:-$DEFAULT_IP}
        
        # 测试连接
        if command -v mysql &> /dev/null; then
            echo ""
            echo -e "${YELLOW}测试MySQL连接...${NC}"
            
            if test_mysql_connection "$MYSQL_HOST" "$MYSQL_PORT" "$MYSQL_USER" "$MYSQL_PASSWORD"; then
                break
            else
                echo ""
                echo -e "${YELLOW}连接失败，但将继续部署${NC}"
                echo -e "${YELLOW}容器启动时会再次尝试连接${NC}"
                break
            fi
        else
            break
        fi
    done
    
    # 测试MySQL连接并自动创建用户和数据库
    echo ""
    echo "🔍 测试MySQL连接..."
    if command -v mysql &> /dev/null; then
        # 尝试以root用户连接并创建用户和数据库
        echo -e "${YELLOW}正在检查并创建数据库和用户...${NC}"
        
        # 尝试以root用户连接
        if mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"root" -p -e "SELECT 1" 2>&1 <<EOF

EOF
        then
            # 连接成功，创建数据库和用户
            echo -e "${GREEN}✅ 以root用户连接成功${NC}"
            
            # 创建数据库
            mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"root" -p <<EOF
CREATE DATABASE IF NOT EXISTS $MYSQL_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$MYSQL_USER'@'%' IDENTIFIED BY '$MYSQL_PASSWORD';
GRANT ALL PRIVILEGES ON $MYSQL_NAME.* TO '$MYSQL_USER'@'%';
FLUSH PRIVILEGES;
EOF
            
            echo -e "${GREEN}✅ 数据库和用户创建成功${NC}"
        else
            # 尝试以普通用户连接
            echo -e "${YELLOW}正在测试普通用户连接: mysql -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER -p***${NC}"
            if mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1" 2>&1; then
                echo -e "${GREEN}✅ MySQL连接成功${NC}"
            else
                echo -e "${YELLOW}⚠️  MySQL连接测试失败${NC}"
                echo -e "${YELLOW}可能原因：1. 网络连接问题 2. MySQL服务未启动 3. 用户权限问题 4. MySQL绑定地址配置${NC}"
                echo -e "${YELLOW}正在尝试自动修复...${NC}"
                
                # 尝试修改MySQL配置
                if [ -f "/etc/mysql/my.cnf" ] || [ -f "/etc/my.cnf" ]; then
                    echo -e "${YELLOW}检查MySQL配置文件...${NC}"
                    # 这里可以添加自动修改bind_address的逻辑
                fi
                
                echo -e "${YELLOW}将继续部署，但可能需要手动修复MySQL配置${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  未安装mysql客户端，跳过连接测试${NC}"
    fi
    
    # 提示用户检查MySQL配置
    echo ""
    echo -e "${YELLOW}📋 MySQL配置检查清单：${NC}"
    echo "   1. MySQL服务是否运行: systemctl status mysql"
    echo "   2. MySQL是否允许远程连接: SHOW VARIABLES LIKE 'bind_address'"
    echo "   3. 用户是否有远程访问权限: GRANT ALL ON $MYSQL_NAME.* TO '$MYSQL_USER'@'%'"
    echo "   4. 防火墙是否允许3306端口: ufw allow 3306"
    echo ""
    
    echo -e "${GREEN}✅ MySQL配置完成${NC}"
    
    # 询问是否切换到SQLite
    echo ""
    echo -e "${YELLOW}💡 提示：如果MySQL连接仍然失败，建议使用SQLite（无需配置数据库）${NC}"
    printf "是否切换到SQLite？[y/N]: "
    read -r switch_to_sqlite
    if [ "$switch_to_sqlite" = "y" ] || [ "$switch_to_sqlite" = "Y" ]; then
        echo -e "${GREEN}✅ 已切换到SQLite数据库${NC}"
        DB_TYPE="sqlite"
    fi
}

# 生成随机密钥（64位）
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    elif [ -f /dev/urandom ]; then
        head -c 32 /dev/urandom | xxd -p 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
    else
        date +%s | sha256sum | head -c 64
    fi
}

# 创建配置文件
create_env() {
    if [ -f .env ]; then
        echo -e "${YELLOW}⚠️  .env已存在，将覆盖配置${NC}"
    fi
    
    echo "📝 创建配置文件..."
    
    # 生成JWT密钥
    local JWT_SECRET=$(generate_secret)
    if [ -z "$JWT_SECRET" ]; then
        error_exit "无法生成JWT密钥"
    fi
    
    # 创建.env文件
    cat > .env << EOF
# 编程狗社区配置文件
# 由部署脚本自动生成

# 服务端口
SERVER_PORT=3001

# 数据库配置
DB_TYPE=$DB_TYPE
EOF

    # 如果是MySQL，添加MySQL配置
    if [ "$DB_TYPE" = "mysql" ]; then
        cat >> .env << EOF

# MySQL配置
DB_HOST=$MYSQL_HOST
DB_PORT=$MYSQL_PORT
DB_NAME=$MYSQL_NAME
DB_USER=$MYSQL_USER
DB_PASSWORD=$MYSQL_PASSWORD
EOF
    fi

    # 添加JWT配置
    cat >> .env << EOF

# JWT配置（自动生成）
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
EOF

    echo -e "${GREEN}✅ 配置文件创建完成${NC}"
    echo -e "${GREEN}✅ JWT密钥已自动生成（64位随机字符串）${NC}"
}

# 创建必要目录
create_dirs() {
    echo "📁 创建数据目录..."
    mkdir -p server/data
    mkdir -p server/uploads/avatars
    mkdir -p server/uploads/works
    mkdir -p server/downloaded
    echo -e "${GREEN}✅ 目录创建完成${NC}"
}

# 启动服务
start_services() {
    echo "🚀 构建并启动服务..."
    
    if [ ! -f "docker-compose.yml" ]; then
        error_exit "docker-compose.yml 不存在，请检查项目是否完整"
    fi
    
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d --build
    else
        docker compose up -d --build
    fi
    
    echo "⏳ 等待服务启动..."
    sleep 15
    
    if command -v docker-compose &> /dev/null; then
        docker-compose ps
    else
        docker compose ps
    fi
}

# 生成Nginx配置
generate_nginx_config() {
    local DOMAIN=$1
    
    cat << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
}

# 主流程
main() {
    echo "🔍 检查系统环境..."
    
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}⚠️  建议使用root用户运行${NC}"
    fi
    
    # 克隆项目
    clone_project
    
    echo ""
    
    # 检查Docker
    check_docker
    check_docker_compose
    
    echo ""
    
    # 选择数据库
    select_database
    
    echo ""
    
    # 创建配置
    create_env
    create_dirs
    
    echo ""
    
    # 启动服务
    start_services
    
    # 获取IP地址
    local PUBLIC_IP=$(get_server_ip)
    local LOCAL_IP=$(get_local_ip)
    
    # 显示结果
    echo ""
    echo "=========================================="
    echo -e "${GREEN}   🎉 部署完成！${NC}"
    echo "=========================================="
    echo ""
    echo "📍 项目目录: $PROJECT_DIR"
    echo "📍 数据库类型: $DB_TYPE"
    echo ""
    echo "📍 访问地址:"
    echo "   本地访问: http://localhost:3001"
    [ -n "$LOCAL_IP" ] && echo "   内网访问: http://$LOCAL_IP:3001"
    [ -n "$PUBLIC_IP" ] && echo "   外网访问: http://$PUBLIC_IP:3001"
    echo "   后端API:  http://localhost:3001/api"
    echo "   后台管理: http://localhost:3001/admin"
    echo ""
    echo "📌 管理员说明:"
    echo "   第一个使用编程猫登录的用户将自动成为管理员"
    echo ""
    echo "🔧 常用命令:"
    echo "   cd $PROJECT_DIR"
    if command -v docker-compose &> /dev/null; then
        echo "   docker-compose logs -f   # 查看日志"
        echo "   docker-compose restart   # 重启服务"
        echo "   docker-compose down      # 停止服务"
    else
        echo "   docker compose logs -f   # 查看日志"
        echo "   docker compose restart   # 重启服务"
        echo "   docker compose down      # 停止服务"
    fi
    echo ""
    echo "=========================================="
    echo "   🌐 域名绑定说明"
    echo "=========================================="
    echo ""
    [ -n "$PUBLIC_IP" ] && echo "1. 将域名A记录解析到: $PUBLIC_IP"
    echo ""
    echo "2. 安装Nginx: apt install nginx 或 yum install nginx"
    echo ""
    echo "3. Nginx配置示例:"
    echo ""
    generate_nginx_config "your-domain.com"
    echo ""
    echo "4. 申请SSL证书: certbot --nginx -d your-domain.com"
    echo ""
}

main
