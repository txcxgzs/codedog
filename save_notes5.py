# -*- coding: utf-8 -*-
notes = """
## [turn ~110 · 2026-07-12T07:00:00Z] TRUST_PROXY 崩溃 + 举报目标为空

### TRUST_PROXY 崩溃 (致命)
- 根因: `server/app.js` 把 `process.env.TRUST_PROXY` 字符串 "false" 直接传给 `app.set('trust proxy', 'false')`,Express 尝试解析为 IP 地址,导致崩溃
- 修复: 显式把字符串 "false" 识别为关闭,未配置时走默认(loopback + RFC1918)
- 同步修复: `docker-compose.yml` 默认值从 `false` 改为空字符串
- commit: `64b2ed4`(已 push)

### 举报目标为空
- 现象: 举报帖子后,后台显示举报目标为空,AI审核看不到帖子内容
- 内容未被删除,怀疑是 target_id 类型不匹配(整数 vs 字符串)导致 findAll 查不到
- 修复: getReports 中 `Number(r.target_id)` 强制转换 + try-catch + filter
- AI审核: post 不存在时显示占位符"帖子不存在(可能已清理)"
- commit: `f90ec35`(已 push)
- 注意: 根因未完全确认,可能还有更深层的 bug
"""

with open(r"C:\Users\Administrator\.local\share\mimocode\memory\sessions\ses_0aeec0101ffemLNF2D8AemyM3R\notes.md", "a", encoding="utf-8") as f:
    f.write(notes.strip())
    f.write("\n")

print("OK")
PYEOF