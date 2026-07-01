#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  CodeDog Deployment Script"
echo "========================================"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker not installed"
    exit 1
fi

# Check Docker Compose - use whichever is available
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "ERROR: Docker Compose not installed"
    exit 1
fi
echo "Using: $COMPOSE_CMD"

# Pull latest code
echo ""
echo "Pulling latest code..."
git pull origin main 2>/dev/null || echo "Warning: Could not pull, using local code"

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

# Create .env if missing
if [ ! -f .env ] || [ ! -s .env ]; then
    echo ""
    echo "Creating .env configuration..."
    
    echo ""
    echo "Select database type:"
    echo "  1) SQLite (default, lightweight)"
    echo "  2) MySQL (requires MySQL server)"
    echo ""
    read -p "Choice [1-2]: " db_choice
    
    DB_TYPE="sqlite"
    DB_HOST="localhost"
    DB_PORT="3306"
    DB_NAME="coding_dog"
    DB_USER="root"
    DB_PASSWORD=""
    
    if [ "$db_choice" = "2" ]; then
        DB_TYPE="mysql"
        read -p "MySQL host [localhost]: " input_host
        DB_HOST=${input_host:-localhost}
        read -p "MySQL port [3306]: " input_port
        DB_PORT=${input_port:-3306}
        read -p "MySQL database [coding_dog]: " input_name
        DB_NAME=${input_name:-coding_dog}
        read -p "MySQL user [root]: " input_user
        DB_USER=${input_user:-root}
        read -sp "MySQL password: " input_pass
        DB_PASSWORD=${input_pass}
        echo ""
    fi
    
    cat > .env << ENVEOF
SERVER_PORT=3001
DB_TYPE=$DB_TYPE
DB_PATH=/app/server/data/database.sqlite
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
    
    echo ".env created"
else
    echo "Using existing .env"
fi

# Repair incomplete existing .env files from older installers.
if ! grep -q '^DB_PATH=' .env; then
    append_or_replace_env "DB_PATH" "/app/server/data/database.sqlite"
fi
if ! grep -q '^JWT_EXPIRES_IN=' .env; then
    append_or_replace_env "JWT_EXPIRES_IN" "7d"
fi
if ! grep -q '^CORS_ORIGIN=' .env || [ -z "$(grep '^CORS_ORIGIN=' .env | tail -1 | cut -d= -f2-)" ]; then
    append_or_replace_env "CORS_ORIGIN" "http://localhost:3001"
fi
if ! grep -q '^JWT_SECRET=................................' .env; then
    append_or_replace_env "JWT_SECRET" "$(generate_secret 64)"
fi
if ! grep -q '^SESSION_SECRET=................................' .env; then
    append_or_replace_env "SESSION_SECRET" "$(generate_secret 32)"
fi

# Create directories and fix permissions. The container runs as a non-root app user,
# so bind-mounted SQLite/upload directories must be writable from inside the container.
echo ""
echo "Preparing directories..."
mkdir -p data uploads/avatars uploads/works
chmod -R a+rwX data uploads 2>/dev/null || true

# Build and start
echo ""
echo "Building Docker image..."
$COMPOSE_CMD build --no-cache

echo ""
echo "Starting service..."
$COMPOSE_CMD down
$COMPOSE_CMD up -d

# Wait for startup
echo ""
echo "Waiting for service..."
SERVICE_READY=0
for i in $(seq 1 60); do
    if curl -fs http://localhost:3001/api/health > /dev/null 2>&1; then
        SERVICE_READY=1
        echo "Service started successfully!"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ "$SERVICE_READY" != "1" ]; then
    echo ""
    echo "ERROR: Service did not become healthy. Recent logs:"
    $COMPOSE_CMD ps
    $COMPOSE_CMD logs --tail=120 codedog
    exit 1
fi

# Install CLI
echo ""
echo "Installing management tool..."
if [ -f "$SCRIPT_DIR/install-cli.sh" ]; then
    chmod +x "$SCRIPT_DIR/install-cli.sh"
    bash "$SCRIPT_DIR/install-cli.sh"
fi

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "  URL: http://localhost:3001"
echo "  Admin: http://localhost:3001/admin"
echo "  Tool: codedog"
echo ""
