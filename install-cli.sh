#!/bin/bash

# CodeDog CLI 安装脚本
# 安装后可在终端输入 codedog 启动管理工具箱

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_NAME="codedog"
INSTALL_DIR="/usr/local/bin"

echo "📦 安装 CodeDog CLI 工具..."

# 检查是否有 sudo 权限
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

# 创建执行脚本
cat > "/tmp/$CLI_NAME" <<EOF
#!/bin/bash
cd "$SCRIPT_DIR"
bash "$SCRIPT_DIR/codedog.sh" "\$@"
EOF

# 安装到系统路径
$SUDO cp "/tmp/$CLI_NAME" "$INSTALL_DIR/$CLI_NAME"
$SUDO chmod +x "$INSTALL_DIR/$CLI_NAME"

# 清理临时文件
rm -f "/tmp/$CLI_NAME"

# 验证安装
if command -v $CLI_NAME &> /dev/null; then
    echo "✅ 安装成功！"
    echo ""
    echo "使用方法："
    echo "  在任意终端输入: $CLI_NAME"
    echo ""
    echo "功能菜单："
    echo "  1) 查看系统状态"
    echo "  2) 查看服务日志"
    echo "  3) 检查更新"
    echo "  4) 执行更新"
    echo "  5) 修复问题"
    echo "  6) 数据库管理"
    echo "  7) 敏感词管理"
    echo "  8) 系统配置"
    echo "  9) 清理缓存"
else
    echo "❌ 安装失败，请手动将以下脚本添加到 PATH："
    echo "  $SCRIPT_DIR/codedog.sh"
fi
