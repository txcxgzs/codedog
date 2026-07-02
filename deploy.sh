#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 持久化目录(与 docker-compose.yml 挂载路径保持一致)
DATA_PATH="$SCRIPT_DIR/data"
HOST_DB_PATH="$DATA_PATH/database.sqlite"

echo "========================================"
echo "  CodeDog 一键部署脚本"
echo "========================================"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "错误：未安装 Docker，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose，自动兼容新版 docker compose 和旧版 docker-compose
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "错误：未安装 Docker Compose，请先安装 Docker Compose"
    exit 1
fi
echo "使用 Compose 命令：$COMPOSE_CMD"

# 拉取最新代码
echo ""
echo "正在拉取最新代码..."
git pull origin main 2>/dev/null || echo "警告：无法拉取最新代码，将继续使用本地代码部署"

append_or_replace_env() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" .env 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" .env
    else
        echo "${key}=${value}" >> .env
    fi
}

generate_secret() {
    local bytes="$1"
    openssl rand -hex "$bytes" 2>/dev/null || head -c "$bytes" /dev/urandom | od -An -tx1 | tr -d ' \n'
}

# 清理 SQLite 残留 backup 表(避免 sync alter 残留导致启动崩溃)
clean_backup_tables() {
    if [ ! -f "$HOST_DB_PATH" ] || ! command -v sqlite3 >/dev/null 2>&1; then
        return 0
    fi
    local BACKUP_TABLES
    BACKUP_TABLES=$(sqlite3 "$HOST_DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_backup';" 2>/dev/null || true)
    if [ -n "$BACKUP_TABLES" ]; then
        echo "发现残留 backup 表,清理中:"
        echo "$BACKUP_TABLES" | sed 's/^/  /'
        echo "$BACKUP_TABLES" | while read -r t; do
            [ -n "$t" ] && sqlite3 "$HOST_DB_PATH" "DROP TABLE IF EXISTS \"$t\";" 2>/dev/null && echo "  已删除: $t"
        done
    fi
}

# 启动失败时智能诊断: 扫描日志中已知崩溃模式并给出修复建议
diagnose_startup_failure() {
    echo ""
    echo "=== 启动失败智能诊断 ==="
    local LOGS
    LOGS=$($COMPOSE_CMD logs --tail=80 codedog 2>/dev/null || true)

    if echo "$LOGS" | grep -qi "SQLITE_ERROR.*backup\|already exists.*backup\|UNIQUE constraint failed: users_backup"; then
        echo "  [诊断] SQLite backup 表残留 → 运行 codedog 工具箱菜单5→选项4"
    fi
    if echo "$LOGS" | grep -qi "JWT_SECRET\|SESSION_SECRET.*required\|SESSION_SECRET.*must"; then
        echo "  [诊断] JWT_SECRET 或 SESSION_SECRET 缺失/过短 → 检查 .env"
    fi
    if echo "$LOGS" | grep -qi "CORS_ORIGIN.*required\|CORS_ORIGIN.*must"; then
        echo "  [诊断] 生产环境缺少 CORS_ORIGIN → 在 .env 设置 CORS_ORIGIN=https://你的域名"
    fi
    if echo "$LOGS" | grep -qi "getDialectName is not a function"; then
        echo "  [诊断] 旧版本 Sequelize 适配代码 → 确认 git pull 最新代码并 --no-cache 重建"
    fi
    if echo "$LOGS" | grep -qi "EADDRINUSE\|port.*already in use"; then
        echo "  [诊断] 端口 3001 被占用 → lsof -i:3001 或 netstat -tlnp | grep 3001"
    fi
    if echo "$LOGS" | grep -qi "ECONNREFUSED\|connect ECONNREFUSED.*3306\|database.*connection.*fail"; then
        echo "  [诊断] 数据库连接失败 → 检查 DB_TYPE 配置和 MySQL 服务"
    fi
    if echo "$LOGS" | grep -qi "Cannot find module\|MODULE_NOT_FOUND"; then
        echo "  [诊断] Node 模块缺失 → 确认 --no-cache 重建镜像"
    fi

    echo ""
    echo "--- 最近 40 行日志 ---"
    echo "$LOGS" | tail -40
    echo "---------------------"
}

