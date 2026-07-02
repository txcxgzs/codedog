#!/bin/bash

# CodeDog 更新脚本(薄包装)
# 修复: 之前此脚本与 codedog.sh 的 do_update 维护两套并行逻辑,容易脱节;
#       codedog.sh 的 do_update 已升级为智能更新(预检/诊断/数据修复),
#       此脚本改为薄包装,所有更新逻辑集中到 codedog.sh 一处维护。
# 兼容性: 保留旧调用习惯(bash update.sh),行为与 codedog 工具箱菜单4 完全一致。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "$SCRIPT_DIR/codedog.sh" ]; then
    echo "❌ 找不到 codedog.sh: $SCRIPT_DIR/codedog.sh"
    echo "    请确认在项目根目录运行此脚本"
    exit 1
fi

# 直接调用 codedog.sh update 子命令(已升级为智能更新模式)
# 智能更新包含: 备份 → 预检(清理残留表+环境变量) → git pull → 构建 → 启动 → 失败诊断 → 数据修复询问
echo "📦 CodeDog 更新脚本(调用智能更新)"
echo "===================="
echo ""
exec bash "$SCRIPT_DIR/codedog.sh" update
