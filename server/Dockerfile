FROM node:18-alpine

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

RUN apk add --no-cache python3 make g++ sqlite netcat-openbsd

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/data
RUN mkdir -p /app/uploads/avatars

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

ENV NODE_ENV=production
ENV DB_TYPE=sqlite
ENV DB_PATH=/app/data/database.sqlite

CMD ["/app/docker-entrypoint.sh"]
