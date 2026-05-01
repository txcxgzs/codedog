#!/bin/bash

cd "$(dirname "$0")"

echo "启动编程狗社区..."

# 启动后端
cd server
node app.js &
echo $! > ../.server.pid
cd ..

# 启动前端
cd client
npm run dev &
echo $! > ../.client.pid
cd ..

echo ""
echo "前端: http://localhost:8080"
echo "后端: http://localhost:3001"
echo ""
echo "按 Ctrl+C 停止"
wait
