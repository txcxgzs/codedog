FROM node:18-alpine

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

# 修复：补充 mysql-client，供 entrypoint 用 mysqladmin 探活 MySQL
RUN apk add --no-cache python3 make g++ sqlite netcat-openbsd mysql-client

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/data
RUN mkdir -p /app/uploads/avatars

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 修复：创建非 root 用户 app 并将 /app 目录所有权交给 app，避免容器以 root 运行
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app

EXPOSE 3001

ENV NODE_ENV=production
ENV DB_TYPE=sqlite
ENV DB_PATH=/app/data/database.sqlite

# 修复：以非 root 用户 app 运行，提升容器安全性
USER app

CMD ["/app/docker-entrypoint.sh"]
