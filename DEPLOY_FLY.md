# Fly.io 免费部署文档

> **适用人群**: 小白用户 / 初学者
> **部署时间**: 约 20-40 分钟
> **费用**: 免费（需绑信用卡验证身份，不会扣费）
> **前置条件**: 一个 GitHub 账号 + 项目已推送到 GitHub + 一张信用卡/借记卡

---

## 目录

1. [Fly.io 免费额度说明](#1-flyio-免费额度说明)
2. [安装 flyctl CLI](#2-安装-flyctl-cli)
3. [注册和登录](#3-注册和登录)
4. [部署步骤](#4-部署步骤)
5. [配置环境变量](#5-配置环境变量)
6. [验证部署](#6-验证部署)
7. [日常管理](#7-日常管理)
8. [常见问题](#8-常见问题)

---

## 1. Fly.io 免费额度说明

### 免费资源

| 资源 | 免费额度 | 你的项目需要 |
|------|---------|-------------|
| VM 实例 | 3 个 shared-cpu-1x（256MB RAM） | 1 个 |
| 持久卷 | 3GB | 2GB（数据库+上传文件） |
| 出站流量 | 100GB/月 | 小型站够用 |
| 节点区域 | 东京/新加坡等 | 1 个（东京推荐） |

### 重要说明

- **必须绑信用卡**: 注册时需绑定信用卡/借记卡，仅用于身份验证，不会扣费
- **免费额度足够**: 1 个 VM + 2 个 1GB 卷 = 完全在免费范围内
- **不会休眠**: Fly.io 支持长驻进程，不像 Render 免费版会休眠

### Fly.io vs Render 对比

| 特性 | Render 免费版 | Fly.io 免费版 |
|------|-------------|--------------|
| 持久磁盘 | 无 | 3GB 免费 |
| 休眠 | 15分钟休眠 | 不休眠 |
| SSH | 无 | 有 |
| 长驻进程 | 不支持 | 支持 |
| 文件上传 | 无法持久 | 可持久 |
| SQLite | 不可用 | 可用 |
| 部署方式 | 网页操作 | CLI 命令行 |

---

## 2. 安装 flyctl CLI

Fly.io 通过命令行工具 `flyctl` 管理，需要安装。

### Windows 安装

#### 方法一: PowerShell（推荐）

1. 按 `Win + R`，输入 `powershell`，回车打开 PowerShell

2. 执行安装命令:
   ```powershell
   iwr https://fly.io/install.ps1 -useb | iex
   ```

3. 等待安装完成

4. 关闭 PowerShell，重新打开一个新的 PowerShell 窗口

5. 验证安装:
   ```powershell
   flyctl version
   ```
   应显示版本号

#### 方法二: 手动下载

1. 打开 https://github.com/superfly/flyctl/releases/latest
2. 下载 `flyctl_0.x.x_Windows_x86_64.zip`
3. 解压到 `C:\flyctl\` 目录
4. 将 `C:\flyctl\` 添加到系统环境变量 PATH
5. 重开 PowerShell，执行 `flyctl version` 验证

### Mac 安装

```bash
brew install flyctl
```

### Linux 安装

```bash
curl -L https://fly.io/install.sh | sh
```

---

## 3. 注册和登录

### 3.1 注册 Fly.io 账号

1. 打开 PowerShell（或终端）

2. 执行登录命令:
   ```powershell
   flyctl auth login
   ```

3. 浏览器会自动打开 Fly.io 注册/登录页面

4. 点击 **"Sign up with GitHub"**（用 GitHub 账号注册）

5. 授权 Fly.io 访问你的 GitHub

6. **绑定信用卡**:
   - 在 Fly.io 控制台 https://fly.io/dashboard 点击 **"Billing"**
   - 点击 **"Add payment method"**
   - 输入信用卡/借记卡信息
   - 不会扣费，仅验证身份

7. 回到 PowerShell，应该显示登录成功

### 3.2 验证登录

```powershell
flyctl auth whoami
```
应显示你的邮箱

---

## 4. 部署步骤

### 4.1 进入项目目录

```powershell
cd C:\Users\Administrator\Desktop\codedog
```

### 4.2 创建 Fly.io 应用

```powershell
flyctl launch --no-deploy
```

命令会问你几个问题:

| 问题 | 回答 | 说明 |
|------|------|------|
| Copy to configuration? | `N` | 已有 fly.toml，选 N |
| App name | `codedog`（回车用默认或自定义） | 你的应用名，会变成 `codedog.fly.dev` |
| Organization | 选择你的个人组织 | 回车选默认 |
| Region | `nrt`（东京） | 国内访问最快 |

执行后会在 Fly.io 上创建应用，并保留现有的 `fly.toml` 配置。

### 4.3 创建持久卷（重要！）

```powershell
# 创建数据库卷（1GB，东京节点）
flyctl volumes create codedog_data --region nrt --size 1

# 创建上传文件卷（1GB，东京节点）
flyctl volumes create codedog_uploads --region nrt --size 1
```

如果提示名字冲突（其他人用了同名），改为带后缀的名字:
```powershell
flyctl volumes create codedog_data_yourname --region nrt --size 1
```
并同步修改 `fly.toml` 中的 `source` 字段。

### 4.4 配置环境变量（密钥）

先生成密钥（在 PowerShell 中执行）:

```powershell
# 生成 JWT_SECRET（64位十六进制）
-join (1..64 | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })

# 生成 SESSION_SECRET（32位十六进制）
-join (1..32 | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

或者用 Python 生成（如果有 Python）:
```powershell
python -c "import secrets; print(secrets.token_hex(32))"  # JWT_SECRET
python -c "import secrets; print(secrets.token_hex(16))"  # SESSION_SECRET
```

把生成的密钥设置到 Fly.io:

```powershell
flyctl secrets set JWT_SECRET=你生成的64位密钥
flyctl secrets set SESSION_SECRET=你生成的32位密钥
flyctl secrets set NODE_ENV=production
flyctl secrets set JWT_EXPIRES_IN=7d
flyctl secrets set CORS_ORIGIN=https://你的应用名.fly.dev
```

> **注意**: `CORS_ORIGIN` 中的域名要换成你实际的 `xxx.fly.dev` 地址

### 4.5 部署应用

```powershell
flyctl deploy
```

首次部署约 5-15 分钟，过程会:
1. 上传 Dockerfile 和代码
2. 在 Fly.io 服务器上构建镜像
3. 挂载持久卷
4. 启动 VM 实例

看到类似以下输出表示成功:
```
--> v0 deployed successfully
--> VM: xxx in nrt
```

---

## 5. 配置环境变量（补充）

如果需要添加更多环境变量:

```powershell
# 查看当前所有密钥
flyctl secrets list

# 添加验证码配置（可选）
flyctl secrets set GEETEST_ID=你的极验ID
flyctl secrets set GEETEST_KEY=你的极验Key
flyctl secrets set HCAPTCHA_SITE_KEY=你的hCaptcha站点Key
flyctl secrets set HCAPTCHA_SECRET_KEY=你的hCaptcha密钥
```

非敏感的环境变量（如 `DB_TYPE`、`PORT`）已在 `fly.toml` 或 Dockerfile 中设置，无需重复配置。

---

## 6. 验证部署

### 6.1 检查应用状态

```powershell
flyctl status
```

应显示:
```
App
  Name     = codedog
  Owner    = your-email
  Version  = 0
  Status   = running
```

### 6.2 访问应用

浏览器打开:
```
https://你的应用名.fly.dev
```

应该能看到编程狗社区首页。

### 6.3 检查 API

浏览器访问:
```
https://你的应用名.fly.dev/api/health
```

应返回:
```json
{"status":"ok","timestamp":"..."}
```

### 6.4 检查日志

```powershell
flyctl logs
```

实时查看应用日志，`Ctrl+C` 退出。

---

## 7. 日常管理

### 7.1 更新代码

本地修改代码后:
```powershell
git add .
git commit -m "更新说明"
git push origin main

# 重新部署到 Fly.io
flyctl deploy
```

### 7.2 重启应用

```powershell
flyctl apps restart codedog
```

### 7.3 SSH 进入容器

```powershell
flyctl ssh console
```

进入后可执行命令:
```bash
# 查看数据库
sqlite3 /app/server/data/database.sqlite
.tables
SELECT * FROM users LIMIT 5;
.quit

# 查看上传的文件
ls -la /app/server/uploads/avatars/

# 查看磁盘空间
df -h
```

### 7.4 备份数据库

```powershell
# SSH 进入容器后执行
sqlite3 /app/server/data/database.sqlite ".backup '/tmp/backup.sqlite'"

# 退出 SSH，用 sftp 下载
flyctl sftp get /tmp/backup.sqlite ./backup.sqlite
```

### 7.5 扩容持久卷

如果磁盘空间不够:
```powershell
# 扩容数据卷到 2GB
flyctl volumes extend codedog_data --size 2
```

### 7.6 查看资源用量

```powershell
flyctl status
flyctl metrics
```

---

## 8. 常见问题

### Q1: flyctl deploy 失败

**查看日志**:
```powershell
flyctl logs
```

常见原因:
- 内存不足（256MB 不够）: 在 fly.toml 改 `memory = 512`（仍在免费额度内）
- 构建失败: 检查代码是否有语法错误

### Q2: 数据库写入失败

**检查卷是否挂载**:
```powershell
flyctl ssh console
ls -la /app/server/data/
```

如果目录为空或不存在，说明卷未挂载:
1. 检查 `flyctl volumes list` 确认卷已创建
2. 检查 `fly.toml` 中 `[[mounts]]` 配置
3. 确保 `source` 名字与创建的卷名一致

### Q3: 头像上传失败

```powershell
flyctl ssh console
ls -la /app/server/uploads/
```

确认 uploads 卷已挂载且目录可写。

### Q4: 应用无法访问

1. 检查状态: `flyctl status`
2. 检查日志: `flyctl logs`
3. 确认端口: `fly.toml` 中 `internal_port = 3001`
4. 确认 `CORS_ORIGIN` 已正确设置

### Q5: 免费额度够用吗

- 1 个 VM + 2 个 1GB 卷 = 完全在免费范围
- 只要不开多个应用，不会产生费用
- 在 Fly.io 控制台 https://fly.io/dashboard 可查看用量

### Q6: 国内访问速度

- 东京节点（nrt）国内访问约 100-200ms
- 比国内服务器慢，但可用
- 如有域名可配 Cloudflare CDN 加速

### Q7: 如何绑定自定义域名

1. 在域名 DNS 管理添加 CNAME 记录:
   - 类型: `CNAME`
   - 主机记录: `codedog`（或你的子域名）
   - 记录值: `你的应用名.fly.dev`
2. 添加域名到 Fly.io:
   ```powershell
   flyctl certs add codedog.yourdomain.com
   ```
3. Fly.io 会自动申请 SSL 证书

### Q8: 如何删除应用（不想用了）

```powershell
# 删除应用（数据会丢失，先备份！）
flyctl apps destroy codedog
```

---

## 快速导航

- [Fly.io 官方文档](https://fly.io/docs/)
- [flyctl 命令参考](https://fly.io/docs/flyctl/)
- [Fly.io 定价](https://fly.io/docs/about/pricing/)
- [Fly.io 配置文件](file:///c:/Users/Administrator/Desktop/codedog/fly.toml)
- [项目 Dockerfile](file:///c:/Users/Administrator/Desktop/codedog/Dockerfile)
- [环境变量示例](file:///c:/Users/Administrator/Desktop/codedog/.env.example)
