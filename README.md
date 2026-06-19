# 编程狗社区 (CodeDog)

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.4-brightgreen" alt="Vue">
  <img src="https://img.shields.io/badge/Node.js-18+-green" alt="Node.js">
  <img src="https://img.shields.io/badge/Element_Plus-2.x-blue" alt="Element Plus">
  <img src="https://img.shields.io/badge/License-GPL%20v3-blue" alt="License">
</p>

一个基于 Vue3 + Node.js 的编程社区系统，支持作品展示、评论互动、工作室、内容审核等功能。

## 🚀 一键部署

### Linux/Mac
```bash
git clone https://github.com/txcxgzs/codedog.git
cd codedog
chmod +x deploy.sh && ./deploy.sh
```

### Windows
```cmd
git clone https://github.com/txcxgzs/codedog.git
cd codedog
deploy.bat
```

## ✨ 功能特性

### 用户端
- 🔐 **用户认证** - 编程猫账号登录 / JWT 令牌认证
- 📝 **作品展示** - 支持从编程猫平台导入作品
- 💬 **评论系统** - 作品评论、回复、点赞
- 🏢 **工作室功能** - 创建工作室、成员管理、作品提交
- ❤️ **互动功能** - 点赞、收藏、关注用户
- 🔔 **消息通知** - 站内信、点赞通知、举报反馈
- 📱 **社区帖子** - 发布帖子、分类讨论

### 管理端
- 🤖 **AI 内容审核** - 支持自定义 AI API 或内置敏感词检测
- 📋 **敏感词管理** - 87,000+ 内置敏感词，支持分类和自定义
- 🔒 **验证码支持** - 极验 / hCaptcha 验证码
- 👨‍💼 **后台管理** - 用户、作品、评论、举报、公告、轮播图管理
- 📊 **操作日志** - 管理员操作审计追踪
- 🛡️ **IP 封禁** - 封禁恶意 IP
- ⚙️ **系统设置** - 网站配置、AI 审核配置、验证码配置

## 🛠️ 技术栈

| 前端 | 后端 |
|------|------|
| Vue 3 | Node.js + Express |
| Element Plus | Sequelize ORM |
| Pinia | SQLite / MySQL |
| Vue Router | JWT 认证 |
| Vite | Geetest / hCaptcha |

## 📦 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/txcxgzs/codedog.git
cd codedog

# 2. 一键部署
chmod +x deploy.sh && ./deploy.sh

# 访问 http://localhost:3001
```

### 方式二：本地开发

```bash
# 1. 克隆项目
git clone https://github.com/txcxgzs/codedog.git
cd codedog

# 2. 安装依赖
cd server && npm install
cd ../client && npm install

# 3. 启动后端（终端1）
cd server && npm run dev

# 4. 启动前端（终端2）
cd client && npm run dev

# 前端: http://localhost:8080
# 后端: http://localhost:3001
```

## 🔄 更新系统

### Linux/Mac
```bash
chmod +x update.sh && ./update.sh
```

### Windows
```cmd
update.bat
```

更新脚本会自动：备份数据 → 拉取最新代码 → 重新构建 → 重启服务

## 🌐 访问地址

| 服务 | 地址 |
|------|------|
| 前端首页 | http://localhost:3001 |
| 后端 API | http://localhost:3001/api |
| 后台管理 | http://localhost:3001/admin |

## 👤 管理员说明

**第一个使用编程猫登录的用户将自动成为超级管理员。**

后续的管理员需要由超级管理员在后台进行设置。

### 角色权限

| 角色 | 权限 |
|------|------|
| user | 普通用户 |
| reviewer | 审核员，可审核举报 |
| moderator | 版主，可管理内容 |
| admin | 管理员，可管理用户和设置 |
| superadmin | 超级管理员，全部权限 |

## ⚙️ 配置说明

### Docker 部署配置

编辑 `docker-compose.yml`：

```yaml
environment:
  - NODE_ENV=production
  - DB_TYPE=sqlite          # 或 mysql
  - DB_PATH=/app/server/data/database.sqlite
```

### 本地开发配置

复制 `.env.example` 为 `.env` 并修改配置：

```env
# 服务端口
CLIENT_PORT=8080
SERVER_PORT=3001

