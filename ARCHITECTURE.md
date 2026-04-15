# Remind App 架构文档

> 帮你理解前后端是怎么配合工作的，每个部分为什么这样写

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────┐
│                    用户浏览器                        │
│  ┌──────────────────────────────────────────────┐   │
│  │              React 前端 (端口 5173)           │   │
│  │   ├── App.tsx（主组件，所有UI和交互逻辑）      │   │
│  │   ├── api.ts（API 调用层）                    │   │
│  │   ├── types.ts（TypeScript 类型定义）         │   │
│  │   └── App.css（样式）                        │   │
│  └─────────────────┬────────────────────────────┘   │
│                    │ fetch / JSON                  │
└────────────────────┼────────────────────────────────┘
                     │ HTTP
┌────────────────────┼────────────────────────────────┐
│                    ▼                                │
│  ┌──────────────────────────────────────────────┐   │
│  │           Express 后端 (端口 3001)           │   │
│  │   ├── index.js（路由处理）                    │   │
│  │   └── database.js（SQLite 操作封装）          │   │
│  └─────────────────┬────────────────────────────┘   │
│                    │                                │
│                    ▼                                │
│         ┌────────────────────┐                    │
│         │   todos.db (SQLite) │                    │
│         │  ├── lists 表       │                    │
│         │  └── todos 表       │                    │
│         └────────────────────┘                    │
│                   服务器端                          │
└─────────────────────────────────────────────────────┘
```

**一句话概括：** 前端负责"长什么样"和"怎么交互"，后端负责"数据存哪里"和"业务逻辑"。

---

## 二、前端架构

### 2.1 文件结构

```
src/
├── App.tsx      ← 主组件，所有UI和交互逻辑都在这里
├── App.css      ← 组件样式（和 App.tsx 一一对应）
├── api.ts       ← API 调用层（封装所有 fetch 请求）
├── types.ts     ← TypeScript 类型定义（告诉 TS 数据长什么样）
└── index.css    ← 全局样式（目前只做了背景色）
```

### 2.2 React 组件化思路

这个项目的 React 结构非常简单——**只有一个大组件 `App.tsx`**，没有进一步拆分。

**为什么这样写可以工作？**
- 代码量在 400 行以内，拆分反而增加复杂度
- 所有状态都在一个组件里，管理起来更直接

**什么时候需要拆分组件？**
- 当某个部分可以被**独立复用**（比如一个按钮、一个输入框）
- 当某个部分逻辑太复杂，需要单独管理（Modal弹窗、日期选择器等）
- 当多人协作时，不同人负责不同组件

**拆分示例（如果你以后想优化）：**
```tsx
// 拆成独立组件后
<App>
  <Sidebar lists={lists} onSelectList={...} />
  <TodoList todos={todos} onToggle={...} />
  <AddTodoForm onSubmit={...} />
</App>
```

### 2.3 React 的核心概念

#### 状态（State）
```tsx
const [todos, setTodos] = useState<Todo[]>([]);
// todos 是当前数据
// setTodos 是更新数据的函数（类似 Python 里的 todos = [...]）
```

**为什么用 setTodos 而不是直接改？**
React 检测到状态变化后，会**重新渲染组件**（相当于刷新页面）。如果你直接改 `todos = [...]`，React 不知道数据变了，界面就不会更新。

#### 副作用（useEffect）
```tsx
useEffect(() => {
  loadTodos();  // 组件首次加载时执行
}, [activeList]);  // 当 activeList 变化时重新执行
```

**常见用途：**
- 页面加载时请求数据
- 监听某个值变化时做操作
- 设置定时器

#### 回调（useCallback）
```tsx
const loadTodos = useCallback(async () => {
  // ...
}, [activeList, searchQuery]);
```

**为什么用 useCallback？**
`useEffect` 依赖 `loadTodos`，但如果 `loadTodos` 每次渲染都是新函数，`useEffect` 会不断触发。`useCallback` 保证函数引用不变，除非依赖真的变了。

### 2.4 API 调用层（api.ts）

```tsx
// 核心封装
async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();  // 自动解析 JSON
}
```

**为什么要封装？**
- 所有请求都走同一个逻辑（统一加 header、统一处理错误）
- 返回值自动类型化（`Promise<Todo[]>` 告诉你返回的是 Todo 数组）
- 以后改请求逻辑（比如加 token、加错误处理）只需改一处

**使用示例：**
```tsx
// GET 请求
const todos = await api.getTodos('default');

