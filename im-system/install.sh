#!/usr/bin/env bash
set -Eeuo pipefail

# CodeDog IM Linux interactive installer. Configuration is collected here so
# administrators never need to edit .env by hand.
REPO_URL="${CODEDOG_REPO_URL:-https://github.com/txcxgzs/codedog.git}"
INSTALL_DIR="${CODEDOG_IM_DIR:-/opt/codedog}"

say() { printf '\n%s\n' "$*"; }
ask() { local prompt="$1" default="${2:-}" value; read -r -p "$prompt${default:+ [$default]}: " value; printf '%s' "${value:-$default}"; }
yesno() { local prompt="$1" default="${2:-Y}" value; read -r -p "$prompt [${default}/$([ "$default" = Y ] && echo n || echo y)]: " value; value="${value:-$default}"; [[ "$value" =~ ^[Yy]$ ]]; }
secret() { openssl rand -hex "$1"; }

if [ "$(id -u)" -ne 0 ]; then echo "请使用 root 运行：sudo bash install.sh"; exit 1; fi

say "======================================
  CodeDog IM 一键部署向导
======================================"
INSTALL_DIR="$(ask '安装目录' "$INSTALL_DIR")"
PUBLIC_URL="$(ask 'IM 对外地址（含 /im）' 'http://服务器IP:8100/im')"
HTTP_PORT="$(ask 'IM 对外端口' '8100')"

if yesno '使用安装器内置的 MySQL（推荐）' Y; then
  DB_MODE=builtin
  DB_PASSWORD="$(secret 24)"; DB_ROOT_PASSWORD="$(secret 24)"
  DATABASE_URL="mysql://im_user:${DB_PASSWORD}@mysql:3306/codedog_im"
else
  DB_MODE=external
  DATABASE_URL="$(ask 'MySQL 连接地址' 'mysql://用户名:密码@127.0.0.1:3306/codedog_im')"
fi

if yesno '使用安装器内置的 Redis（推荐，不开放公网端口）' Y; then
  REDIS_MODE=builtin; REDIS_URL='redis://redis:6379/0'
else
  REDIS_MODE=external
  REDIS_URL="$(ask 'Redis 连接地址' 'redis://:密码@127.0.0.1:6379/0')"
fi

COMMUNITY_DIR=""
if yesno '是否同时绑定本机的编程狗社区' Y; then
  COMMUNITY_DIR="$(ask '编程狗项目目录' "$INSTALL_DIR")"
fi

say "即将安装依赖（已存在的软件和 Docker/npm 缓存会复用）"
apt-get update
apt-get install -y git curl ca-certificates openssl
node_major=0
command -v node >/dev/null 2>&1 && node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$node_major" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v docker >/dev/null 2>&1; then
  yesno '未安装 Docker，是否自动安装' Y || exit 1
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || { echo '需要 Docker Compose v2'; exit 1; }

if [ -f "$(pwd)/package.json" ] && [ -d "$(pwd)/apps/server" ]; then
  IM_DIR="$(pwd)"; REPO_ROOT="$(cd .. && pwd)"
elif [ -f "$INSTALL_DIR/im-system/package.json" ]; then
  git -C "$INSTALL_DIR" pull --ff-only
  REPO_ROOT="$INSTALL_DIR"; IM_DIR="$INSTALL_DIR/im-system"
else
  [ ! -e "$INSTALL_DIR" ] || { echo "目录已存在但不是 CodeDog 仓库：$INSTALL_DIR"; exit 1; }
  git clone --depth=1 "$REPO_URL" "$INSTALL_DIR"
  REPO_ROOT="$INSTALL_DIR"; IM_DIR="$INSTALL_DIR/im-system"
fi
cd "$IM_DIR"

ORIGIN="$(printf '%s' "$PUBLIC_URL" | sed -E 's|(https?://[^/]+).*|\1|')"
COMPOSE_FILE=docker-compose.yml
if [ "$DB_MODE" = external ] || [ "$REDIS_MODE" = external ]; then
  COMPOSE_FILE=docker-compose.external.yml
fi
cat > .env <<EOF
NODE_ENV=production
IM_PORT=3100
IM_HTTP_PORT=$HTTP_PORT
IM_PUBLIC_ORIGIN=$ORIGIN
IM_ADMIN_ORIGIN=$ORIGIN
IM_SESSION_SECRET=$(secret 32)
IM_SSO_PUBLIC_KEY_FILE=./secrets/im_sso_public.pem
IM_DATABASE_URL=$DATABASE_URL
IM_REDIS_URL=$REDIS_URL
IM_DB_PASSWORD=${DB_PASSWORD:-unused}
IM_DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD:-unused}
IM_GROUP_DEFAULT_LIMIT=100
IM_GROUP_HARD_LIMIT=5000
COMPOSE_FILE=$COMPOSE_FILE
IMAGE_HOST_ENDPOINT=https://img.scdn.io/api/v1.php
IMAGE_HOST_CDN_DOMAIN=img.scdn.io
IMAGE_HOST_STORAGE_DESTINATION=telegram
EOF
[ -f secrets/im_sso_public.pem ] || node scripts/keygen.js
chmod 600 .env secrets/im_sso_private.pem

if [ "$COMPOSE_FILE" = docker-compose.external.yml ]; then
  # Mixed mode keeps only the selected local dependencies in a generated file.
  if [ "$DB_MODE" = builtin ] || [ "$REDIS_MODE" = builtin ]; then
    echo '混合模式暂不支持；数据库与 Redis 请同时选择内置或同时选择外部。'
    exit 1
  fi
fi

npm ci
npm run check
docker compose up -d --build

for _ in $(seq 1 45); do
  curl -fsS "http://127.0.0.1:${HTTP_PORT}/im/health" >/dev/null 2>&1 && healthy=true && break
  sleep 2
done
[ "${healthy:-false}" = true ] || { docker compose logs --tail=100; echo 'IM 健康检查失败'; exit 1; }

if [ -n "$COMMUNITY_DIR" ]; then
  [ -f "$COMMUNITY_DIR/.env" ] || { echo "找不到编程狗配置：$COMMUNITY_DIR/.env"; exit 1; }
  PRIVATE_B64="$(base64 -w0 secrets/im_sso_private.pem)"
  set_community() { local key="$1" value="$2"; if grep -qE "^${key}=" "$COMMUNITY_DIR/.env"; then sed -i "s|^${key}=.*|${key}=${value}|" "$COMMUNITY_DIR/.env"; else printf '%s=%s\n' "$key" "$value" >> "$COMMUNITY_DIR/.env"; fi; }
  set_community IM_PUBLIC_URL "$PUBLIC_URL"
  set_community IM_SSO_PRIVATE_KEY_BASE64 "$PRIVATE_B64"
  (cd "$COMMUNITY_DIR" && docker compose up -d --build codedog)
fi

say "部署完成
用户端：$PUBLIC_URL/
管理后台：$PUBLIC_URL/admin/
健康检查：${ORIGIN}:${HTTP_PORT}/im/health
管理工具：cd $IM_DIR && ./im.sh"
