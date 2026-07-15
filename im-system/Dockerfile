FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci

FROM deps AS builder
COPY apps ./apps
RUN npm run build

FROM node:20-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/server ./apps/server
RUN mkdir -p /app/data/image-temp && chown -R node:node /app/data
USER node
EXPOSE 3100
CMD ["node", "apps/server/src/app.js"]

FROM nginx:1.27-alpine AS frontend
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html/im
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html/im/admin
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
