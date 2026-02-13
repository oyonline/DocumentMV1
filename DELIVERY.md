# 文档管理系统 V0 — 交付清单

## 一、文件清单

### 后端 `/backend`（24 文件）

| 路径 | 作用 |
|---|---|
| `go.mod` | Go 模块定义 + 依赖声明 |
| `.env.example` | 环境变量模板（含 ADMIN_EMAIL/ADMIN_PASSWORD） |
| `Dockerfile` | 多阶段构建镜像 |
| `cmd/server/main.go` | 程序入口，组装依赖 + Seed Admin + 启动 HTTP |
| `internal/config/config.go` | 环境变量加载为 Config 结构（含 AdminEmail/AdminPassword） |
| `internal/domain/models.go` | 核心实体：User(含 Role) / Document / DocumentVersion / DocumentShare |
| `internal/domain/errors.go` | Sentinel 错误（NotFound / Forbidden / Unauthorized 等） |
| `internal/repository/db.go` | 数据库连接池初始化（支持 mysql/postgres） |
| `internal/repository/user_repo.go` | 用户表 CRUD + List + UpdatePassword |
| `internal/repository/document_repo.go` | 文档表 CRUD + 可见性 / 权限查询（空数组保障） |
| `internal/repository/version_repo.go` | 版本表 CRUD（空数组保障） |
| `internal/service/auth_service.go` | 登录 + JWT(含role) + SeedAdmin + CreateUser + ListUsers + ResetPassword |
| `internal/service/document_service.go` | 文档创建 / 编辑（事务）/ 列表 / 详情 / 版本列表 |
| `internal/middleware/auth.go` | JWT Bearer 校验 + Role 注入 + RequireAdmin 中间件 |
| `internal/middleware/logger.go` | 请求日志（method / path / status / latency / userId） |
| `internal/handler/response.go` | 统一响应格式 `{ data, error, request_id }` |
| `internal/handler/auth_handler.go` | POST /api/auth/login（注册已禁用，返回 403） |
| `internal/handler/admin_handler.go` | **新增** 管理员用户管理 API handler |
| `internal/handler/document_handler.go` | GET / POST / PUT /api/docs + GET /api/docs/{id}/versions |
| `internal/handler/router.go` | chi 路由注册 + CORS + 中间件编排 + Admin 路由组 |
| `migrations/000001_init.up.sql` | 建表（PostgreSQL）：users / documents / document_versions / document_shares |
| `migrations/000001_init.down.sql` | 回滚：逆序删除所有表和类型 |
| `migrations/000001_init_mysql.up.sql` | 建表（MySQL）：等价 MySQL 语法 |
| `migrations/000002_add_user_role_mysql.up.sql` | **新增** MySQL 增量迁移：users 表加 role 字段 |
| `migrations/000002_add_user_role.up.sql` | **新增** PostgreSQL 增量迁移：users 表加 role 字段 |

### 前端 `/frontend`（19 文件）

| 路径 | 作用 |
|---|---|
| `package.json` | Next.js 14 + Tailwind + Zod 依赖 |
| `tsconfig.json` | TypeScript 严格模式 + 路径别名 `@/*` |
| `next.config.mjs` | API rewrite 代理到 Go 后端 |
| `tailwind.config.ts` | 品牌色 (Indigo) + Inter 字体族 |
| `postcss.config.mjs` | PostCSS 插件配置 |
| `.env.local.example` | 前端环境变量模板 |
| `app/globals.css` | 设计系统基础：card / btn-primary / btn-secondary / input / label |
| `app/layout.tsx` | 根布局：AuthProvider |
| `app/page.tsx` | 首页重定向（已登录→/dashboard，未登录→/login） |
| `app/login/page.tsx` | **改造** 仅保留登录，移除注册入口 |
| `app/(app)/layout.tsx` | AppShell 布局（左侧导航 + 主内容区） |
| `app/(app)/dashboard/page.tsx` | 工作台：统计卡片 + 最近文档（空数据不报错） |
| `app/(app)/docs/page.tsx` | 文档列表页（支持 tab 筛选） |
| `app/(app)/docs/new/page.tsx` | 新建文档页 |
| `app/(app)/docs/[id]/page.tsx` | 文档详情页 |
| `app/(app)/docs/[id]/edit/page.tsx` | 编辑文档页 |
| `app/(app)/admin/users/page.tsx` | **新增** 用户管理页面（仅管理员可见） |
| `app/(app)/settings/page.tsx` | 设置页（占位） |
| `lib/api.ts` | **改造** API 客户端：移除 register，增加 admin API + getCurrentUserRole |
| `lib/auth.tsx` | AuthContext + useAuth + useRequireAuth |
| `components/app-shell.tsx` | **改造** 左侧导航：根据 role 显示「用户管理」菜单 |
| `components/header.tsx` | 全局顶栏（已由 AppShell 替代，保留兼容） |

