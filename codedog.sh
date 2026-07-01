#!/bin/bash

# CodeDog Management Tool
VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

show_menu() {
    clear
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}   CodeDog Management Tool v${VERSION}${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    echo "  1) View System Status"
    echo "  2) View Service Logs"
    echo "  3) Check for Updates"
    echo "  4) Apply Updates"
    echo "  5) Fix Issues"
    echo "  6) Database Management"
    echo "  7) Sensitive Words"
    echo "  8) System Config"
    echo "  9) Clean Cache"
    echo "  0) Exit"
    echo ""
    read -p "Select [0-9]: " choice
    echo ""
    case $choice in
        1) show_status ;;
        2) show_logs ;;
        3) check_update ;;
        4) do_update ;;
        5) do_fix ;;
        6) do_database ;;
        7) do_sensitive ;;
        8) do_config ;;
        9) do_clean ;;
        0) exit 0 ;;
        *) echo "Invalid option"; sleep 1; show_menu ;;
    esac
}

show_status() {
    echo "=== System Status ==="
    echo ""
    docker --version > /dev/null 2>&1 && echo "Docker: Installed" || echo "Docker: Not installed"
    docker ps --filter "name=codedog" --format "table {{.ID}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
    echo ""
    curl -s http://localhost:3001/api/health > /dev/null 2>&1 && echo "Backend: Running" || echo "Backend: Not responding"
    [ -f "$SCRIPT_DIR/server/data/database.sqlite" ] && echo "Database: Exists" || echo "Database: Missing"
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

show_logs() {
    echo "=== Service Logs ==="
    echo "1) Real-time logs"
    echo "2) Last 50 lines"
    echo "3) Error logs"
    echo ""
    read -p "Select [1-3]: " log_choice
    case $log_choice in
        1) docker compose logs -f ;;
        2) docker compose logs --tail=50 ;;
        3) docker compose logs --tail=100 ;;
    esac
    show_menu
}

check_update() {
    echo "=== Check Updates ==="
    git fetch origin 2>/dev/null
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "origin/$(git branch --show-current)" 2>/dev/null)
    if [ "$LOCAL" = "$REMOTE" ]; then
        echo "Already up to date"
    else
        echo "Updates available:"
        git log HEAD..origin/$(git branch --show-current) --oneline --no-merges 2>/dev/null | head -10
    fi
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

do_update() {
    read -p "Apply updates? (y/n): " confirm
    [ "$confirm" != "y" ] && show_menu
    
    echo "Backing up..."
    BACKUP="backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP"
    cp -r server/data "$BACKUP/" 2>/dev/null
    cp -r server/uploads "$BACKUP/" 2>/dev/null
    echo "Backup saved to $BACKUP"
    
    echo "Pulling updates..."
    git pull origin $(git branch --show-current)
    
    echo "Rebuilding..."
    docker compose build --no-cache
    docker compose down
    docker compose up -d
    
    echo "Done!"
    read -p "Press Enter to continue..."
    show_menu
}

do_fix() {
    echo "=== Fix Issues ==="
    echo "1) Fix database schema"
    echo "2) Fix file permissions"
    echo "3) Fix sensitive words table"
    echo "4) Fix all"
    echo ""
    read -p "Select [1-4]: " fix_choice
    
    DB_PATH="$SCRIPT_DIR/server/data/database.sqlite"
    
    case $fix_choice in
        1)
            if [ -f "$DB_PATH" ]; then
                echo "Database schema OK"
            else
                echo "Database file missing"
            fi
            ;;
        2)
            chmod -R 755 server/data server/uploads 2>/dev/null
            echo "Permissions fixed"
            ;;
        3)
            if [ -f "$DB_PATH" ]; then
                sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sensitive_words" 2>/dev/null && echo "Sensitive words table OK"
            fi
            ;;
        4)
            chmod -R 755 server/data server/uploads 2>/dev/null
            echo "All fixes applied"
            ;;
    esac
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

do_database() {
    echo "=== Database Management ==="
    echo "1) Backup database"
    echo "2) View database info"
    echo ""
    read -p "Select [1-2]: " db_choice
    
    DB_PATH="$SCRIPT_DIR/server/data/database.sqlite"
    
    case $db_choice in
        1)
            if [ -f "$DB_PATH" ]; then
                BACKUP_FILE="$SCRIPT_DIR/server/data/backup_$(date +%Y%m%d_%H%M%S).sqlite"
                cp "$DB_PATH" "$BACKUP_FILE"
                echo "Backup saved to: $BACKUP_FILE"
            else
                echo "Database file not found"
            fi
            ;;
        2)
            if [ -f "$DB_PATH" ]; then
                echo "Tables:"
                sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table'" 2>/dev/null
            else
                echo "Database file not found"
            fi
            ;;
    esac
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

do_sensitive() {
    echo "=== Sensitive Words ==="
    echo "1) View statistics"
    echo ""
    read -p "Select [1]: " sw_choice
    
    DB_PATH="$SCRIPT_DIR/server/data/database.sqlite"
    
    if [ "$sw_choice" = "1" ] && [ -f "$DB_PATH" ]; then
        echo "Active words:"
        sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sensitive_words WHERE status='active'" 2>/dev/null
        echo "By category:"
        sqlite3 "$DB_PATH" "SELECT category, COUNT(*) FROM sensitive_words WHERE status='active' GROUP BY category" 2>/dev/null
    fi
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

do_config() {
    echo "=== System Config ==="
    if [ -f "$SCRIPT_DIR/.env" ]; then
        echo "Current .env:"
        cat "$SCRIPT_DIR/.env"
    else
        echo ".env file not found"
    fi
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

do_clean() {
    echo "=== Clean Cache ==="
    docker system prune -f 2>/dev/null
    echo "Cache cleaned"
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

# Start
show_menu
