# 第一阶段：构建前端
FROM node:18-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# 第二阶段：运行后端
FROM node:18-alpine
WORKDIR /app

# 安装必要工具（修复：补充 python3/make/g++，sqlite3 原生模块需要编译；mysql-client 供 entrypoint 探活；curl 供 healthcheck 探活）
RUN apk add --no-cache netcat-openbsd python3 make g++ mysql-client curl

# 复制后端依赖并安装
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production

# 复制后端源码
WORKDIR /app
COPY server/ ./server/

# 复制前端构建产物
COPY --from=frontend-builder /app/client/dist ./client/dist

# 复制并设置启动脚本
COPY server/docker-entrypoint.sh /app/server/docker-entrypoint.sh
RUN chmod +x /app/server/docker-entrypoint.sh

# 创建数据目录
RUN mkdir -p /app/server/data /app/server/uploads/avatars /app/server/uploads/works /app/server/downloaded

# Render 兼容说明:
# - Render 持久磁盘挂载到 /app/server/data 和 /app/server/uploads
# - Render Docker 默认以 root 运行,挂载的磁盘属主也是 root
# - 若使用 USER app,挂载的磁盘可能因权限不足导致 SQLite 写入失败
# - 因此 Render 部署时不切换用户,Docker/宝塔部署仍可手动加 USER app
# 环境变量默认值
ENV PORT=3001
ENV DB_TYPE=sqlite
ENV DB_PATH=/app/server/data/database.sqlite
ENV NODE_ENV=production

EXPOSE 3001

# Render 部署:以 root 运行(持久磁盘权限兼容)
# Docker/宝塔部署:可取消下行注释以非 root 用户运行
# USER app

WORKDIR /app/server
CMD ["./docker-entrypoint.sh"]
