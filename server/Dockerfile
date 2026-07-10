# ===== Stage 1: builder - 编译 native 模块 =====
# 说明：python3/make/g++ 仅在构建阶段用于编译 sqlite3 等 native Node 模块，
# 不会出现在最终运行时镜像中，从而缩小镜像体积并减少攻击面。
#
# 注意：此 Dockerfile 用于在 server/ 目录下独立构建后端镜像（不带前端）。
#       docker-compose.yml 使用的是项目根目录的 Dockerfile（含前端构建）。
#       两个 Dockerfile 的容器内路径不同：
#         - 根 Dockerfile: 代码在 /app/server/，DB 在 /app/server/data/
#         - 此 Dockerfile: 代码在 /app/，DB 在 /app/data/
FROM node:18-alpine AS builder

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

# 编译工具：python3/make/g++ 用于编译 sqlite3 等原生模块
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --production

# ===== Stage 2: 运行时 =====
# 仅包含运行时必需的工具，不含编译工具链（python3/make/g++）
FROM node:18-alpine

WORKDIR /app

# 运行时工具：
# - sqlite: 数据库（sqlite3 CLI，entrypoint 用于清理临时表）
# - netcat-openbsd: entrypoint 端口探活
# - mysql-client: MySQL 探活
# - curl: healthcheck 探活
RUN apk add --no-cache sqlite netcat-openbsd mysql-client curl

# 从 builder 阶段复制已编译好的 node_modules（含 native 模块的二进制）
COPY --from=builder /app/node_modules /app/node_modules

# 复制源代码（构建上下文为 server/ 目录，所以代码复制到 /app/）
COPY . .

# 创建数据/上传/下载目录并设置权限（在切换用户之前）
RUN mkdir -p /app/data /app/uploads/avatars /app/uploads/works /app/downloaded && \
    addgroup -S app && adduser -S app -G app && \
    chown -R app:app /app

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

ENV NODE_ENV=production
ENV DB_TYPE=sqlite
# 独立构建时数据库路径为 /app/data/database.sqlite
# （与根 Dockerfile 的 /app/server/data/ 不同，因为此镜像代码在 /app/ 而非 /app/server/）
ENV DB_PATH=/app/data/database.sqlite

USER app

CMD ["/app/docker-entrypoint.sh"]
