# CodeDog 部署指南

## 🚀 一键部署

### 前置要求
- 安装 [Docker](https://docs.docker.com/get-docker/)
- 安装 [Docker Compose](https://docs.docker.com/compose/install/)

### Linux/Mac 部署
```bash
# 克隆项目
git clone https://github.com/your-username/codedog.git
cd codedog

# 一键部署
chmod +x deploy.sh
./deploy.sh
```

### Windows 部署
```cmd
# 克隆项目
git clone https://github.com/your-username/codedog.git
cd codedog

# 一键部署
deploy.bat
```

### 访问地址
- 本地访问: http://localhost:3001
- 局域网访问: http://你的IP:3001

---

## 📦 更新系统

### Linux/Mac 更新
```bash
chmod +x update.sh
./update.sh
```

### Windows 更新
```cmd
update.bat
```

### 手动更新
```bash
# 1. 备份数据
cp -r data data_backup
cp -r uploads uploads_backup

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建并重启
docker compose build
docker compose down
docker compose up -d
```

---

## 🔧 配置说明

### 环境变量
在 `docker-compose.yml` 中配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| NODE_ENV | production | 运行环境 |
| DB_TYPE | sqlite | 数据库类型 (sqlite/mysql) |
| DB_PATH | /app/server/data/database.sqlite | SQLite 数据库路径 |

### 使用 MySQL
```yaml
environment:
  - DB_TYPE=mysql
  - DB_HOST=your_host
  - DB_PORT=3306
  - DB_NAME=codedog
  - DB_USER=your_user
  - DB_PASSWORD=your_password
```

---

## 📁 数据目录

```
codedog/
├── data/              # 数据库文件
│   └── database.sqlite
└── uploads/           # 上传文件
    ├── avatars/       # 用户头像
    └── works/         # 作品文件
```

---

## 🛠️ 常用命令

```bash
# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 进入容器
docker compose exec codedog sh

# 查看容器状态
docker compose ps
```

---

## ⚠️ 注意事项

1. **数据备份**: 更新前请务必备份 `data` 和 `uploads` 目录
2. **端口冲突**: 默认使用 3001 端口，如需修改请编辑 `docker-compose.yml`
3. **数据库迁移**: 大版本更新可能需要数据库迁移，请查看更新日志
4. **敏感词库**: 系统内置 87,000+ 敏感词，可在后台管理页面维护

---

## 🔄 回滚操作

如果更新后出现问题，可以回滚到备份版本：

```bash
# Linux/Mac
cp -r backup_XXXXXXXX_XXXXXX/data ./data
cp -r backup_XXXXXXXX_XXXXXX/uploads ./uploads
docker compose restart

# Windows
xcopy backup_XXXXXXXX_XXXXXX\data data /E /I /Y
xcopy backup_XXXXXXXX_XXXXXX\uploads uploads /E /I /Y
docker compose restart
```
