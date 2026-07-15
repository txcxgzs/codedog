#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${CODEDOG_REPO_URL:-https://github.com/txcxgzs/codedog.git}"
INSTALL_DIR="${CODEDOG_IM_DIR:-/opt/codedog}"
PUBLIC_URL="${CODEDOG_IM_PUBLIC_URL:-}"
COMMUNITY_DIR=""
INSTALL_DOCKER=false

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2 ;;
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --public-url) PUBLIC_URL="$2"; shift 2 ;;
    --community-dir) COMMUNITY_DIR="$2"; shift 2 ;;
    --install-docker) INSTALL_DOCKER=true; shift ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 root 运行，或执行: sudo bash install.sh ..."
  exit 1
fi

apt-get update
apt-get install -y git curl ca-certificates openssl
node_major=0
command -v node >/dev/null 2>&1 && node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$node_major" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v docker >/dev/null 2>&1; then
  if [ "$INSTALL_DOCKER" != true ]; then echo "未安装 Docker。重新运行时增加 --install-docker。"; exit 1; fi
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 不可用"; exit 1; }

if [ -f "$(pwd)/package.json" ] && [ -d "$(pwd)/apps/server" ]; then
  IM_DIR="$(pwd)"
elif [ -f "$INSTALL_DIR/im-system/package.json" ]; then
  git -C "$INSTALL_DIR" pull --ff-only
  IM_DIR="$INSTALL_DIR/im-system"
else
  [ ! -e "$INSTALL_DIR" ] || { echo "目标目录已存在但不是 CodeDog 仓库: $INSTALL_DIR"; exit 1; }
  git clone --depth=1 "$REPO_URL" "$INSTALL_DIR"
  IM_DIR="$INSTALL_DIR/im-system"
fi
cd "$IM_DIR"

[ -f .env ] || cp .env.example .env
set_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" .env; then sed -i "s|^${key}=.*|${key}=${value}|" .env; else printf '%s=%s\n' "$key" "$value" >> .env; fi
}
random_secret() { openssl rand -hex "$1"; }
grep -qE '^IM_SESSION_SECRET=.{32,}$' .env || set_env IM_SESSION_SECRET "$(random_secret 32)"
grep -qE '^IM_DB_PASSWORD=.+$' .env || set_env IM_DB_PASSWORD "$(random_secret 24)"
grep -qE '^IM_DB_ROOT_PASSWORD=.+$' .env || set_env IM_DB_ROOT_PASSWORD "$(random_secret 24)"
if [ -n "$PUBLIC_URL" ]; then
  ORIGIN="$(printf '%s' "$PUBLIC_URL" | sed -E 's|(https?://[^/]+).*|\1|')"
  set_env IM_PUBLIC_ORIGIN "$ORIGIN"
  set_env IM_ADMIN_ORIGIN "$ORIGIN"
fi
[ -f secrets/im_sso_public.pem ] || node scripts/keygen.js
chmod 600 .env secrets/im_sso_private.pem

npm ci
npm run check
docker compose up -d --build
healthy=false
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${IM_HTTP_PORT:-8100}/im/health" >/dev/null 2>&1; then healthy=true; break; fi
  sleep 2
done
if [ "$healthy" != true ]; then docker compose logs --tail=100; echo "IM 健康检查超时，部署失败"; exit 1; fi

if [ -n "$COMMUNITY_DIR" ]; then
  [ -f "$COMMUNITY_DIR/.env" ] || { echo "找不到编程狗环境文件: $COMMUNITY_DIR/.env"; exit 1; }
  [ -n "$PUBLIC_URL" ] || { echo "联合部署必须提供 --public-url"; exit 1; }
  PRIVATE_B64="$(base64 -w0 secrets/im_sso_private.pem)"
  update_community_env() { local key="$1" value="$2"; if grep -qE "^${key}=" "$COMMUNITY_DIR/.env"; then sed -i "s|^${key}=.*|${key}=${value}|" "$COMMUNITY_DIR/.env"; else printf '%s=%s\n' "$key" "$value" >> "$COMMUNITY_DIR/.env"; fi; }
  update_community_env IM_PUBLIC_URL "$PUBLIC_URL"
  update_community_env IM_SSO_PRIVATE_KEY_BASE64 "$PRIVATE_B64"
  (cd "$COMMUNITY_DIR" && docker compose up -d --build codedog)
fi

echo ""
echo "CodeDog IM 已部署。"
echo "用户端: ${PUBLIC_URL:-http://服务器IP:${IM_HTTP_PORT:-8100}/im}"
echo "管理后台: ${PUBLIC_URL:-http://服务器IP:${IM_HTTP_PORT:-8100}/im}/admin/"
echo "工具箱: cd $IM_DIR && sh im.sh"
if [ -z "$COMMUNITY_DIR" ]; then
  echo "编程狗服务器还需设置 IM_PUBLIC_URL，并安全配置此私钥的 Base64：$IM_DIR/secrets/im_sso_private.pem"
fi
