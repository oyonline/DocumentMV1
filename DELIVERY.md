# 文档管理系统 V0 — 交付清单

## 一、文件清单（38 个源文件）

### 后端 `/backend`（21 文件）

| 路径 | 作用 |
|---|---|
| `go.mod` | Go 模块定义 + 依赖声明 |
| `.env.example` | 环境变量模板 |
| `Dockerfile` | 多阶段构建镜像 |
| `cmd/server/main.go` | 程序入口，组装依赖并启动 HTTP |
| `internal/config/config.go` | 环境变量加载为 Config 结构 |
| `internal/domain/models.go` | 核心实体：User / Document / DocumentVersion / DocumentShare |
| `internal/domain/errors.go` | Sentinel 错误（NotFound / Forbidden / Unauthorized 等） |
| `internal/repository/db.go` | PostgreSQL 连接池初始化 |
| `internal/repository/user_repo.go` | 用户表 CRUD |
| `internal/repository/document_repo.go` | 文档表 CRUD + 可见性 / 权限查询 |
| `internal/repository/version_repo.go` | 版本表 CRUD |
| `internal/service/auth_service.go` | 注册 / 登录 + JWT 签发 + bcrypt |
| `internal/service/document_service.go` | 文档创建 / 编辑（事务）/ 列表 / 详情 / 版本列表 |
| `internal/middleware/auth.go` | JWT Bearer Token 校验中间件 |
| `internal/middleware/logger.go` | 请求日志（method / path / status / latency / userId） |
| `internal/handler/response.go` | 统一响应格式 `{ data, error, request_id }` |
| `internal/handler/auth_handler.go` | POST /api/auth/register, /api/auth/login |
| `internal/handler/document_handler.go` | GET / POST / PUT /api/docs + GET /api/docs/{id}/versions |
| `internal/handler/router.go` | chi 路由注册 + CORS + 中间件编排 |
| `migrations/000001_init.up.sql` | 建表：users / documents / document_versions / document_shares + 索引 |
| `migrations/000001_init.down.sql` | 回滚：逆序删除所有表和类型 |

### 前端 `/frontend`（17 文件）

| 路径 | 作用 |
|---|---|
| `package.json` | Next.js 14 + Tailwind + Zod 依赖 |
| `tsconfig.json` | TypeScript 严格模式 + 路径别名 `@/*` |
| `next.config.ts` | API rewrite 代理到 Go 后端 |
| `tailwind.config.ts` | 品牌色 (Indigo) + Inter 字体族 |
| `postcss.config.mjs` | PostCSS 插件配置 |
| `.env.local.example` | 前端环境变量模板 |
| `app/globals.css` | 设计系统基础：card / btn-primary / btn-secondary / input / label |
| `app/layout.tsx` | 根布局：AuthProvider + Header + 内容区 |
| `app/page.tsx` | 首页重定向（已登录→/docs，未登录→/login） |
| `app/login/page.tsx` | 登录 / 注册页（表单切换，错误提示） |
| `app/docs/page.tsx` | 文档列表页（可见性标签，空状态） |
| `app/docs/new/page.tsx` | 新建文档页（标题 + 可见性 + 内容编辑器） |
| `app/docs/[id]/page.tsx` | 文档详情页（内容展示 + 版本历史折叠面板） |
| `app/docs/[id]/edit/page.tsx` | 编辑文档页（保存自动产生新版本） |
| `lib/api.ts` | API 客户端（统一 fetch + 错误处理 + Token 注入） |
| `lib/auth.tsx` | AuthContext + useAuth + useRequireAuth |
| `components/header.tsx` | 全局顶栏（品牌名 + 新建 + 退出） |

---

## 二、数据模型 ER 设计

```
┌──────────────┐         ┌──────────────────┐
│   users      │         │   documents      │
├──────────────┤    1:N  ├──────────────────┤
│ id (PK)      │◄────────│ owner_id (FK)    │
│ email (UQ)   │         │ id (PK)          │
│ password_hash│         │ title            │
│ created_at   │         │ visibility (ENUM)│
└──────────────┘         │ latest_version_id│──┐
                         │ created_at       │  │
                         │ updated_at       │  │
                         └──────────────────┘  │
                                │ 1:N          │ FK
                         ┌──────┴───────────┐  │
                         │ document_versions │  │
                         ├──────────────────┤  │
                         │ id (PK) ◄────────┘
                         │ document_id (FK) │
                         │ content (TEXT)   │
                         │ created_by (FK)  │
                         │ created_at       │
                         └─────────────────┘

┌──────────────────┐
│ document_shares  │
├──────────────────┤
│ id (PK)          │
│ document_id (FK) │
│ user_id (FK)     │
│ role (ENUM)      │  VIEW / EDIT
│ created_at       │
│ UNIQUE(doc,user) │
└──────────────────┘
```

