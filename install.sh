#!/bin/bash

# ========================================
# 编程狗社区 - 一键安装脚本
# 支持系统: Ubuntu/Debian/CentOS
# 部署方式: Docker / 宝塔面板 / 本地开发
# ========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 打印函数
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# 显示Banner
show_banner() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}║      编程狗社区 - 一键安装脚本         ║${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "支持系统: ${YELLOW}Ubuntu/Debian/CentOS${NC}"
    echo -e "部署方式: ${YELLOW}Docker / 宝塔面板 / 本地开发${NC}"
    echo ""
}

# 检查系统
check_system() {
    print_step "检测系统环境..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        print_info "检测到系统: $PRETTY_NAME"
    else
        print_error "无法检测系统版本"
        exit 1
    fi
    
    # 检测是否为root用户
    if [ "$EUID" -ne 0 ]; then
        print_warning "建议使用root用户运行此脚本"
        SUDO="sudo"
    else
        SUDO=""
    fi
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 安装依赖包
install_dependencies() {
    print_step "安装必要依赖..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        $SUDO apt-get update -qq
        $SUDO apt-get install -y -qq curl wget git > /dev/null
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        $SUDO yum install -y -q curl wget git > /dev/null 2>&1 || \
        $SUDO dnf install -y -q curl wget git > /dev/null 2>&1
    fi
    
    print_success "依赖安装完成"
}

# 安装Docker
install_docker() {
    print_step "安装Docker..."
    
    if command_exists docker; then
        print_info "Docker已安装: $(docker --version)"
        return 0
    fi
    
    # 使用官方脚本安装
    curl -fsSL https://get.docker.com | $SUDO sh
    
    # 启动Docker
    $SUDO systemctl start docker
    $SUDO systemctl enable docker
    
    # 将当前用户加入docker组
    if [ -n "$SUDO_USER" ]; then
        $SUDO usermod -aG docker $SUDO_USER
    fi
    
    print_success "Docker安装完成"
}

# 安装Docker Compose
install_docker_compose() {
    print_step "安装Docker Compose..."
    
    if docker compose version >/dev/null 2>&1; then
        print_info "Docker Compose已安装"
        return 0
    fi
    
    # 下载最新版本
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    
    $SUDO curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    
    $SUDO chmod +x /usr/local/bin/docker-compose
    
    print_success "Docker Compose安装完成"
}

# 创建环境配置
create_env() {
    print_step "创建环境配置..."
    
    if [ -f .env ]; then
        print_info "使用现有环境配置"
        return 0
    fi
    
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        # 创建默认配置
        cat > .env << 'EOF'
# 服务端口配置
CLIENT_PORT=8080
SERVER_PORT=3001

# 数据库配置
# 可选值: sqlite, mysql
DB_TYPE=sqlite

# MySQL配置（当DB_TYPE=mysql时使用）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=coding_dog
DB_USER=root
DB_PASSWORD=

# JWT配置
JWT_SECRET=please-change-this-to-a-random-string-at-least-64-characters
JWT_EXPIRES_IN=7d
EOF
    fi
    
    # 生成安全的JWT密钥
    JWT_SECRET=$(openssl rand -hex 64 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 128 | head -n 1)
    if [ -n "$JWT_SECRET" ]; then
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    fi
    
    print_success "环境配置创建完成"
}

# 创建必要目录
create_directories() {
    print_step "创建必要目录..."
    
    mkdir -p server/uploads/avatars
    mkdir -p server/uploads/works
    mkdir -p server/data
    
    # 创建.gitkeep文件保持目录结构
    touch server/uploads/.gitkeep
    touch server/data/.gitkeep
    
    print_success "目录创建完成"
}

# Docker部署
deploy_docker() {
    print_step "开始Docker部署..."
    
    # 检查并安装Docker
    install_docker
    install_docker_compose
    
    # 创建配置
    create_env
    create_directories
    
    # 停止旧容器
    print_info "停止旧容器..."
    docker-compose down 2>/dev/null || true
    
    # 构建并启动
    print_info "构建并启动容器（首次构建可能需要几分钟）..."
    export DOCKER_BUILDKIT=0
    docker-compose up -d --build
    
    # 等待服务启动
    wait_for_service
    
    show_result "docker"
}

# 宝塔面板部署
deploy_baota() {
    print_step "开始宝塔面板部署..."
    
    # 检查Node.js
    if ! command_exists node; then
        print_info "未检测到Node.js，请先在宝塔面板中安装Node.js版本管理器"
        print_info "安装路径: 软件商店 -> 搜索 'Node版本管理器' -> 安装"
        exit 1
    fi
    
    NODE_VERSION=$(node -v)
    print_info "Node.js版本: $NODE_VERSION"
    
    # 创建配置
    create_env
    create_directories
    
    # 安装后端依赖
    print_info "安装后端依赖..."
    cd server
    npm install --production
    cd ..
    
    # 安装前端依赖并构建
    print_info "安装前端依赖并构建..."
    cd client
    npm install
    npm run build
    cd ..
    
    print_success "构建完成"
    
    show_result "baota"
}

# 本地开发部署
deploy_local() {
    print_step "开始本地开发部署..."
    
    # 检查Node.js
    if ! command_exists node; then
        print_error "未安装Node.js，请先安装Node.js"
        print_info "下载地址: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v)
    NPM_VERSION=$(npm -v)
    print_info "Node.js版本: $NODE_VERSION"
    print_info "npm版本: $NPM_VERSION"
    
    # 创建配置
    create_env
    create_directories
    
    # 安装后端依赖
    print_info "安装后端依赖..."
    cd server
    npm install
    cd ..
    
    # 安装前端依赖
    print_info "安装前端依赖..."
    cd client
    npm install
    cd ..
    
    print_success "依赖安装完成"
    
    show_result "local"
}

# 等待服务启动
wait_for_service() {
    print_info "等待服务启动..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3001/api > /dev/null 2>&1; then
            print_success "服务启动成功"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo ""
    print_warning "服务启动超时，请检查日志: docker-compose logs -f"
    return 1
}

# 显示结果
show_result() {
    local deploy_type=$1
    
    # 获取服务器IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    CLIENT_PORT=$(grep CLIENT_PORT .env 2>/dev/null | cut -d'=' -f2 || echo "8080")
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║             部署成功！                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    case $deploy_type in
        docker)
            echo -e "  访问地址: ${YELLOW}http://${SERVER_IP}:${CLIENT_PORT}${NC}"
            echo ""
            echo "常用命令:"
            echo "  查看状态: docker-compose ps"
            echo "  查看日志: docker-compose logs -f"
            echo "  重启服务: docker-compose restart"
            echo "  停止服务: docker-compose down"
            ;;
        baota)
            echo -e "  前端地址: ${YELLOW}http://${SERVER_IP}:${CLIENT_PORT}${NC}"
            echo -e "  后端地址: ${YELLOW}http://${SERVER_IP}:3001${NC}"
            echo ""
            echo "启动命令:"
            echo "  后端: cd server && npm start"
            echo "  前端: cd client && npm run preview"
            echo ""
            echo "建议在宝塔面板中配置PM2守护进程和Nginx反向代理"
            ;;
        local)
            echo -e "  前端地址: ${YELLOW}http://localhost:8080${NC}"
            echo -e "  后端地址: ${YELLOW}http://localhost:3001${NC}"
            echo ""
            echo "启动命令:"
            echo "  后端: cd server && npm run dev"
            echo "  前端: cd client && npm run dev"
            ;;
    esac
    
    echo ""
    echo -e "  管理员说明: ${YELLOW}第一个使用编程猫登录的用户自动成为管理员${NC}"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo ""
}

# 选择部署方式
select_deploy_method() {
    echo ""
    echo "请选择部署方式:"
    echo ""
    echo "  1) Docker部署 (推荐)"
    echo "     - 自动安装Docker和Docker Compose"
    echo "     - 一键启动所有服务"
    echo "     - 适合生产环境"
    echo ""
    echo "  2) 宝塔面板部署"
    echo "     - 需要提前安装Node.js"
    echo "     - 手动配置PM2和Nginx"
    echo "     - 适合宝塔用户"
    echo ""
    echo "  3) 本地开发部署"
    echo "     - 需要提前安装Node.js"
    echo "     - 适合开发和测试"
    echo ""
    read -p "请输入选项 [1-3]: " choice
    
    case $choice in
        1) deploy_docker ;;
        2) deploy_baota ;;
        3) deploy_local ;;
        *) 
            print_error "无效选项"
            exit 1
            ;;
    esac
}

# 主函数
main() {
    show_banner
    check_system
    install_dependencies
    select_deploy_method
}

# 执行
main
