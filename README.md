# DocMV - 文档管理系统

轻量级文档管理与版本控制系统，支持文档 CRUD、版本追踪、权限控制和流程节点编辑。

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Go 1.22 + Chi router + sqlx |
| 前端 | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| 数据库 | PostgreSQL 或 MySQL |
| 认证 | JWT (Bearer Token) |

## 项目结构

```
backend/
  cmd/server/         # 程序入口
  internal/
    config/           # 环境变量加载
    domain/           # 实体 & 枚举 & 错误定义
    handler/          # HTTP handler（auth / doc / flow / admin）
    middleware/       # JWT 鉴权 & 请求日志
    repository/       # 数据库读写（含自动建表 migrate.go）
    service/          # 业务逻辑层
  migrations/         # SQL 迁移脚本（参考用）
  Dockerfile

frontend/
  app/
    login/            # 登录页
    (app)/            # 需要鉴权的页面组
      dashboard/      # 工作台
      docs/           # 文档管理
      flows/          # 流程管理
      admin/users/    # 用户管理（仅 ADMIN）
      settings/       # 设置
  components/         # 通用组件（AppShell / FlowDiagram 等）
  lib/
    api.ts            # API 客户端
    auth.tsx          # 认证 Context & Hooks
```

## 快速开始

### 1. 准备数据库

创建一个 PostgreSQL 或 MySQL 数据库：

```sql
-- PostgreSQL
CREATE USER docmv WITH PASSWORD 'docmv';
CREATE DATABASE docdb OWNER docmv;

-- 或 MySQL
CREATE DATABASE docdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'docmv'@'localhost' IDENTIFIED BY 'docmv';
GRANT ALL ON docdb.* TO 'docmv'@'localhost';
```

> 后端启动时会 **自动建表**（`CREATE TABLE IF NOT EXISTS`），无需手动执行迁移脚本。

### 2. 启动后端

```bash
cd backend

# 复制并编辑环境变量
cp .env.example .env
# 编辑 .env，根据你的数据库类型修改 DB_DRIVER 和 DB_DSN

# 安装依赖 & 启动
go mod download
go run ./cmd/server
```

看到以下日志即启动成功：
```
[migrate] running auto-migration …
[migrate] postgres schema up-to-date
[seed] admin account admin@docmv.local created successfully
=== DocMV server starting on :8080 [postgres] ===
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000，会自动跳转到登录页。

### 4. 登录

| 字段 | 值 |
|------|-----|
| 邮箱 | `admin@docmv.local` |
| 密码 | `admin123` |

> 管理员账号在后端首次启动时自动创建（seed），可通过 `.env` 中的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 修改。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_DRIVER` | `mysql` | 数据库类型：`mysql` 或 `postgres` |
| `DB_DSN` | *(见 .env.example)* | 数据库连接字符串 |
| `JWT_SECRET` | `dev-secret-change-me` | JWT 签名密钥，生产环境务必修改 |
| `SERVER_PORT` | `8080` | 后端监听端口 |
| `ADMIN_EMAIL` | `admin@docmv.local` | 初始管理员邮箱 |
| `ADMIN_PASSWORD` | `admin123` | 初始管理员密码 |

## API 概览

所有接口统一响应格式：`{ data, error: { code, message, fields? }, request_id }`

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT |

### 需要认证（Bearer Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/docs` | 文档列表（当前用户可见） |
| POST | `/api/docs` | 创建文档 |
| GET | `/api/docs/:id` | 文档详情 + 最新内容 |
| PUT | `/api/docs/:id` | 更新文档（产生新版本） |
| GET | `/api/docs/:id/versions` | 版本历史 |
| GET | `/api/docs/:id/nodes` | 流程节点列表 |
| POST | `/api/docs/:id/nodes` | 创建流程节点 |
| GET | `/api/nodes/:nodeId` | 获取单个节点 |
| PUT | `/api/nodes/:nodeId` | 更新节点 |

### 管理员接口（需要 ADMIN 角色）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 用户列表 |
| POST | `/api/admin/users` | 创建用户 |
| POST | `/api/admin/users/:id/reset_password` | 重置密码 |

## 数据模型

```
users
  ├── id (UUID)
  ├── email (唯一)
  ├── password_hash (bcrypt)
  ├── role (ADMIN / USER)
  └── created_at

documents
  ├── id (UUID)
  ├── owner_id → users.id
  ├── title
  ├── visibility (PRIVATE / PUBLIC / SHARED)
  ├── latest_version_id → document_versions.id
  ├── created_at
  └── updated_at

document_versions（不可变日志）
  ├── id (UUID)
  ├── document_id → documents.id
  ├── content (TEXT)
  ├── created_by → users.id
  └── created_at

document_shares
  ├── document_id → documents.id
  ├── user_id → users.id
  └── role (VIEW / EDIT)

workflow_nodes
  ├── id (UUID)
  ├── document_id → documents.id
  ├── name / exec_form / description
  ├── preconditions / outputs
  ├── duration_min / duration_max / duration_unit
  ├── raci_json / subtasks_json / diagram_json
  ├── created_at
  └── updated_at
```

## Docker 部署

```bash
cd backend
docker build -t docmv-backend .
docker run -d --name docmv \
  -e DB_DRIVER=postgres \
  -e DB_DSN="host=db port=5432 user=docmv password=docmv dbname=docdb sslmode=disable" \
  -e JWT_SECRET=your-production-secret \
  -p 8080:8080 \
  docmv-backend
```

## 许可

内部项目，仅限授权使用。
