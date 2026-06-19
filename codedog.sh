#!/bin/bash

# CodeDog 管理工具箱
VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }

# 显示标题
show_header() {
    clear
    echo -e "${CYAN}"
    echo "  ╔═══════════════════════════════════════════════════╗"
    echo "  ║           CodeDog 管理工具箱 v${VERSION}            ║"
    echo "  ╚═══════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 显示主菜单
show_menu() {
    echo -e "${CYAN}请选择操作：${NC}"
    echo ""
    echo "  1) 📊 查看系统状态"
    echo "  2) 📝 查看服务日志"
    echo "  3) 🔄 检查更新"
    echo "  4) ⬆️  执行更新"
    echo "  5) 🔧 修复问题"
    echo "  6) 🗄️  数据库管理"
    echo "  7) 🛡️  敏感词管理"
    echo "  8) ⚙️  系统配置"
    echo "  9) 🧹 清理缓存"
    echo "  0) 退出"
    echo ""
    read -p "请输入选项 [0-9]: " choice
}

# 查看系统状态
show_status() {
    echo -e "\n${CYAN}═══ 系统状态 ═══${NC}\n"

    # 检查 Docker 状态
    if command -v docker &> /dev/null; then
        print_success "Docker 已安装: $(docker --version | head -1)"

        # 检查容器状态
        if docker ps --format '{{.Names}}' | grep -q "codedog"; then
            print_success "CodeDog 容器运行中"
            echo ""
            echo "容器信息:"
            docker ps --filter "name=codedog" --format "table {{.ID}}\t{{.Status}}\t{{.Ports}}"
        else
            print_warning "CodeDog 容器未运行"
        fi
    else
        print_warning "Docker 未安装"
    fi

    echo ""

    # 检查本地服务
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        print_success "后端服务运行正常 (端口 3001)"
    else
        print_error "后端服务未响应"
    fi

    # 检查数据库
    if [ -f "$SCRIPT_DIR/data/database.sqlite" ]; then
        DB_SIZE=$(du -h "$SCRIPT_DIR/data/database.sqlite" | cut -f1)
        print_success "数据库文件存在 (大小: $DB_SIZE)"

        # 统计数据
        if command -v sqlite3 &> /dev/null; then
            USERS=$(sqlite3 "$SCRIPT_DIR/data/database.sqlite" "SELECT COUNT(*) FROM users" 2>/dev/null)
            WORKS=$(sqlite3 "$SCRIPT_DIR/data/database.sqlite" "SELECT COUNT(*) FROM works" 2>/dev/null)
            POSTS=$(sqlite3 "$SCRIPT_DIR/data/database.sqlite" "SELECT COUNT(*) FROM posts" 2>/dev/null)
            WORDS=$(sqlite3 "$SCRIPT_DIR/data/database.sqlite" "SELECT COUNT(*) FROM sensitive_words" 2>/dev/null)
            echo "  - 用户数: $USERS"
            echo "  - 作品数: $WORKS"
            echo "  - 帖子数: $POSTS"
            echo "  - 敏感词: $WORDS"
        fi
    else
        print_warning "数据库文件不存在"
    fi

    # 检查上传目录
    if [ -d "$SCRIPT_DIR/uploads" ]; then
        UPLOAD_SIZE=$(du -sh "$SCRIPT_DIR/uploads" 2>/dev/null | cut -f1)
        print_success "上传目录存在 (大小: $UPLOAD_SIZE)"
    else
        print_warning "上传目录不存在"
    fi

    echo ""
    read -p "按回车返回菜单..."
}

# 查看日志
show_logs() {
    echo -e "\n${CYAN}═══ 服务日志 ═══${NC}\n"
    echo "1) 实时日志"
    echo "2) 最近 50 行"
    echo "3) 错误日志"
    echo ""
    read -p "请选择 [1-3]: " log_choice

    case $log_choice in
        1) docker compose -f "$SCRIPT_DIR/docker-compose.yml" logs -f ;;
        2) docker compose -f "$SCRIPT_DIR/docker-compose.yml" logs --tail=50 ;;
        3) docker compose -f "$SCRIPT_DIR/docker-compose.yml" logs --tail=100 | grep -i "error\|fail\|exception" ;;
    esac

    echo ""
    read -p "按回车返回菜单..."
}

