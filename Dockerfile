FROM node:20-alpine

# better-sqlite3 是原生模块，需要编译工具
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 创建数据持久化目录
RUN mkdir -p /app/data

# 安装 server 依赖（单独复制 package 文件以利用 layer 缓存）
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# 复制服务端代码和前端静态文件
COPY server/ ./server/
COPY dist/ ./dist/

ENV DATA_DIR=/app/data

EXPOSE 3001

CMD ["node", "server/index.js"]
