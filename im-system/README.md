# CodeDog IM

编程狗的独立即时通讯系统。用户端、管理后台、服务端、数据库和更新工具均位于本目录，可以与编程狗分开部署。

## 当前完成范围（M0 + 可运行消息链路）

- 编程狗账号一次性 RS256 SSO Ticket，防重复兑换。
- 独立 HttpOnly IM 会话和 WebSocket 鉴权。
- 私聊会话申请基础、100 人默认群聊基础。
- 文本消息、会话序列、发送幂等、历史补拉和实时推送。
- 管理员聊天记录检索和持久审计记录。
- 独立科幻用户端、独立审计后台。
- 独立 Docker Compose、MySQL、Redis、健康检查。
- Windows/Linux 终端工具箱、更新前配置/密钥/数据库备份、按变更智能重建。

图片消息、私聊申请和基础群成员管理已经可用；账号事件同步、更多群管理能力和正式压测将在后续里程碑继续实现。产品明确不提供已读回执，当前单节点部署也不实现跨节点总线。

## 本地命令行测试（无需浏览器）

```bash
npm install
node scripts/keygen.js
npm run check
npm start
node scripts/smoke-local.js
```

默认使用进程内存储，服务重启后测试数据会清空。生产环境强制使用 Docker Compose 中的 MySQL 和 Redis。

## 独立生产部署

### Linux 从 GitHub 一键部署

在 Linux 服务器执行，随后按中文提示选择即可：

```bash
curl -fsSL https://raw.githubusercontent.com/txcxgzs/codedog/main/im-system/install.sh -o /tmp/codedog-im-install.sh
sudo bash /tmp/codedog-im-install.sh
```

安装器默认安装到 `/opt/codedog-im`，采用中文交互向导，现场询问域名、端口、数据库、Redis 和编程狗目录，无需手写环境变量。可选内置 MySQL/Redis，也可填写外部连接地址。内置 Redis 只在 Docker 私有网络通过 `redis:6379` 访问，不映射公网端口。安装器会生成随机密码和会话密钥、生成 SSO RSA 密钥、构建容器、执行迁移和健康检查。联合部署时还会自动把 IM 地址与 SSO 私钥写入编程狗配置并重建社区服务。

公开地址可以直接填写二级域名，例如 `https://im.54188.xyz`；安装器会自动补全为 `https://im.54188.xyz/im`。

IM Web 端口默认仅绑定 `127.0.0.1:8100`，不会直接开放公网。宿主机 Nginx/Caddy 应把公开域名反向代理到 `http://127.0.0.1:8100`；数据库和 Redis 同样不会开放公网端口。

宿主机 Nginx 示例（证书可继续交给你现有的 HTTPS 配置管理）：

```nginx
server {
    listen 80;
    server_name im.example.com;

    location / {
        proxy_pass http://127.0.0.1:8100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

编程狗与 IM 的绑定方式是一次性 RS256 登录票据：编程狗持有私钥并签发 60 秒票据，IM 持有公钥并验证；IM 不接触用户的编程猫密码，也不共享编程狗数据库。

如果首次安装在绑定前中断，服务恢复健康后可安全补做绑定（命令会先备份编程狗 `.env`，不会操作数据库）：

```bash
cd /opt/codedog-im/im-system
npm run bind-community -- --community-dir /root/codedog --public-url https://im.54188.xyz
```

```bash
cp .env.example .env
node scripts/keygen.js
```

然后在 `.env` 中设置强随机值：

```dotenv
IM_SESSION_SECRET=至少32字符随机密钥
IM_DB_PASSWORD=IM数据库密码
IM_DB_ROOT_PASSWORD=MySQL根密码
IM_PUBLIC_ORIGIN=https://im.example.com
IM_ADMIN_ORIGIN=https://im.example.com
```

启动：

```bash
node scripts/toolbox.js
# 选择 1：构建并启动
```

默认宿主机端口为 `8100`：

- 用户端：`http://server:8100/im/`
- 后台：`http://server:8100/im/admin/`
- API：`http://server:8100/im/api/`
- WebSocket：`ws://server:8100/im/ws`

正式域名由外层反向代理终止 HTTPS。编程狗主站设置：

```dotenv
IM_PUBLIC_URL=https://im.example.com/im
IM_SSO_PRIVATE_KEY_FILE=/安全路径/im_sso_private.pem
```

IM 服务器只部署 `im_sso_public.pem`；私钥只能留在编程狗服务器。独立部署时将公钥安全复制到 IM 的 `secrets/`，不能复制私钥。

## 工具箱和更新

- Windows：双击 `im.bat`。
- Linux：安装后可在任意目录执行 `codedogim`；也可在项目目录运行 `./im.sh`。
- 工具箱选项 11 可重新安装或修复 `/usr/local/bin/codedogim` 全局命令。
- 独立更新：`update.bat` 或 `sh update.sh`。

智能更新执行：工作区预检 -> 备份 `.env`/SSO 密钥 -> 在线 MySQL 热备份 -> `git fetch` + `ff-only` 更新 -> 仅在锁文件变化时安装依赖 -> 检查和构建 -> Compose 滚动重建。没有 IM 变更时不会重复下载依赖或重建。

## 安全边界

- IM 不读取编程狗密码、Cookie 或编程猫令牌。
- IM 与编程狗通过一次性 Ticket 和后续内部账号事件连接。
- 管理员查询聊天正文必须提交至少 5 个字符的原因。
- 普通文件、语音和音视频均不支持；图片将复用现有编程狗图床。
