# Remind App

简洁的待办事项应用，深色主题，开箱即用。

## 启动步骤

### 1. 进入项目目录

```bash
cd "C:\Users\19051\Desktop\ai_deploy\remind app\remind-app"
```

### 2. 启动服务

```bash
npm run dev
```

等待看到以下输出：

```
Remind server running on http://localhost:3001
VITE v8.0.8  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 3. 打开浏览器

访问 **http://localhost:5173**

---

## 常见问题

### 端口被占用

如果启动失败，提示端口被占用，先清理：

```bash
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
```

然后再 `npm run dev`

### 服务停止

关闭终端时服务会自动停止。需要重新启动。

---

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Express + SQLite
- 样式：自定义CSS（深色主题）

## 项目结构

```
remind-app/
├── src/               # 前端源码
│   ├── App.tsx        # 主组件
│   ├── api.ts         # API调用层
│   └── types.ts       # TypeScript类型定义
├── server/            # 后端源码
│   ├── index.js       # Express路由
│   └── database.js    # SQLite数据库
└── ARCHITECTURE.md    # 架构文档（学习用）
```
