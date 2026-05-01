#!/bin/bash

cd "$(dirname "$0")"

echo "停止编程狗社区..."

if [ -f .server.pid ]; then
    kill $(cat .server.pid) 2>/dev/null
    rm .server.pid
fi

if [ -f .client.pid ]; then
    kill $(cat .client.pid) 2>/dev/null
    rm .client.pid
fi

echo "已停止"