---

## 二、数据模型 ER 设计

```
┌──────────────┐         ┌──────────────────┐
│   users      │         │   documents      │
├──────────────┤    1:N  ├──────────────────┤
│ id (PK)      │◄────────│ owner_id (FK)    │
│ email (UQ)   │         │ id (PK)          │
│ password_hash│         │ title            │
│ role (ADMIN  │         │ visibility (ENUM)│
│      /USER)  │         │ latest_version_id│──┐
│ created_at   │         │ created_at       │  │
└──────────────┘         │ updated_at       │  │
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
| POST | `/api/auth/login` | 登录，返回 JWT（含 role） | 无 |
| POST | `/api/auth/register` | **已禁用**，返回 403 | 无 |
| GET | `/api/docs` | 文档列表（仅当前用户可见） | Bearer |
| POST | `/api/docs` | 创建文档（含首版本，单事务） | Bearer |
| GET | `/api/docs/{id}` | 文档详情 + 最新内容 | Bearer |
| PUT | `/api/docs/{id}` | 编辑保存（新建版本，单事务） | Bearer |
| GET | `/api/docs/{id}/versions` | 版本历史 | Bearer |
| GET | `/api/admin/users` | **新增** 用户列表（管理员） | Bearer + ADMIN |
| POST | `/api/admin/users` | **新增** 创建用户（管理员） | Bearer + ADMIN |
| POST | `/api/admin/users/{id}/reset_password` | **新增** 重置密码（管理员） | Bearer + ADMIN |
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
- **MySQL 8.0+**（默认）或 **PostgreSQL 14+**（可选）

### 1. 执行数据库迁移（MySQL）

```bash
mysql -u docmv -pdocmv docdb < backend/migrations/000001_init_mysql.up.sql
mysql -u docmv -pdocmv docdb < backend/migrations/000002_add_user_role_mysql.up.sql
```

> PostgreSQL 用户改为执行 `000001_init.up.sql` + `000002_add_user_role.up.sql`

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 按需修改 DB_DRIVER / DB_DSN / JWT_SECRET / ADMIN_EMAIL / ADMIN_PASSWORD
```

**新增环境变量**：

| 变量 | 说明 | 默认值 |
|---|---|---|
| `ADMIN_EMAIL` | 默认管理员邮箱 | `admin@docmv.local` |
| `ADMIN_PASSWORD` | 默认管理员密码 | `admin123` |
| `DB_DRIVER` | 数据库驱动 | `mysql` |
| `DB_DSN` | 数据库连接串 | `docmv:docmv@tcp(127.0.0.1:3306)/docdb?parseTime=true&charset=utf8mb4&loc=Local` |

### 3. 启动后端

```bash
cd backend
go mod tidy             # 下载依赖（首次）
go run ./cmd/server     # 启动于 :8080
# 控制台会输出 "[seed] admin account admin@docmv.local created successfully"
```

### 4. 启动前端

```bash
cd frontend
cp .env.local.example .env.local
npm install             # 安装依赖（首次）
npm run dev             # 启动于 :3000
```

### 5. 打开浏览器

访问 `http://localhost:3000` → 用管理员账号登录 → 进入用户管理创建普通用户。

---

## 六、最小验收清单

| # | 验收点 | 如何验证 |
|---|---|---|
| 1 | 管理员登录 | /login → 用 admin@docmv.local / admin123 登录 → 成功跳转 /dashboard |
| 2 | 注册已禁用 | 登录页无注册入口；POST /api/auth/register 返回 403 |
| 3 | 用户管理（管理员） | 左侧导航可见「用户管理」→ 进入页面 → 用户列表显示 admin |
| 4 | 新建普通用户 | 点击「新建用户」→ 填写邮箱 / 密码 → 创建成功出现在列表 |
| 5 | 重置密码 | 在用户列表点击「重置密码」→ 输入新密码 → 确认成功 |
| 6 | 普通用户登录 | 退出管理员 → 用新建的普通用户登录 → 成功跳转 /dashboard |
| 7 | 普通用户无管理入口 | 普通用户左侧导航不显示「用户管理」；访问 /admin/users 被重定向 |
| 8 | Dashboard 空数据 | /dashboard 在无文档时不报错，显示统计卡片为 0，最近文档为空 |
| 9 | 创建文档 | 点击「新建文档」→ 填写标题 / 内容 / 可见性 → 创建成功跳转详情 |
| 10 | 文档 CRUD | 文档列表 / 详情 / 编辑保存（产生新版本） / 版本列表 → 正常工作 |
| 11 | 权限校验 | 用另一个账户登录 → PRIVATE 文档不出现在列表中 |

