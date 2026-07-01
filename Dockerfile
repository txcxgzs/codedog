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

# 修复：创建非 root 用户 app 并将 /app 目录所有权交给 app，避免容器以 root 运行
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app

# 环境变量默认值
ENV PORT=3001
ENV DB_TYPE=sqlite
ENV DB_PATH=/app/server/data/database.sqlite
ENV NODE_ENV=production

EXPOSE 3001

# 修复：以非 root 用户 app 运行，提升容器安全性
USER app

WORKDIR /app/server
CMD ["./docker-entrypoint.sh"]