# 数据库类型 (sqlite/mysql)
DB_TYPE=sqlite

# JWT密钥（部署脚本会自动生成）
JWT_SECRET=auto-generated
```

> 后端端口优先读取 PORT，若未设置则读取 SERVER_PORT。

## 📁 目录结构

```
codedog/
├── server/                 # 后端代码
│   ├── config/            # 配置文件
│   ├── controllers/       # 控制器
│   ├── middleware/        # 中间件
│   ├── models/            # 数据模型
│   ├── routes/            # 路由
│   ├── services/          # 服务（AI审核、敏感词等）
│   ├── utils/             # 工具函数
│   └── app.js             # 入口文件
├── client/                 # 前端代码
│   ├── src/
│   │   ├── api/           # API 接口
│   │   ├── components/    # 组件
│   │   ├── router/        # 路由
│   │   ├── stores/        # 状态管理 (Pinia)
│   │   └── views/         # 页面
│   └── vite.config.js     # Vite 配置
├── docker-compose.yml      # Docker 编排
├── Dockerfile              # Docker 构建文件
├── deploy.sh              # Linux/Mac 部署脚本
├── deploy.bat             # Windows 部署脚本
├── update.sh              # Linux/Mac 更新脚本
├── update.bat             # Windows 更新脚本
├── DEPLOY.md              # 部署文档
└── README.md              # 项目说明
```

## 🔧 常用命令

### Docker 部署

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 进入容器
docker compose exec codedog sh
```

### 本地开发

```bash
# 后端开发模式
cd server && npm run dev

# 前端开发模式
cd client && npm run dev

# 构建前端
cd client && npm run build
```

## 📋 功能说明

### 内容审核

系统支持两种审核模式：

1. **AI 审核**（推荐）
   - 在后台"系统设置"中配置 AI API 地址和密钥
   - 支持 OpenAI、Claude 等兼容 API
   - 自动分析内容并给出风险评估

2. **敏感词检测**（内置）
   - 无需配置，开箱即用
   - 内置 87,000+ 敏感词库
   - 支持 8 个分类：辱骂、涉黄、涉政、涉暴、诈骗、广告、毒品、其他
   - 可在后台"敏感词管理"页面自定义

### 操作审计

管理员的所有操作都会记录在"操作日志"中，包括：
- 用户管理操作
- 内容审核操作
- 系统配置变更
- 敏感词管理

### 举报管理

- 用户可举报作品、帖子、评论、用户
- 管理员可处理举报，支持 AI 辅助审核
- 举报结果自动通知举报者

## ❓ 常见问题

### 1. 端口被占用

修改 `.env` 文件中的端口配置：
```env
CLIENT_PORT=8081
SERVER_PORT=3002
```

### 2. 数据库连接失败

检查数据库配置是否正确，SQLite 无需额外配置。

### 3. 前端无法访问后端 API

检查后端服务是否正常启动，查看控制台日志。

### 4. AI 审核不工作

1. 检查是否在"系统设置"中启用了 AI 审核
2. 检查 AI API 地址和密钥是否正确
3. 未配置时会自动使用敏感词检测

### 5. 如何更新敏感词库

在后台"敏感词管理"页面可：
- 手动添加单个敏感词
- 批量导入敏感词（每行一个）
- 编辑或删除已有敏感词

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 开源协议

本项目基于 [GPL-3.0](LICENSE) 协议开源。

**GPL-3.0 协议要求**：
- ✅ 可以自由使用、修改、分发
- ✅ 衍生作品必须使用相同的GPL-3.0协议
- ✅ 修改后的代码必须开源
- ❌ 不能将代码闭源商业化

## 📸 界面预览

| 首页 | 作品详情 | 后台管理 |
|------|----------|----------|
| ![首页](docs/screenshots/home.png) | ![作品详情](docs/screenshots/work.png) | ![后台管理](docs/screenshots/admin.png) |

## 🙏 致谢

- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Element Plus](https://element-plus.org/) - Vue 3 组件库
- [Express.js](https://expressjs.com/) - Node.js Web 框架
- [Sequelize](https://sequelize.org/) - Node.js ORM
- [Pinia](https://pinia.vuejs.org/) - Vue 状态管理
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