// POST 请求
await api.createTodo({ list_id: 'default', text: '买饭' });

// PUT 请求（更新）
await api.updateTodo(id, { completed: true });

// DELETE 请求
await api.deleteTodo(id);
```

### 2.5 数据流

```
用户点击完成按钮
      │
      ▼
handleToggleTodo(id)  ← 事件处理函数
      │
      ▼
api.toggleTodo(id)    ← 调用 API
      │
      ▼
fetch('POST /api/todos/xxx/toggle')  ← 发送 HTTP 请求
      │
      ▼
后端更新数据库
      │
      ▼
loadTodos() 重新获取数据  ← 刷新列表
      │
      ▼
setTodos(newData)  ← 更新状态
      │
      ▼
React 检测到状态变化 → 重新渲染 UI
```

---

## 三、后端架构

### 3.1 文件结构

```
server/
├── index.js      ← 所有路由（接收请求、返回数据）
├── database.js   ← 数据库操作（建表、增删改查）
└── todos.db      ← SQLite 数据库文件（自动生成）
```

### 3.2 Express 路由设计

Express 的核心是：**一个请求过来，找到对应的路由函数处理，然后返回结果。**

```js
// 语法：app.方法('路径', 处理函数)
app.get('/api/lists', (req, res) => {
  // req = 收到的请求（包含参数、body 等）
  // res = 要返回的响应
  const lists = db.prepare('SELECT * FROM lists').all();
  res.json(lists);  // 返回 JSON
});
```

**RESTful API 设计风格：**

| 方法 | 路径 | 含义 | 对应操作 |
|------|------|------|----------|
| GET | /api/lists | 获取所有列表 | 查 |
| POST | /api/lists | 创建列表 | 增 |
| PUT | /api/lists/:id | 更新某个列表 | 改 |
| DELETE | /api/lists/:id | 删除某个列表 | 删 |

**URL 参数 vs 查询参数：**
```js
// :id 是 URL 参数（路径的一部分）
app.put('/api/lists/:id', (req, res) => {
  const { id } = req.params;  // 从路径获取
});

// ?completed=true 是查询参数（URL 后面?的部分）
app.get('/api/lists/:listId/todos', (req, res) => {
  const { completed } = req.query;  // 从 ?key=value 获取
});
```

### 3.3 SQLite 数据库设计

```sql
-- 列表表：存储不同的待办分类
CREATE TABLE lists (
  id TEXT PRIMARY KEY,        -- 唯一标识（UUID）
  name TEXT NOT NULL,         -- 列表名称
  color TEXT DEFAULT '#8B5CF6',  -- 颜色
  created_at TEXT,            -- 创建时间
  sort_order INTEGER DEFAULT 0  -- 排序顺序
);

-- 待办表：存储每一条待办
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,      -- 属于哪个列表（外键）
  text TEXT NOT NULL,         -- 待办内容
  completed INTEGER DEFAULT 0, -- 是否完成（0或1）
  due_date TEXT,              -- 截止日期
  due_time TEXT,              -- 截止时间
  remind_at TEXT,             -- 提醒时间
  created_at TEXT,
  completed_at TEXT,          -- 完成时间
  sort_order INTEGER,
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE  -- 删除列表时自动删除其中的待办
);
```

**表关系：**
```
lists (1) ──────< todos (多)
   │                   │
   │ 一对多关系：          │
   │ 一个列表可以有很多待办   │
   └─────────────────────┘
```

**为什么要用两个表而不是一个？**
- 一个表能做，但数据会混乱（列表和待办混在一起）
- 两个表可以按列表筛选、统计每个列表的完成情况
- 支持未来扩展（比如给列表加图标、排序）

### 3.4 数据库操作

```js
// 查询所有
db.prepare('SELECT * FROM lists ORDER BY sort_order').all();

// 查询一条
db.prepare('SELECT * FROM todos WHERE id = ?').get(id);

// 插入
db.prepare('INSERT INTO todos (id, list_id, text) VALUES (?, ?, ?)')
  .run(id, list_id, text);