# 检查更新
check_update() {
    echo -e "\n${CYAN}═══ 检查更新 ═══${NC}\n"

    cd "$SCRIPT_DIR"

    # 获取当前版本
    CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
    print_info "当前版本: $CURRENT_COMMIT ($CURRENT_BRANCH)"

    # 获取远程更新
    echo "正在检查远程更新..."
    git fetch origin 2>/dev/null

    # 比较差异
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null)

    if [ "$LOCAL" = "$REMOTE" ]; then
        print_success "已是最新版本！"
    else
        BEHIND=$(git rev-list HEAD.."$REMOTE" --count 2>/dev/null)
        print_warning "有 $BEHIND 个新提交可用"
        echo ""
        echo "最近更新:"
        git log HEAD.."$REMOTE" --oneline --no-merges | head -10
        echo ""
        echo "运行 'codedog' 并选择 '执行更新' 来更新系统"
    fi

    echo ""
    read -p "按回车返回菜单..."
}

# 执行更新
do_update() {
    echo -e "\n${CYAN}═══ 执行更新 ═══${NC}\n"

    cd "$SCRIPT_DIR"

    # 确认更新
    read -p "确定要更新系统吗？(y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        print_info "已取消更新"
        read -p "按回车返回菜单..."
        return
    fi

    # 备份
    echo "正在备份..."
    BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r data "$BACKUP_DIR/" 2>/dev/null || true
    cp -r uploads "$BACKUP_DIR/" 2>/dev/null || true
    print_success "备份已保存到: $BACKUP_DIR"

    # 拉取更新
    echo "正在拉取更新..."
    git pull origin "$(git branch --show-current)"

    # 重新构建
    if command -v docker &> /dev/null; then
        echo "正在重新构建..."
        docker compose -f "$SCRIPT_DIR/docker-compose.yml" build

        echo "正在重启服务..."
        docker compose -f "$SCRIPT_DIR/docker-compose.yml" down
        docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d
        print_success "更新完成！"
    else
        print_warning "Docker 未安装，请手动重启服务"
    fi

    echo ""
    read -p "按回车返回菜单..."
}

# 修复问题
fix_issues() {
    echo -e "\n${CYAN}═══ 修复问题 ═══${NC}\n"
    echo "1) 修复数据库表结构"
    echo "2) 修复文件权限"
    echo "3) 重置管理员密码"
    echo "4) 修复敏感词表"
    echo "5) 全部修复"
    echo ""
    read -p "请选择 [1-5]: " fix_choice

    case $fix_choice in
        1) fix_database ;;
        2) fix_permissions ;;
        3) reset_admin ;;
        4) fix_sensitive_words ;;
        5)
            fix_database
            fix_permissions
            fix_sensitive_words
            ;;
    esac

    echo ""
    read -p "按回车返回菜单..."
}

# 修复数据库
fix_database() {
    echo -e "\n正在修复数据库..."

    DB_PATH="$SCRIPT_DIR/data/database.sqlite"

    if [ ! -f "$DB_PATH" ]; then
        print_error "数据库文件不存在"
        return
    fi

    # 检查并添加缺失的列
    sqlite3 "$DB_PATH" "PRAGMA table_info(operation_logs)" | grep -q "user_agent" || {
        sqlite3 "$DB_PATH" "ALTER TABLE operation_logs ADD COLUMN user_agent TEXT"
        print_success "已添加 operation_logs.user_agent 列"
    }

    print_success "数据库修复完成"
}

# 修复文件权限
fix_permissions() {
    echo -e "\n正在修复文件权限..."

    chmod -R 755 "$SCRIPT_DIR/data" 2>/dev/null
    chmod -R 755 "$SCRIPT_DIR/uploads" 2>/dev/null

    print_success "权限修复完成"
}

# 重置管理员密码
reset_admin() {
    echo -e "\n重置管理员密码功能"
    print_warning "此功能需要手动操作数据库"
    echo "请使用后台管理界面重置密码"
}

# 修复敏感词表
fix_sensitive_words() {
    echo -e "\n正在检查敏感词表..."

    DB_PATH="$SCRIPT_DIR/data/database.sqlite"

    if [ ! -f "$DB_PATH" ]; then
        print_error "数据库文件不存在"
        return
    fi

    # 检查敏感词表是否存在
    TABLE_EXISTS=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='sensitive_words'" 2>/dev/null)

    if [ -z "$TABLE_EXISTS" ]; then
        print_warning "敏感词表不存在，正在创建..."
        sqlite3 "$DB_PATH" <<EOF
CREATE TABLE IF NOT EXISTS sensitive_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'other',
    level INTEGER DEFAULT 2,
    replacement VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
EOF
        print_success "敏感词表已创建"
    else
        WORD_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sensitive_words" 2>/dev/null)
        print_success "敏感词表存在，共 $WORD_COUNT 个敏感词"
    fi
}

# 数据库管理
database_menu() {
    echo -e "\n${CYAN}═══ 数据库管理 ═══${NC}\n"
    echo "1) 备份数据库"
    echo "2) 恢复数据库"
    echo "3) 查看数据库信息"
    echo "4) 优化数据库"
    echo ""
    read -p "请选择 [1-4]: " db_choice

    case $db_choice in
        1) backup_database ;;
        2) restore_database ;;
        3) show_db_info ;;
        4) optimize_database ;;
    esac

    echo ""
    read -p "按回车返回菜单..."
}

