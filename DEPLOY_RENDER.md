# Render 部署文档

> **适用人群**: 小白用户 / 初学者
> **部署时间**: 约 15-30 分钟
> **费用**: Starter 计划 $7/月（推荐），免费版会休眠且无持久磁盘
> **前置条件**: 一个 GitHub 账号 + 项目已推送到 GitHub

---

## 目录

1. [Render 是什么](#1-render-是什么)
2. [部署前准备](#2-部署前准备)
3. [方式一: Blueprint 自动部署（推荐）](#3-方式一-blueprint-自动部署推荐)
4. [方式二: 手动创建 Web Service](#4-方式二-手动创建-web-service)
5. [配置环境变量](#5-配置环境变量)
6. [验证部署](#6-验证部署)
7. [绑定自定义域名（可选）](#7-绑定自定义域名可选)
8. [常见问题](#8-常见问题)
9. [管理命令](#9-管理命令)

---

## 1. Render 是什么

Render 是一个云部署平台，类似 Heroku，支持：

- **Docker 容器部署**: 你的项目用 Dockerfile，原样运行，不用改代码
- **持久磁盘**: SQLite 数据库和上传的文件可以持久保存（需 Starter 计划）
- **长驻进程**: Express 服务持续运行，定时任务、内存缓存全部正常工作
- **自动部署**: 推送代码到 GitHub main 分支时自动重新部署
- **自定义域名**: 可绑定你自己的域名 + 免费 SSL 证书

### Render vs 宝塔面板对比

| 特性 | 宝塔面板 | Render |
|------|---------|--------|
| 服务器 | 需自己购买 VPS | Render 提供 |
| 费用 | VPS 费用(~$5/月) | $7/月(Starter) |
| 国内访问 | 快 | 中等(新加坡节点) |
| 维护 | 需自己维护服务器 | Render 全托管 |
| 持久磁盘 | 硬盘 | $7/月含1GB |
| 自动部署 | 需手动 | 推送代码自动部署 |

---

## 2. 部署前准备

### 2.1 确认项目已推送到 GitHub

```bash
# 在项目根目录执行
git status
# 应显示 "Your branch is up to date with 'origin/main'"
```

如果没有推送，先参考其他文档推送到 GitHub。

### 2.2 注册 Render 账号

1. 打开 https://render.com
2. 点击右上角 "Get Started"
3. 点击 "Sign up with GitHub"（用 GitHub 账号注册）
4. 授权 Render 访问你的 GitHub

### 2.3 准备环境变量值

在部署前，先用以下命令生成密钥（可在任意 Linux/Mac 终端或 Git Bash 中执行）：

```bash
# 生成 JWT_SECRET（64位十六进制）
openssl rand -hex 64

# 生成 SESSION_SECRET（32位十六进制）
openssl rand -hex 32
```

**把这两个值记下来**，后面配置环境变量时要填。

> 如果没有 openssl，可以用在线工具生成：https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx

---

## 3. 方式一: Blueprint 自动部署（推荐）

项目根目录已有 `render.yaml` 配置文件，Render 会自动读取它。

### 步骤

1. **登录 Render 控制台**: https://dashboard.render.com

2. **创建 Blueprint**:
   - 点击右上角 **"New +"**
   - 选择 **"Blueprint"**
   - 选择你的 GitHub 仓库（如果没看到，点击 "Configure account" 授权 Render 访问你的仓库）
   - 选择 `codedog` 仓库
   - 分支选择 `main`
   - Render 会自动检测到 `render.yaml` 文件

3. **确认配置**:
   - **Name**: `codedog`（可自定义）
   - **Region**: `Singapore`（新加坡，国内访问较快）
   - **Plan**: `Starter`（$7/月，必须选这个才有持久磁盘）

4. **点击 "Apply"** 开始部署

5. **等待构建**:
   - 首次构建约 5-10 分钟
   - 可在 "Events" 标签页查看构建日志
   - 看到 "Live" 绿色标志表示部署成功

6. **配置环境变量**（见第 5 节）

---

## 4. 方式二: 手动创建 Web Service

如果 Blueprint 方式不工作，可手动创建。

### 步骤

1. **登录 Render 控制台**: https://dashboard.render.com

2. **创建 Web Service**:
   - 点击右上角 **"New +"**
   - 选择 **"Web Service"**
   - 选择你的 GitHub 仓库 `codedog`
   - 分支选择 `main`

3. **配置服务**:
   - **Name**: `codedog`
   - **Runtime**: `Docker`
   - **Region**: `Singapore`（新加坡）
   - **Branch**: `main`
   - **Plan**: `Starter`（$7/月，必须选这个才有持久磁盘）

4. **配置持久磁盘**（重要！）:
   - 滚动到 "Disks" 部分
   - 点击 **"Add Disk"**
   - **第一个磁盘**:
     - Name: `codedog-data`
     - Mount Path: `/app/server/data`
     - Size: `1` GB
   - **第二个磁盘**:
     - 点击 "Add Disk" 再加一个
     - Name: `codedog-uploads`
     - Mount Path: `/app/server/uploads`
     - Size: `1` GB

5. **配置健康检查**:
   - **Health Check Path**: `/api/health`

6. **点击 "Create Web Service"** 开始部署

---

## 5. 配置环境变量

> **重要**: 敏感信息（密钥）不要写在 render.yaml 里，必须在 Render 控制台手动填写。

### 步骤

1. 在你的 Web Service 页面，点击左侧 **"Environment"**

2. 添加以下环境变量：

| Key | Value | 说明 |
|-----|-------|------|
| `NODE_ENV` | `production` | 生产环境标识 |
| `DB_TYPE` | `sqlite` | 使用 SQLite（持久磁盘保存） |
| `DB_PATH` | `/app/server/data/database.sqlite` | 数据库文件路径 |
| `PORT` | `3001` | 服务端口 |
| `JWT_SECRET` | （填入你生成的64位密钥） | JWT 签名密钥 |
| `SESSION_SECRET` | （填入你生成的32位密钥） | Session 签名密钥 |
| `JWT_EXPIRES_IN` | `7d` | JWT 有效期7天 |
| `CORS_ORIGIN` | `https://codedog-xxxx.onrender.com` | 你的 Render 域名（部署后能看到） |

3. 可选（验证码配置）:

| Key | Value | 说明 |
|-----|-------|------|
| `GEETEST_ID` | （你的极验ID） | 极验验证码 |
| `GEETEST_KEY` | （你的极验Key） | 极验验证码 |
| `HCAPTCHA_SITE_KEY` | （你的hCaptcha站点Key） | hCaptcha验证码 |
| `HCAPTCHA_SECRET_KEY` | （你的hCaptcha密钥） | hCaptcha验证码 |

4. 点击 **"Save Changes"**

5. 服务会自动重新部署以应用新环境变量

---

## 6. 验证部署

### 6.1 检查服务状态

1. 在 Render 控制台，确认服务状态显示 **"Live"**（绿色）

2. 点击服务页面顶部的域名链接（类似 `https://codedog-xxxx.onrender.com`）

3. 应该能看到编程狗社区首页

### 6.2 检查 API 健康状态

在浏览器访问:
```
https://你的域名/api/health
```
应返回类似:
```json
{"status":"ok","timestamp":"..."}
```

### 6.3 检查数据库

首次访问时，Sequelize 会自动创建所有数据表。第一个用编程猫登录的用户自动成为超级管理员。

### 6.4 检查持久磁盘

1. 在 Render 控制台点击你的 Web Service
2. 点击左侧 **"Disks"**
3. 应能看到两个磁盘，显示已使用空间

---

## 7. 绑定自定义域名（可选）

### 步骤

1. 在 Render 控制台，点击你的 Web Service
2. 点击左侧 **"Settings"**
3. 滚动到 "Custom Domains" 部分
4. 点击 **"Add Custom Domain"**
5. 输入你的域名（如 `codedog.yourdomain.com`）
6. Render 会给你一个 CNAME 记录值
7. 在你的域名 DNS 管理页面添加 CNAME 记录:
   - 类型: `CNAME`
   - 主机记录: `codedog`（或你的子域名）
   - 记录值: `codedog-xxxx.onrender.com`（Render 提供的值）
8. 等待 DNS 生效（通常几分钟到几小时）
9. Render 会自动申请 SSL 证书

绑定后，更新环境变量 `CORS_ORIGIN` 为你的自定义域名。

---

## 8. 常见问题

### Q1: 部署失败，构建错误

**查看日志**: 在 Render 控制台点击 "Events" 或 "Logs" 标签查看详细错误。

常见原因:
- `npm install` 失败: 检查 `server/package.json` 依赖是否完整
- 前端构建失败: 检查 `client/` 目录代码是否有语法错误

### Q2: 服务启动后无法访问

**检查环境变量**:
- 确认 `JWT_SECRET` 和 `SESSION_SECRET` 已填写
- 确认 `NODE_ENV=production`
- 确认 `CORS_ORIGIN` 设置为你的 Render 域名

### Q3: 数据库写入失败 / 权限不足

**检查持久磁盘**:
- 确认 Plan 是 Starter（免费版无磁盘）
- 确认磁盘挂载路径是 `/app/server/data` 和 `/app/server/uploads`
- 查看日志是否有 "Permission denied" 错误

### Q4: 免费版服务休眠

免费版 Web Service 在 15 分钟无流量后会休眠，首次访问需等待 30 秒唤醒。
**解决**: 升级到 Starter 计划（$7/月），不休眠且有持久磁盘。

### Q5: 首次部署后第一个用户不是管理员

**检查**: 确认 `AUTO_SUPERADMIN` 环境变量未设为 `false`（默认开启）。
第一个用编程猫登录的用户自动成为超级管理员。

### Q6: 头像上传失败

**检查持久磁盘**:
- 确认 `/app/server/uploads` 磁盘已挂载
- 确认磁盘有足够空间

### Q7: 如何查看数据库内容

Render 不提供直接访问数据库的界面。可用方式:
1. 在应用内通过管理员后台查看
2. 使用 Render Shell（控制台 → 你的服务 → 右上角 "Shell"）
3. 在 Shell 中执行:
   ```bash
   sqlite3 /app/server/data/database.sqlite
   .tables
   SELECT * FROM users LIMIT 5;
   ```

### Q8: 如何备份数据库

在 Render Shell 中执行:
```bash
# 备份到 /tmp（临时目录）
sqlite3 /app/server/data/database.sqlite ".backup '/tmp/backup.sqlite'"

# 然后用 scp 或其他方式下载
```

或使用 Render 的磁盘快照功能（Starter 计划以上）。

---

## 9. 管理命令

### 9.1 查看日志

- **Render 控制台**: 服务页面 → "Logs" 标签
- **实时日志**: 控制台日志实时更新

### 9.2 重启服务

- **Render 控制台**: 服务页面 → 右上角 "Manual Deploy" → "Clear build cache & deploy"

### 9.3 更新代码

```bash
# 本地修改代码后
git add .
git commit -m "更新说明"
git push origin main
# Render 会自动检测到推送并重新部署
```

### 9.4 查看构建状态

- **Render 控制台**: 服务页面 → "Events" 标签
- 显示每次部署的状态和日志

### 9.5 Render Shell

在 Render 控制台，你的服务页面右上角有 **"Shell"** 按钮，点击可进入容器终端，执行命令如:
```bash
# 查看数据库
sqlite3 /app/server/data/database.sqlite ".tables"

# 查看文件
ls -la /app/server/data/
ls -la /app/server/uploads/avatars/

# 查看环境变量
env | grep DB_
env | grep JWT
```

---

## 快速导航

- [Render 官方文档](https://render.com/docs)
- [Render 定价](https://render.com/pricing)
- [项目 Dockerfile](file:///c:/Users/Administrator/Desktop/codedog/Dockerfile)
- [Render 配置文件](file:///c:/Users/Administrator/Desktop/codedog/render.yaml)
- [环境变量示例](file:///c:/Users/Administrator/Desktop/codedog/.env.example)
- [项目代码维基](file:///c:/Users/Administrator/Desktop/codedog/CODE_WIKI.md)