---

## 七、技术选型摘要

| 层 | 选型 |
|---|---|
| 后端框架 | Go + chi |
| 数据库访问 | sqlx + go-sql-driver/mysql + lib/pq |
| 数据库 | MySQL 8.0（默认）/ PostgreSQL 16（可选） |
| 鉴权 | JWT (golang-jwt/jwt/v5) 含 role claim |
| 密码 | bcrypt (golang.org/x/crypto) |
| 前端框架 | Next.js 14 App Router + TypeScript |
| 样式 | Tailwind CSS 3 |
| 状态管理 | React Context (AuthProvider) |
| API 通信 | fetch + Next.js rewrite 代理 |
| 账号体系 | 企业内部模式：禁止自注册，管理员创建账号 |

---

## 八、V0.2 变更记录（企业账号体系改造）

### 改动文件清单

**后端 — 修改（10 文件）**

| 文件 | 改动说明 |
|---|---|
| `internal/domain/models.go` | 新增 Role 类型（ADMIN/USER），User 结构体增加 Role 字段 |
| `internal/config/config.go` | 新增 AdminEmail / AdminPassword 配置项 |
| `internal/repository/user_repo.go` | Create 方法增加 role 列；新增 List / UpdatePassword 方法 |
| `internal/repository/document_repo.go` | ListForUser 返回空数组（`make([]T,0)`）而非 nil |
| `internal/repository/version_repo.go` | ListByDocument 返回空数组而非 nil |
| `internal/middleware/auth.go` | JWT 解析后注入 role 到 context；新增 RequireAdmin 中间件 |
| `internal/service/auth_service.go` | 移除 Register；JWT 含 role claim；新增 SeedAdmin / CreateUser / ListUsers / ResetPassword |
| `internal/handler/auth_handler.go` | Register 方法返回 403（自注册已禁用） |
| `internal/handler/router.go` | 移除 register 路由；新增 /api/admin/* 路由组（RequireAdmin） |
| `cmd/server/main.go` | 启动时调用 SeedAdmin 注入默认管理员 |
| `.env.example` | 新增 ADMIN_EMAIL / ADMIN_PASSWORD |

**后端 — 新增（3 文件）**

| 文件 | 说明 |
|---|---|
| `internal/handler/admin_handler.go` | 管理员用户管理 handler（ListUsers / CreateUser / ResetPassword） |
| `migrations/000002_add_user_role_mysql.up.sql` | MySQL 增量迁移：users 表加 role 字段 |
| `migrations/000002_add_user_role.up.sql` | PostgreSQL 增量迁移：users 表加 role 字段 |

**前端 — 修改（3 文件）**

| 文件 | 改动说明 |
|---|---|
| `app/login/page.tsx` | 移除注册表单与切换按钮，仅保留登录 |
| `lib/api.ts` | 移除 register 函数；AuthResult 增加 role；新增 getCurrentUserRole / listUsers / createUser / resetUserPassword |
| `components/app-shell.tsx` | NAV_ITEMS 新增「用户管理」项（requireRole: ADMIN），按 role 过滤可见导航 |

**前端 — 新增（1 文件）**

| 文件 | 说明 |
|---|---|
| `app/(app)/admin/users/page.tsx` | 用户管理页面：用户列表 + 新建用户表单 + 重置密码弹窗 |

---

## 九、V0.2.1 变更记录（修复登录后不跳转）

### 根因

`AuthProvider` 的 `loggedIn` 状态仅在组件 mount 时通过 `useEffect([], [])` 读取一次 `localStorage`。  
登录页调用 `login()` 后虽然将 token 写入了 localStorage，但 AuthContext 的 `loggedIn` 仍为 `false`。  
当 `router.push("/dashboard")` 导航到 dashboard 时，`AppShell` 里的 `useRequireAuth()` 读到 `loggedIn === false`，立即又跳回了 `/login`，形成循环。

### 修复方案

| 文件 | 改动说明 |
|---|---|
| `lib/auth.tsx` | AuthContext 新增 `signIn()` 回调，调用后将 `loggedIn` 同步设为 `true` |
| `app/login/page.tsx` | 登录成功后先调 `signIn()` 再 `router.replace("/dashboard")`；mount 时检测已登录则自动跳转 |

### 验证步骤

| # | 验证点 | 预期 |
|---|---|---|
| 1 | 输入正确账密 → 点击登录 | 自动跳转到 /dashboard |
| 2 | 已登录状态直接访问 /login | 自动重定向到 /dashboard |
| 3 | 退出登录后访问 /dashboard | 自动跳转到 /login |
