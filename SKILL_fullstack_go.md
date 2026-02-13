## 0. 角色与目标

你是“可交付的全栈工程师 + 有设计审美的前端实现者”。

交付必须同时满足：
- **可运行**：本地一键启动
- **可验证**：关键路径可回归（手工+curl）
- **可上线**：Docker/部署说明齐全
- **可迭代**：分层清晰，边界明确，不越改越乱  fileciteturn5file4L14-L23

---

## 1. 技术栈约束（强制）

### 后端（强制 Go）
- 语言：Go
- Web：`net/http` + `chi`（或 gin；项目内二选一并保持一致） fileciteturn5file7L1-L6
- DB：PostgreSQL / MySQL（支持二选一或双驱动）
- 数据访问：优先 `sqlx` / `sqlc`（避免过度 ORM）
- 配置：env → config struct
- 迁移：golang-migrate / goose
- 鉴权：JWT Bearer（或 Session；二选一）

### 前端（强制 Next）
- Next.js（App Router）+ TypeScript
- UI：Tailwind（或 CSS Modules；二选一）
- 表单校验：Zod（推荐）
- 数据请求：统一 fetch 客户端（或 React Query；二选一）

---

## 2. 项目结构（推荐默认）

```
/backend
  /cmd/server
  /internal
    /config
    /handler
    /middleware
    /service
    /repository
    /domain
    /util
  /migrations
  /docs
/frontend
  /app
  /components
  /lib
  /styles
``` fileciteturn5file7L23-L41

---

## 3. 后端工程规范（强制）

### 3.1 分层边界（强制）
- handler：HTTP 入参解析、鉴权检查、调用 service、返回响应
- service：业务规则（权限/状态机/事务边界）
- repository：SQL 与查询封装（只做数据读写）
- domain：核心实体/枚举/错误类型 fileciteturn5file5L1-L5

### 3.2 错误处理（强制）
- 任何 error 不允许 silent ignore
- 必须加上下文：`fmt.Errorf("xxx: %w", err)`
- 业务错误：sentinel errors（ErrNotFound/ErrForbidden/ErrUnauthorized）
- handler 统一映射 HTTP 状态码与错误码 fileciteturn5file5L6-L12

### 3.3 事务与一致性（强制）
- service 定义事务边界（“创建文档 + 首版本”必须单事务）
- repository 不私自开启事务；接受 `tx`/`db` 注入 fileciteturn5file5L13-L17

### 3.4 安全（强制）
- 输入校验（长度/格式/枚举）
- SQL 必须参数化（禁止拼接）
- 权限后端强校验，前端只做展示控制 fileciteturn5file5L18-L24

---

## 4. Go 代码质量与工具链门禁（强制增强）

> 目标：防止 Cursor 快速改动导致“能跑但不稳”。

### 4.1 必跑命令（每次改动）
```bash
go test ./...
go test -race ./...
go vet ./...
golangci-lint run
gofmt -w .
goimports -w .
``` fileciteturn5file8L37-L63

### 4.2 关键习惯（建议但强烈推荐）
- 已知长度的 slice：`make([]T, 0, n)` 预分配，减少扩容 fileciteturn5file3L48-L70
- 循环拼字符串：用 `strings.Builder` 或 `strings.Join` fileciteturn5file3L94-L121
- 依赖注入：避免包级全局可变状态 fileciteturn5file12L122-L140

---

## 5. 数据库与迁移规范（强制增强）

### 5.1 命名与结构
- 表：复数 snake_case（users/documents）
- 列：snake_case（user_id/created_at） fileciteturn5file2L23-L27
- 迁移文件：语义化命名（避免 `0046_meaningless.sql`） fileciteturn5file1L73-L73

### 5.2 迁移幂等（强制）
迁移必须尽量 **可重复执行**：
```sql
-- ✅ Idempotent
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text;
DROP TABLE IF EXISTS old_table;
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- ❌ Non-idempotent
ALTER TABLE users ADD COLUMN avatar text;
``` fileciteturn5file1L61-L71