# 备份数据库
backup_database() {
    echo -e "\n正在备份数据库..."

    DB_PATH="$SCRIPT_DIR/data/database.sqlite"
    BACKUP_FILE="$SCRIPT_DIR/data/backup_$(date +%Y%m%d_%H%M%S).sqlite"

    if [ -f "$DB_PATH" ]; then
        cp "$DB_PATH" "$BACKUP_FILE"
        print_success "数据库已备份到: $BACKUP_FILE"
    else
        print_error "数据库文件不存在"
    fi
}

# 恢复数据库
restore_database() {
    echo -e "\n可用的备份文件:"
    ls -la "$SCRIPT_DIR"/data/backup_*.sqlite 2>/dev/null || {
        print_warning "没有找到备份文件"
        return
    }

    read -p "请输入备份文件名: " backup_file
    if [ -f "$SCRIPT_DIR/data/$backup_file" ]; then
        cp "$SCRIPT_DIR/data/$backup_file" "$SCRIPT_DIR/data/database.sqlite"
        print_success "数据库已恢复"
    else
        print_error "备份文件不存在"
    fi
}

# 显示数据库信息
show_db_info() {
    echo -e "\n数据库信息:"
    DB_PATH="$SCRIPT_DIR/data/database.sqlite"

    if [ -f "$DB_PATH" ]; then
        echo "文件大小: $(du -h "$DB_PATH" | cut -f1)"
        echo ""
        echo "表统计:"
        sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table'" | while read table; do
            COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table" 2>/dev/null)
            echo "  - $table: $COUNT 条记录"
        done
    else
        print_error "数据库文件不存在"
    fi
}

# 优化数据库
optimize_database() {
    echo -e "\n正在优化数据库..."
    DB_PATH="$SCRIPT_DIR/data/database.sqlite"

    if [ -f "$DB_PATH" ]; then
        sqlite3 "$DB_PATH" "VACUUM;"
        print_success "数据库优化完成"
    else
        print_error "数据库文件不存在"
    fi
}

# 敏感词管理
sensitive_words_menu() {
    echo -e "\n${CYAN}═══ 敏感词管理 ═══${NC}\n"
    echo "1) 查看敏感词统计"
    echo "2) 测试敏感词检测"
    echo "3) 重新导入敏感词库"
    echo ""
    read -p "请选择 [1-3]: " sw_choice

    case $sw_choice in
        1) show_sensitive_stats ;;
        2) test_sensitive_word ;;
        3) import_sensitive_words ;;
    esac

    echo ""
    read -p "按回车返回菜单..."
}

# 显示敏感词统计
show_sensitive_stats() {
    echo -e "\n敏感词统计:"
    DB_PATH="$SCRIPT_DIR/data/database.sqlite"

    if [ -f "$DB_PATH" ]; then
        TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sensitive_words WHERE status='active'" 2>/dev/null)
        echo "总数: $TOTAL"
        echo ""
        echo "按分类:"
        sqlite3 "$DB_PATH" "SELECT category, COUNT(*) as count FROM sensitive_words WHERE status='active' GROUP BY category ORDER BY count DESC" | while IFS='|' read cat count; do
            echo "  - $cat: $count"
        done
        echo ""
        echo "按等级:"
        sqlite3 "$DB_PATH" "SELECT CASE WHEN level=3 THEN '高风险' WHEN level=2 THEN '中风险' ELSE '低风险' END as level_name, COUNT(*) FROM sensitive_words WHERE status='active' GROUP BY level ORDER BY level DESC" | while IFS='|' read level count; do
            echo "  - $level: $count"
        done
    fi
}

# 测试敏感词检测
test_sensitive_word() {
    echo -e "\n测试敏感词检测"
    read -p "请输入要测试的内容: " test_content

    if [ -z "$test_content" ]; then
        print_error "内容不能为空"
        return
    fi

    DB_PATH="$SCRIPT_DIR/data/database.sqlite"
    FOUND=$(sqlite3 "$DB_PATH" "SELECT word FROM sensitive_words WHERE status='active' AND '$test_content' LIKE '%' || word || '%'" 2>/dev/null)

    if [ -n "$FOUND" ]; then
        print_warning "命中敏感词:"
        echo "$FOUND" | while read word; do
            echo "  - $word"
        done
    else
        print_success "未命中任何敏感词"
    fi
}

