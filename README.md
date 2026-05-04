# 编程狗社区

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.4-brightgreen" alt="Vue">
  <img src="https://img.shields.io/badge/Node.js-18+-green" alt="Node.js">
  <img src="https://img.shields.io/badge/License-GPL%20v3-blue" alt="License">
</p>

一个基于 Vue3 + Node.js 的编程社区系统，支持作品展示、评论互动、工作室等功能。

## 一键部署

```bash
# 一键安装部署（自动安装Docker、生成配置、启动服务）
curl -fsSL https://raw.githubusercontent.com/txcxgzs/codedog/main/deploy.sh | bash
```

或者克隆后运行：
```bash
git clone https://github.com/txcxgzs/codedog.git
cd codedog
chmod +x deploy.sh && ./deploy.sh
```

## 功能特性

- 🔐 **用户认证** - 编程猫账号登录/JWT令牌认证
- 📝 **作品展示** - 支持从编程猫平台导入作品
- 💬 **评论系统** - 作品评论、回复功能
- 🏢 **工作室功能** - 创建工作室、协作开发
- 🤖 **AI内容审核** - 自动审核用户发布内容
- 🔒 **验证码支持** - 极验/hCaptcha验证码
- 👨‍💼 **后台管理** - 完整的管理后台系统
- 🐳 **Docker部署** - 一键Docker部署

## 技术栈

| 前端 | 后端 |
|------|------|
| Vue 3 | Node.js + Express |
| Element Plus | Sequelize ORM |
| Pinia | SQLite / MySQL |
| Vue Router | JWT认证 |
| Vite | |

## 快速开始

### 方式一：Docker部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/txcxgzs/codedog.git
cd codedog

# 2. 运行一键部署脚本
chmod +x deploy.sh && ./deploy.sh
```

### 方式二：本地开发

```bash
# 1. 克隆项目
git clone https://github.com/txcxgzs/codedog.git
cd codedog

# 2. 安装依赖
cd server && npm install
cd ../client && npm install

# 3. 启动后端
cd server && npm run dev

# 4. 启动前端（新终端）
cd client && npm run dev
```

## 访问地址

| 服务 | 地址 |
|------|------|
| 前端首页 | http://localhost:3001 |
| 后端API | http://localhost:3001/api |
| 后台管理 | http://localhost:3001/admin |

## 管理员说明

**第一个使用编程猫登录的用户将自动成为超级管理员。**

后续的管理员需要由超级管理员在后台进行设置。

## 配置说明

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
“后端端口优先读取 PORT，若未设置则读取 SERVER_PORT。”

## 目录结构

```
codedog/
├── server/                 # 后端代码
│   ├── config/            # 配置文件
│   ├── controllers/       # 控制器
│   ├── middleware/        # 中间件
│   ├── models/            # 数据模型
│   ├── routes/            # 路由
│   ├── services/          # 服务
│   └── app.js             # 入口文件
├── client/                 # 前端代码
│   ├── src/
│   │   ├── api/           # API接口
│   │   ├── components/    # 组件
│   │   ├── router/        # 路由
│   │   ├── stores/        # 状态管理
│   │   └── views/         # 页面
│   └── vite.config.js     # Vite配置
├── docs/                   # 文档
├── docker-compose.yml      # Docker编排
├── deploy.sh              # 一键部署脚本
└── README.md              # 项目说明
```

## 常用命令

### Docker部署

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down
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

## 常见问题

### 1. 端口被占用

修改 `.env` 文件中的端口配置：
```env
CLIENT_PORT=8081
SERVER_PORT=3002
```

### 2. 数据库连接失败

检查数据库配置是否正确，SQLite无需额外配置。

### 3. 前端无法访问后端API

检查后端服务是否正常启动，查看控制台日志。

## 贡献指南

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

## 致谢

- [Vue.js](https://vuejs.org/)
- [Element Plus](https://element-plus.org/)
- [Express.js](https://expressjs.com/)
- [Sequelize](https://sequelize.org/)
