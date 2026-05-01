# 部署文档

## 目录

- [一键部署](#一键部署)
- [Docker部署](#docker部署)
- [宝塔面板部署](#宝塔面板部署)
- [本地开发部署](#本地开发部署)
- [配置说明](#配置说明)
- [常用命令](#常用命令)
- [常见问题](#常见问题)

---

## 一键部署

### Linux/Mac

```bash
# 一键安装部署（自动安装Docker、生成配置、启动服务）
curl -fsSL https://raw.githubusercontent.com/txcxgzs/codedog/main/deploy.sh | bash
```

### 手动克隆后部署

```bash
# 克隆项目
git clone https://github.com/txcxgzs/codedog.git
cd codedog

# 运行一键部署脚本
chmod +x deploy.sh
./deploy.sh
```

---

## Docker部署

### 环境要求

| 项目 | 要求 |
|-----|------|
| 操作系统 | Ubuntu 18+ / Debian 10+ / CentOS 7+ |
| Docker | 20.10+ |
| docker-compose | 1.29+ 或 docker compose |
| 内存 | 最低 512MB，推荐 1GB+ |
| 端口 | 8080（前端）、3001（后端） |

### 手动部署

```bash
# 1. 克隆项目
git clone https://github.com/txcxgzs/codedog.git
cd codedog

# 2. 创建环境配置
cp .env.example .env

# 3. 创建数据目录
mkdir -p server/data

# 4. 构建并启动
docker-compose up -d --build

# 5. 查看状态
docker-compose ps
```

---

## 宝塔面板部署

### 前提条件

- 已安装宝塔面板
- 已安装 Node版本管理器（软件商店 → Node版本管理器 → 安装）

### 部署步骤

#### 1. 安装软件

在【软件商店】安装：
- Nginx（反向代理）
- MySQL 5.7/8.0（可选，默认使用SQLite）
- PM2管理器（进程管理）
- Node版本管理器（Node.js环境）

#### 2. 安装Node.js

1. 点击【Node版本管理器】→【设置】
2. 安装 Node.js 18.x 版本
3. 设置为命令行版本

#### 3. 上传代码

```bash
cd /www/wwwroot
git clone https://github.com/txcxgzs/codedog.git
cd codedog
```

#### 4. 运行安装脚本

```bash
chmod +x install.sh
./install.sh
# 选择 "宝塔面板部署" 选项
```

#### 5. 配置Nginx反向代理

1. 点击【网站】→【添加站点】
2. 填写域名，根目录选择 `/www/wwwroot/codedog/client/dist`
3. PHP版本选择"纯静态"
4. 点击【设置】→【配置文件】，替换为：

```nginx
server {
    listen 80;
    server_name example.com;  # 替换为你的域名
    
    root /www/wwwroot/codedog/client/dist;
    index index.html;

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API反向代理
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 6. 配置PM2

在宝塔【软件商店】→【PM2管理器】→【设置】：
1. 点击【添加项目】
2. 项目目录：`/www/wwwroot/codedog/server`
3. 启动文件：`app.js`
4. 项目名称：`codedog-server`

#### 7. SSL证书配置

1. 点击网站【设置】→【SSL】
2. 选择【Let's Encrypt】
3. 勾选域名，点击【申请】
4. 开启【强制HTTPS】

---

## 本地开发部署

### 环境要求

- Node.js 18+
- npm 或 yarn

### 部署步骤

```bash
# 1. 克隆项目
git clone https://github.com/txcxgzs/codedog.git
cd codedog

# 2. Windows用户运行
install.bat

# 3. Linux/Mac用户运行
chmod +x install.sh
./install.sh

# 4. 选择 "本地开发部署" 选项

# 5. 启动后端
cd server && npm run dev

# 6. 启动前端（新终端）
cd client && npm run dev
```

---

## 配置说明

### 环境变量 (.env)

```env
# 服务端口
CLIENT_PORT=8080
SERVER_PORT=3001

# 数据库类型 (sqlite/mysql)
DB_TYPE=sqlite

# MySQL配置（当DB_TYPE=mysql时）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=coding_dog
DB_USER=root
DB_PASSWORD=your_mysql_password

# JWT配置（一键部署脚本会自动生成）
JWT_SECRET=auto-generated-by-deploy-script
JWT_EXPIRES_IN=7d
```

### 数据库配置

#### SQLite（默认）

无需额外配置，数据库文件自动创建在 `server/data/` 目录。

#### MySQL

1. 创建数据库：
```sql
CREATE DATABASE coding_dog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 修改 `.env`：
```env
DB_TYPE=mysql
DB_HOST=localhost
DB_NAME=coding_dog
DB_USER=your_user
DB_PASSWORD=your_password
```

---

## 常用命令

### Docker

```bash
# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 重新构建
docker-compose up -d --build
```

### PM2

```bash
# 查看进程
pm2 list

# 查看日志
pm2 logs codedog-server

# 重启
pm2 restart codedog-server

# 停止
pm2 stop codedog-server
```

### Nginx

```bash
# 测试配置
nginx -t

# 重载配置
nginx -s reload
```

---

## 常见问题

### 1. 端口被占用

修改 `.env` 文件中的端口配置：
```env
CLIENT_PORT=8081
SERVER_PORT=3002
```

### 2. 数据库连接失败

- 检查MySQL服务是否运行
- 检查数据库用户名密码是否正确
- 检查 `.env` 配置是否正确

### 3. 前端页面空白

- 检查 `dist` 目录是否存在
- 检查Nginx配置的 `root` 路径是否正确
- 查看浏览器控制台错误

### 4. 502 Bad Gateway

- 检查后端服务是否运行：`pm2 list` 或 `docker-compose ps`
- 检查端口是否正确：`netstat -tlnp | grep 3001`

### 5. 如何获取管理员权限

**第一个使用编程猫登录的用户将自动成为超级管理员。**

如果需要重新设置管理员：
```bash
# 方法1：清空数据库重新初始化
rm -rf server/data/database.sqlite
# 重启服务后第一个登录的用户成为管理员

# 方法2：在数据库中修改用户角色
# 使用SQLite命令行工具
sqlite3 server/data/database.sqlite
UPDATE Users SET role='superadmin' WHERE username='用户名';
```

---

## 管理员说明

**第一个使用编程猫登录的用户将自动成为超级管理员。**

后续的管理员需要由超级管理员在后台进行设置。