# 创建 .env 配置文件
if [ ! -f .env ] || [ ! -s .env ]; then
    echo ""
    echo "正在创建 .env 环境配置..."
    
    echo ""
    echo "请选择数据库类型："
    echo "  1) SQLite（默认，轻量级）"
    echo "  2) MySQL（需要已有 MySQL 服务）"
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
        read -p "MySQL 主机地址 [localhost]: " input_host
        DB_HOST=${input_host:-localhost}
        read -p "MySQL 端口 [3306]: " input_port
        DB_PORT=${input_port:-3306}
        read -p "MySQL 数据库名 [coding_dog]: " input_name
        DB_NAME=${input_name:-coding_dog}
        read -p "MySQL 用户名 [root]: " input_user
        DB_USER=${input_user:-root}
        read -sp "MySQL 密码: " input_pass
        DB_PASSWORD=${input_pass}
        echo ""
    fi
    
    cat > .env << ENVEOF
SERVER_PORT=3001
DB_TYPE=$DB_TYPE
DB_PATH=./data/database.sqlite
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$(generate_secret 64)
JWT_EXPIRES_IN=7d
SESSION_SECRET=$(generate_secret 32)
CORS_ORIGIN=http://localhost:3001
ENVEOF
    
    echo ".env 创建完成"
else
    echo "使用现有 .env 配置"
fi

# 修复旧版本安装器生成的不完整 .env
if ! grep -q '^DB_PATH=' .env; then
    append_or_replace_env "DB_PATH" "./data/database.sqlite"
fi
if ! grep -q '^JWT_EXPIRES_IN=' .env; then
    append_or_replace_env "JWT_EXPIRES_IN" "7d"
fi
if ! grep -q '^CORS_ORIGIN=' .env || [ -z "$(grep '^CORS_ORIGIN=' .env | tail -1 | cut -d= -f2-)" ]; then
    append_or_replace_env "CORS_ORIGIN" "http://localhost:3001"
fi
# 修复: JWT_SECRET/SESSION_SECRET 长度校验改为 >=32 字符(原正则只匹配32,会把33字符的合法值也判为不合法)
if ! grep -qE '^JWT_SECRET=.{32,}' .env; then
    append_or_replace_env "JWT_SECRET" "$(generate_secret 64)"
fi
if ! grep -qE '^SESSION_SECRET=.{32,}' .env; then
    append_or_replace_env "SESSION_SECRET" "$(generate_secret 32)"
fi

# 创建持久化目录并修复权限。容器使用非 root 用户运行，挂载目录必须可写。
echo ""
echo "正在准备数据目录和上传目录..."
mkdir -p data uploads/avatars uploads/works
chmod -R a+rwX data uploads 2>/dev/null || true

# 清理 SQLite 残留 backup 表(避免旧版 sync alter 残留导致启动崩溃)
echo ""
echo "正在检查 SQLite 残留 backup 表..."
if [ -f "$HOST_DB_PATH" ] && command -v sqlite3 >/dev/null 2>&1; then
    clean_backup_tables
else
    echo "  无现有数据库,跳过"
fi

# 构建并启动
echo ""
echo "正在构建 Docker 镜像(强制 --no-cache,避免旧 layer 缓存)..."
$COMPOSE_CMD build --no-cache

echo ""
echo "正在启动服务..."
$COMPOSE_CMD down
$COMPOSE_CMD up -d

# 等待服务启动
echo ""
echo "正在等待服务启动..."
SERVICE_READY=0
for i in $(seq 1 60); do
    if curl -fs http://localhost:3001/api/health > /dev/null 2>&1; then
        SERVICE_READY=1
        echo "服务启动成功！"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ "$SERVICE_READY" != "1" ]; then
    # 修复: 之前只打日志不诊断,用户看不懂为啥崩;现在调用智能诊断给出修复建议
    echo ""
    echo "错误：服务未能正常启动,进入诊断模式..."
    diagnose_startup_failure
    exit 1
fi

# 安装管理工具
echo ""
echo "正在安装 codedog 管理工具..."
if [ -f "$SCRIPT_DIR/install-cli.sh" ]; then
    chmod +x "$SCRIPT_DIR/install-cli.sh"
    bash "$SCRIPT_DIR/install-cli.sh"
fi

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "  访问地址：http://localhost:3001"
echo "  后台地址：http://localhost:3001/admin"
echo "  管理工具：codedog"
echo ""
