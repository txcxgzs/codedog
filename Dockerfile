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

# 安装必要工具
RUN apk add --no-cache netcat-openbsd

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

# 环境变量默认值
ENV PORT=3001
ENV DB_TYPE=sqlite
ENV DB_PATH=/app/server/data/database.sqlite
ENV NODE_ENV=production

EXPOSE 3001

WORKDIR /app/server
CMD ["./docker-entrypoint.sh"]
