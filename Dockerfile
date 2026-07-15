# ============================================================
# 多阶段构建：把编译工具(g++/python3/make)隔离在 builder 阶段
# 最终运行时镜像只带轻量依赖,apk add 从 385s 降到 ~30s
# ============================================================

# ============================================================
# 镜像源优化:统一使用清华源,香港访问比默认 dl-cdn.alpinelinux.org 快很多
# Node 版本:升级到 20,解决 marked@17+ 需要 Node>=20 的兼容问题
# ============================================================

# 第一阶段：构建前端
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
# 使用淘宝 npm 镜像,香港访问也比 npmjs.org 快
RUN npm install --registry=https://registry.npmmirror.com
COPY client/ ./
RUN npm run build

# 第二阶段：编译后端原生模块(sqlite3/sharp 需要 python3/make/g++)
# 这一层只在 package.json 变化时重新执行,平时被 Docker 缓存复用
FROM node:20-alpine AS backend-builder
# 换清华源加速 apk(默认 dl-cdn.alpinelinux.org 香港访问很慢)
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apk/repositories && \
    apk add --no-cache python3 make g++
# 修复: WORKDIR 必须在 COPY 之前,否则 COPY ./server/ 会落到根目录
# 导致后续 npm install 在 /app/server/ 找不到 package.json
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --production --registry=https://registry.npmmirror.com

# 第三阶段：运行时镜像(不带编译工具,镜像更小、构建更快)
FROM node:20-alpine
WORKDIR /app

# 换清华源加速 apk,只装运行时必需的轻量工具:
# - netcat-openbsd: entrypoint 探活 MySQL
# - mysql-client:  数据库操作工具
# - curl:          healthcheck 探活
# 注意:不再装 python3/make/g++,它们只在 backend-builder 阶段使用
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apk/repositories && \
    apk add --no-cache netcat-openbsd mysql-client curl font-noto-cjk

# 从 backend-builder 复制已编译好的 node_modules(含 sqlite3/sharp 的 .node 二进制)
COPY --from=backend-builder /app/server/node_modules ./server/node_modules

# 复制后端源码
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
