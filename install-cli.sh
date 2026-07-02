#!/bin/bash

# CodeDog CLI 安装脚本
# 安装后可在终端输入 codedog 启动管理工具箱

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_NAME="codedog"
INSTALL_DIR="/usr/local/bin"

echo "📦 安装 CodeDog CLI 工具..."

# 修复: 先检查 codedog.sh 是否存在,避免生成无效 wrapper
if [ ! -f "$SCRIPT_DIR/codedog.sh" ]; then
    echo "❌ codedog.sh 不存在: $SCRIPT_DIR/codedog.sh"
    echo "   请在项目根目录运行此脚本,或检查文件是否完整"
    exit 1
fi

# 检查是否有 sudo 权限
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

# 修复：使用 mktemp 生成不可预测的临时文件名，配合 umask 077 与 trap 清理，避免 /tmp 固定路径中转的 TOCTOU 竞争
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
umask 077

# 创建执行脚本 - 使用绝对路径
cat > "$TMPFILE" <<'WRAPPER'
#!/bin/bash
WRAPPER

# 写入实际路径
cat >> "$TMPFILE" <<EOF
# CodeDog CLI 包装脚本
cd "$SCRIPT_DIR" || {
    echo "❌ 项目目录不存在: $SCRIPT_DIR"
    exit 1
}
exec bash "$SCRIPT_DIR/codedog.sh" "\$@"
EOF

# 安装到系统路径
$SUDO cp "$TMPFILE" "$INSTALL_DIR/$CLI_NAME"
$SUDO chmod +x "$INSTALL_DIR/$CLI_NAME"

# 临时文件清理由上方 trap 兜底，无需手动 rm

# 验证安装
if command -v $CLI_NAME &> /dev/null; then
    echo "✅ 安装成功！"
    echo ""
    echo "使用方法："
    echo "  在任意终端输入: $CLI_NAME"
    echo ""
    echo "功能菜单："
    echo "  1) 📊 查看系统状态"
    echo "  2) 📝 查看服务日志"
    echo "  3) 🔄 检查更新"
    echo "  4) ⬆️  执行更新"
    echo "  5) 🔧 修复问题"
    echo "  6) 🗄️  数据库管理"
    echo "  7) 🛡️  敏感词管理"
    echo "  8) ⚙️  系统配置"
    echo "  9) 🧹 清理缓存"
    # 修复: 安装成功时返回 0
    exit 0
else
    echo "❌ 安装失败，请手动将以下脚本添加到 PATH："
    echo "  $SCRIPT_DIR/codedog.sh"
    # 修复: 安装失败时返回非 0,便于其他脚本检测
    exit 1
fi
