#!/bin/bash

# 编程狗社区 - 更新脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    编程狗社区 - 更新脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 进入项目目录
cd "$(dirname "$0")"

# 停止容器
print_info "停止容器..."
docker-compose down

# 重新构建
print_info "重新构建镜像..."
docker-compose build --no-cache

# 启动容器
print_info "启动容器..."
docker-compose up -d

# 等待服务
print_info "等待服务启动..."
sleep 5

# 检查状态
if curl -s http://localhost:3001/api > /dev/null 2>&1; then
    print_success "更新完成，服务正常运行"
else
    echo -e "${YELLOW}警告: 服务可能未正常启动，请检查日志${NC}"
fi

echo ""
echo "查看日志: docker-compose logs -f"
echo ""