**索引策略**：owner_id、visibility、document_id + created_at DESC（版本按时间查）、shares 按 doc 和 user 分别索引。

---

## 三、API 设计

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| POST | `/api/auth/register` | 注册，返回 JWT | 无 |
| POST | `/api/auth/login` | 登录，返回 JWT | 无 |
| GET | `/api/docs` | 文档列表（仅当前用户可见） | Bearer |
| POST | `/api/docs` | 创建文档（含首版本，单事务） | Bearer |
| GET | `/api/docs/{id}` | 文档详情 + 最新内容 | Bearer |
| PUT | `/api/docs/{id}` | 编辑保存（新建版本，单事务） | Bearer |
| GET | `/api/docs/{id}/versions` | 版本历史 | Bearer |
| GET | `/health` | 健康检查 | 无 |

**统一响应格式**：

```json
{ "data": { ... }, "error": null, "request_id": "a1b2c3d4" }
```

**状态码**：200 OK / 201 Created / 400 Bad Request / 401 Unauthorized / 403 Forbidden / 404 Not Found / 409 Conflict / 500 Internal Error

---

## 四、权限模型

| 可见性 | 列表可见 | 读取 | 编辑 |
|---|---|---|---|
| PRIVATE | 仅 owner | 仅 owner | 仅 owner |
| PUBLIC | 所有登录用户 | 所有登录用户 | 仅 owner |
| SHARED | owner + share 表中的用户 | owner + share 表中的用户 | owner + share.role=EDIT |

后端在 `DocumentRepo.HasReadAccess` / `HasEditAccess` 中用 SQL 强校验，前端仅做展示控制。

---

## 五、一键启动步骤

### 前置要求

- **Go 1.22+**
- **Node.js 18+**
- **PostgreSQL 14+**

### 1. 启动数据库

```bash
docker run -d --name docmv-pg \
  -e POSTGRES_USER=docmv \
  -e POSTGRES_PASSWORD=docmv \
  -e POSTGRES_DB=docmv \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. 执行数据库迁移

```bash
psql "postgres://docmv:docmv@localhost:5432/docmv?sslmode=disable" \
  -f backend/migrations/000001_init.up.sql
```

### 3. 启动后端

```bash
cd backend
cp .env.example .env    # 按需修改
go mod tidy             # 下载依赖（首次）
go run ./cmd/server     # 启动于 :8080
```

### 4. 启动前端

```bash
cd frontend
cp .env.local.example .env.local
npm install             # 安装依赖（首次）
npm run dev             # 启动于 :3000
```

### 5. 打开浏览器

访问 `http://localhost:3000` → 注册账户 → 开始使用。

---

## 六、最小验收清单

| # | 验收点 | 如何验证 |
|---|---|---|
| 1 | 注册 | /login → 切换注册 → 填写邮箱密码 → 提交成功跳转 /docs |
| 2 | 登录 | 退出后重新登录 → 成功跳转 /docs |
| 3 | 创建文档 | 点击「新建文档」→ 填写标题 / 内容 / 可见性 → 创建成功跳转详情 |
| 4 | 文档列表 | /docs 页面展示刚创建的文档，显示可见性标签 |
| 5 | 文档详情 | 点击文档 → 显示标题 + 内容 + 版本历史 (1 条) |
| 6 | 编辑保存 | 点击编辑 → 修改内容 → 保存 → 回到详情，版本数变为 2 |
| 7 | 版本列表 | 详情页展开版本历史 → 显示 2 个版本，按时间倒序 |
| 8 | 权限校验 | 用另一个账户登录 → PRIVATE 文档不出现在列表中 |

---

## 七、技术选型摘要

| 层 | 选型 |
|---|---|
| 后端框架 | Go + chi |
| 数据库访问 | sqlx + lib/pq |
| 数据库 | PostgreSQL 16 |
| 鉴权 | JWT (golang-jwt/jwt/v5) |
| 密码 | bcrypt (golang.org/x/crypto) |
| 前端框架 | Next.js 14 App Router + TypeScript |
| 样式 | Tailwind CSS 3 |
| 状态管理 | React Context (AuthProvider) |
| API 通信 | fetch + Next.js rewrite 代理 |