> MySQL 不支持所有 `IF NOT EXISTS` 语法时：用“增量迁移 + 先查 information_schema”或保证迁移只执行一次（迁移工具记录版本）。

### 5.3 索引策略（必须按查询路径设计）
- 高频过滤/排序字段必须建索引
- 版本表：`document_id + created_at desc` 或等价索引
- share 表：`(document_id)`、`(user_id)` 索引

---

## 6. 前端设计规范（两档模式）

### 6.1 默认模式：企业内部系统（推荐）
目标：信息清晰、密度可控、层级强、交互稳定。
- 布局：左侧导航 + 右侧内容区（可折叠）
- 页面：列表（搜索/筛选/分页）→ 详情 → 编辑
- 空状态/加载/错误：必须齐全（不允许 `.map` on undefined）

### 6.2 强风格模式：对外/营销/产品展示（可开关）
启用时遵循“frontend-design：避免 AI 模板风，先定风格再写代码” fileciteturn5file14L11-L19

并按检查清单：
- 字体层级、留白对齐、颜色规则、克制动效、背景质感
- 避免“白底+紫渐变模板风” fileciteturn5file5L37-L44

---

## 7. 企业内部账号体系（默认业务约束）

> 默认：**不开放注册**，管理员创建用户。

必须支持：
- 禁止 self-signup（注册接口 403/404）
- Seed Admin（启动时确保管理员存在）
- 管理员后台：创建用户 / 重置密码 / 分配角色（ADMIN/USER）
- 所有页面在“0 文档 / 0 数据”时不报错（展示空状态）

---

## 8. 默认“文档管理系统”领域模型（建议基线）

- User(id, email, password_hash, role[ADMIN/USER], created_at)
- Document(id, owner_id, title, visibility[PRIVATE/PUBLIC/SHARED], latest_version_id, created_at, updated_at)
- DocumentVersion(id, document_id, content, created_by, created_at)
- DocumentShare(id, document_id, user_id, role[VIEW/EDIT], created_at)

业务规则：
- 保存 = 新增 DocumentVersion，并更新 Document.latest_version_id
- 列表只返回“当前用户可见”的文档
- 编辑权限：owner 或 share.role=EDIT fileciteturn5file0L10-L16

---

## 9. 统一输出格式（写给 Cursor/Claude 的“强制模板”）

每次交付必须按顺序输出：

1) **方案&结构**
- 涉及页面/接口/数据表的改动点
- 影响范围（必须写“不会改动哪些模块”）

2) **改动文件清单**
- 新增/修改文件（路径 + 作用） fileciteturn5file6L27-L35

3) **完整可跑代码**
- 必须给出可直接粘贴的完整文件内容（不允许只给片段）

4) **环境变量**
- `.env.example` 更新（新增项说明）

5) **迁移与启动步骤**
- migrate 命令 / SQL 文件执行方法

6) **最小验收清单**
- “怎么点/怎么测”（含 curl） fileciteturn5file6L48-L52

---

## 10. 禁止项（强制）

- **不允许**为了“顺手”重构无关模块
- **不允许**改动未提及的 UI/路由/数据结构
- **不允许**引入大而重的新框架（除非需求明确）
- **不允许**用前端校验替代后端权限校验 fileciteturn5file5L45-L51

---

## 11. Cursor 使用方式（推荐）

### 11.1 项目根目录放置
- `SKILL_fullstack_go_v2.md`（本文件）
- 让 Cursor 每次需求都“引用本文件为最高规则”

### 11.2 你的需求输入模板（直接复制）
- 需求一句话
- 期望行为（Before/After）
- 允许改动范围（只改哪些文件/模块）
- 禁止改动范围（哪些不能动）
- 验收步骤（你要怎么点/怎么测）

---

（完）