// 更新（只更新传入的字段）
if (text !== undefined) {
  db.prepare('UPDATE todos SET text = ? WHERE id = ?').run(text, id);
}
```

**为什么要用 `prepare` 而不是直接拼接 SQL？**
- 防止 SQL 注入攻击
- 参数化查询，更安全

---

## 四、前后端通信

### 4.1 通信流程

```
前端                           后端
  │                              │
  │  fetch('POST /api/todos',   │
  │    body: JSON.stringify(     │
  │      {text: '买饭'}          │
  │    ))                        │
  │  ──────────────────────────► │
  │                              │ Express 收到请求
  │                              │ 解析 JSON body
  │                              │ 写入 SQLite
  │                              │
  │  res.json(newTodo)  ◄──────── │
  │  ◄────────────────────────── │
  │                              │
  │  JSON.parse(response)        │
```

### 4.2 请求格式

**POST / PUT 请求体：**
```json
{
  "list_id": "abc123",
  "text": "买饭",
  "due_date": "2026-04-16",
  "due_time": "12:00"
}
```

**响应格式：**
```json
{
  "id": "xyz789",
  "list_id": "abc123",
  "text": "买饭",
  "completed": false,
  "due_date": "2026-04-16",
  "due_time": "12:00",
  "remind_at": null,
  "created_at": "2026-04-15T11:00:00",
  "completed_at": null,
  "sort_order": 1
}
```

---

## 五、关键设计决策

### 5.1 为什么要用 SQLite 而不是 MySQL/PostgreSQL？

| 数据库 | 特点 | 适用场景 |
|--------|------|----------|
| SQLite | 零配置、单文件、无服务器 | 小型应用、本地存储、移动端 |
| MySQL/PostgreSQL | 需要单独服务器、支持并发 | 生产环境、多用户系统 |

**这个项目选 SQLite 的原因：**
- 单人使用，不需要并发
- 数据文件直接存在服务器上，部署简单
- 无需额外安装数据库服务

### 5.2 为什么用 better-sqlite3 而不是 mysql2？

`better-sqlite3` 是**同步** API，写起来更直观：
```js
// better-sqlite3（同步，更直观）
const rows = db.prepare('SELECT * FROM todos').all();

// mysql2（异步Promise，需要 await）
const [rows] = await pool.query('SELECT * FROM todos');
```

Node.js 本身是单线程的，异步并不会让数据库查询变快。同步写法更简洁，错误也更容易追踪。

### 5.3 为什么前后端分开两个端口？

- **前端 (5173)**：Vite 开发服务器，擅长处理静态文件、热更新
- **后端 (3001)**：Express，处理 API 请求

分开的好处：
- 各自独立开发、互不影响
- 前端可以对接不同的后端（换端口就行）
- 生产环境可以用 Nginx 反向代理合并

### 5.4 为什么前端用 TypeScript？

- **类型安全**：写 `todos.filter(t => t.completed)` 时，TS 知道 `t` 有哪些字段
- **代码即文档**：`interface Todo` 告诉你数据结构
- **重构方便**：改了个字段名，编译器告诉你哪里要改

---

## 六、学习清单

### 前端（React）
- [ ] `useState` 的用法，什么时候该用它
- [ ] `useEffect` 的依赖数组，什么时候会触发执行
- [ ] `useCallback` 避免不必要的重复执行
- [ ] `fetch` + async/await 调 API
- [ ] TypeScript interface 定义数据结构

### 后端（Express）
- [ ] RESTful API 设计（GET/POST/PUT/DELETE）
- [ ] URL 参数 `:id` 和查询参数 `?key=value` 的区别
- [ ] `express.json()` 中间件解析请求体
- [ ] CORS 解决跨域问题

### 数据库（SQLite）
- [ ] 建表语句 `CREATE TABLE`
- [ ] 外键约束 `FOREIGN KEY`
- [ ] 索引 `CREATE INDEX` 加速查询
- [ ] `prepare` + 参数化查询防注入

### 通用
- [ ] 前后端分离架构
- [ ] HTTP 通信格式（JSON、状态码）
- [ ] Git 版本控制

---

## 七、扩展方向（如果你想继续学习）

1. **加登录功能**：加 `users` 表，前端请求带上 token
2. **加数据导出**：后端加一个导出 JSON/CSV 的接口
3. **加离线支持**：前端加 Service Worker（PWA）
4. **加推送通知**：后端加定时任务，到期时发邮件/短信

---

*文档生成时间：2026-04-15*