# 导入敏感词库
import_sensitive_words() {
    echo -e "\n导入敏感词库"
    print_warning "此操作会清空现有敏感词并重新导入"
    read -p "确定继续吗？(y/n): " confirm

    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        print_info "已取消"
        return
    fi

    if [ -f "$SCRIPT_DIR/server/import_vocabulary.js" ]; then
        cd "$SCRIPT_DIR/server" && node import_vocabulary.js
    else
        print_error "导入脚本不存在"
    fi
}

# 系统配置
config_menu() {
    echo -e "\n${CYAN}═══ 系统配置 ═══${NC}\n"
    echo "1) 查看当前配置"
    echo "2) 修改端口"
    echo "3) 重置配置"
    echo ""
    read -p "请选择 [1-3]: " cfg_choice

    case $cfg_choice in
        1) show_config ;;
        2) change_port ;;
        3) reset_config ;;
    esac

    echo ""
    read -p "按回车返回菜单..."
}

# 显示配置
show_config() {
    echo -e "\n当前配置:"
    echo ""

    if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
        echo "Docker 配置:"
        grep -E "^\s*-" "$SCRIPT_DIR/docker-compose.yml" | grep -E "PORT|DB_TYPE|DB_PATH" | sed 's/^/  /'
    fi

    if [ -f "$SCRIPT_DIR/.env" ]; then
        echo ""
        echo "环境变量:"
        cat "$SCRIPT_DIR/.env" | grep -v "^#" | grep -v "^$" | sed 's/^/  /'
    fi
}

# 修改端口
change_port() {
    echo -e "\n修改端口"
    read -p "请输入新端口 (默认 3001): " new_port
    new_port=${new_port:-3001}

    if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
        sed -i "s/\"[0-9]*:3001\"/\"$new_port:3001\"/" "$SCRIPT_DIR/docker-compose.yml"
        print_success "端口已修改为: $new_port"
        print_warning "请重启服务使配置生效"
    fi
}

# 重置配置
reset_config() {
    echo -e "\n重置配置"
    print_warning "此操作会重置所有配置为默认值"
    read -p "确定继续吗？(y/n): " confirm

    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        # 恢复默认配置
        cat > "$SCRIPT_DIR/docker-compose.yml" <<'EOF'
version: '3.8'

services:
  codedog:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: codedog
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/server/data
      - ./uploads:/app/server/uploads
    environment:
      - NODE_ENV=production
      - DB_TYPE=sqlite
      - DB_PATH=/app/server/data/database.sqlite
    restart: unless-stopped
EOF
        print_success "配置已重置"
    fi
}

# 清理缓存
clean_cache() {
    echo -e "\n${CYAN}═══ 清理缓存 ═══${NC}\n"
    echo "1) 清理 Docker 缓存"
    echo "2) 清理旧备份"
    echo "3) 清理日志"
    echo "4) 全部清理"
    echo ""
    read -p "请选择 [1-4]: " clean_choice

    case $clean_choice in
        1) clean_docker ;;
        2) clean_backups ;;
        3) clean_logs ;;
        4)
            clean_docker
            clean_backups
            clean_logs
            ;;
    esac

    echo ""
    read -p "按回车返回菜单..."
}

# 清理 Docker 缓存
clean_docker() {
    echo -e "\n正在清理 Docker 缓存..."
    docker system prune -f 2>/dev/null
    print_success "Docker 缓存已清理"
}

# 清理旧备份
clean_backups() {
    echo -e "\n正在清理旧备份..."
    BACKUP_COUNT=$(ls -d "$SCRIPT_DIR"/backup_* 2>/dev/null | wc -l)

    if [ "$BACKUP_COUNT" -gt 5 ]; then
        ls -d "$SCRIPT_DIR"/backup_* | head -n -5 | xargs rm -rf
        print_success "已清理旧备份，保留最近 5 个"
    else
        print_info "备份数量正常 ($BACKUP_COUNT 个)"
    fi
}

# 清理日志
clean_logs() {
    echo -e "\n正在清理日志..."
    if command -v docker &> /dev/null; then
        docker system prune --volumes -f 2>/dev/null
    fi
    print_success "日志已清理"
}

# 主程序
main() {
    # 检查是否在项目目录
    if [ ! -f "$SCRIPT_DIR/docker-compose.yml" ] && [ ! -f "$SCRIPT_DIR/README.md" ]; then
        print_error "请在 CodeDog 项目目录中运行此脚本"
        exit 1
    fi

    while true; do
        show_header
        show_menu

        case $choice in
            1) show_status ;;
            2) show_logs ;;
            3) check_update ;;
            4) do_update ;;
            5) fix_issues ;;
            6) database_menu ;;
            7) sensitive_words_menu ;;
            8) config_menu ;;
            9) clean_cache ;;
            0)
                echo -e "\n${GREEN}再见！${NC}\n"
                exit 0
                ;;
            *)
                print_error "无效选项"
                sleep 1
                ;;
        esac
    done
}

# 运行主程序
main
