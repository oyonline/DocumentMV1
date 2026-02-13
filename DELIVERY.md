# 交付清单 — DocMV 流程管理系统 V1

## 一、改动文件清单

### 新增文件

| 文件路径 | 说明 |
|---|---|
| `backend/migrations/000003_replace_doc_with_flow_mysql.up.sql` | MySQL 迁移：DROP document 表，CREATE flows/flow_nodes/flow_versions/flow_shares |
| `backend/migrations/000003_replace_doc_with_flow.up.sql` | PostgreSQL 版本迁移 |
| `backend/internal/repository/flow_repo.go` | Flow 仓库层：CRUD/权限判断/编号生成 |
| `backend/internal/repository/flow_node_repo.go` | FlowNode 仓库层：列表/全量替换 |
| `backend/internal/repository/flow_version_repo.go` | FlowVersion 仓库层：创建/列表/详情 |
| `backend/internal/service/flow_service.go` | Flow 业务层：创建/详情/更新/提交评审/发布/版本 |
| `backend/internal/handler/flow_handler.go` | Flow HTTP Handler：所有 /api/flows 端点 |
| `frontend/components/flow-diagram.tsx` | 基于 reactflow 的流程图组件 |
| `frontend/components/node-detail-panel.tsx` | 节点详情面板组件 |
| `frontend/components/flow-overview-card.tsx` | 流程概览卡片组件 |
| `frontend/app/(app)/flows/page.tsx` | 流程列表页（支持 tab 筛选） |
| `frontend/app/(app)/flows/new/page.tsx` | 新建流程页 |
| `frontend/app/(app)/flows/[id]/page.tsx` | 流程详情页（图+节点面板联动） |
| `frontend/app/(app)/flows/[id]/edit/page.tsx` | 编辑流程页（仅 DRAFT） |
| `frontend/app/(app)/flows/[id]/versions/[versionId]/page.tsx` | 历史版本只读查看页 |
| `scripts/migrate_mysql.sh` | 一键 MySQL 迁移脚本（含确认提示 + 表存在验证） |
| `scripts/smoke_test.sh` | API 冒烟测试脚本（curl 全流程验证） |

### 修改文件

| 文件路径 | 说明 |
|---|---|
| `backend/internal/domain/models.go` | 删除 Document 类型，新增 Flow/FlowNode/FlowVersion/FlowShare/FlowStatus/ExecForm |
| `backend/internal/handler/router.go` | `/api/docs` → `/api/flows`，新增 submit_review/publish 路由 |
| `backend/internal/handler/response.go` | 新增 parseUUID 工具函数 |
| `backend/cmd/server/main.go` | wire FlowService 替代 DocumentService |
| `frontend/lib/api.ts` | 删除 Document 类型/函数，新增 Flow 相关类型和 API 函数 |
| `frontend/components/app-shell.tsx` | 导航改为"流程库/我的流程/新建流程" |
| `frontend/app/(app)/dashboard/page.tsx` | 改为流程数据统计和列表 |

### 删除文件

| 文件路径 | 说明 |
|---|---|
| `backend/internal/repository/document_repo.go` | 被 flow_repo.go 替代 |
| `backend/internal/repository/version_repo.go` | 被 flow_version_repo.go 替代 |
| `backend/internal/service/document_service.go` | 被 flow_service.go 替代 |
| `backend/internal/handler/document_handler.go` | 被 flow_handler.go 替代 |
| `frontend/app/(app)/docs/` | 整个目录被 flows/ 替代 |

---

## 二、数据模型

### 表结构

- **flows**：id, flow_no(UK), title, owner_id, owner_dept_id, overview, status(DRAFT/IN_REVIEW/EFFECTIVE), diagram_json, latest_version_id, created_at, updated_at
- **flow_nodes**：id, flow_id(FK), node_no, name, intro, raci_json, exec_form, duration_min, duration_max, duration_unit, prereq_text, outputs_text, subtasks_json, sort_order
- **flow_versions**：id, flow_id(FK), snapshot_json, created_by(FK), created_at
- **flow_shares**：id, flow_id(FK), user_id(FK), role(VIEW/EDIT), created_at, UK(flow_id, user_id)

### 状态流转

```
DRAFT → IN_REVIEW → EFFECTIVE
                       ↓
                  (创建新草稿)
```

### flow_no 编号

格式 `FLOW-YYYY-NNNN`，后端 Create 时自动生成。

---

## 三、API 路由

| 方法 | 路由 | 说明 |
|---|---|---|
| GET | /api/flows | 获取当前用户可见的流程列表 |
| POST | /api/flows | 创建草稿流程 |
| GET | /api/flows/{id} | 获取流程详情（含 nodes + 计算时长） |
| PUT | /api/flows/{id} | 更新草稿（概览/流程图/节点） |
| POST | /api/flows/{id}/submit_review | 提交评审（DRAFT→IN_REVIEW） |
| POST | /api/flows/{id}/publish | 发布生效（IN_REVIEW→EFFECTIVE + 创建快照） |
| GET | /api/flows/{id}/versions | 获取版本列表（不含快照内容） |
| GET | /api/flows/{id}/versions/{versionId} | 获取版本详情（含完整快照） |

---

## 四、环境变量

`.env.example` 保持不变（无新增环境变量）：
```
DB_DRIVER=mysql
DB_DSN=docmv:docmv@tcp(127.0.0.1:3306)/docdb?parseTime=true&charset=utf8mb4&loc=Local
JWT_SECRET=dev-secret-change-me
SERVER_PORT=8080
ADMIN_EMAIL=admin@docmv.local
ADMIN_PASSWORD=admin123
```

---

## 五、本地验证步骤

### 1. 执行数据库迁移

```bash
# MySQL
mysql -u docmv -p docdb < backend/migrations/000003_replace_doc_with_flow_mysql.up.sql

# PostgreSQL (如需)
psql -U docmv -d docdb -f backend/migrations/000003_replace_doc_with_flow.up.sql
```

### 2. 启动后端

```bash
cd backend
export PATH="/opt/homebrew/bin:$PATH"
go run cmd/server/main.go
# 期望输出：=== DocMV server starting on :8080 [mysql] ===
```

### 3. 启动前端

```bash
cd frontend
npm run dev
# 访问 http://localhost:3000
```

### 4. 验证流程

1. **登录** → 用管理员账号 admin@docmv.local / admin123 登录
2. **工作台** → 显示"流程概览"（空数据不报错，三个统计卡片显示 0）
3. **新建流程** → 点击侧边栏"新建流程"或工作台快捷入口
   - 填写标题/部门/概述 → 点击"创建草稿"
4. **流程详情** → 看到概览卡 + 空流程图 + 节点面板提示"请选择节点查看说明"
5. **编辑流程** → 点击"编辑流程"
   - 修改概览信息
   - 添加节点（填写编号/名称/耗时范围/RACI/子任务等）
   - 在"流程图 JSON"区域粘贴 diagram JSON，例如：
   ```json
   {"nodes":[{"id":"n1","label":"开始","x":100,"y":100},{"id":"n2","label":"审批","x":300,"y":100},{"id":"n3","label":"结束","x":500,"y":100}],"edges":[{"id":"e1","source":"n1","target":"n2","type":"SEQ"},{"id":"e2","source":"n2","target":"n3","type":"COND","label":"通过"}]}
   ```
   - 保存
6. **查看流程图** → 返回详情页，看到流程图渲染、点击节点可联动右侧面板
7. **提交评审** → 点击"提交评审"，状态变为 IN_REVIEW，编辑按钮消失
8. **发布生效** → 点击"发布生效"，状态变为 EFFECTIVE，版本列表出现 1 条
9. **查看历史版本** → 展开版本历史 → 点击进入 → 查看只读快照
10. **流程列表** → 侧边栏"流程库"显示所有流程
11. **导航** → "我的流程"/"共享给我" tab 筛选正常
12. **普通用户** → 登录普通用户 → 能查看流程但无编辑按钮

### 5. 不受影响的功能

- 登录/退出 ✓
- 用户管理（管理员） ✓
- 设置页面 ✓
- 鉴权保护（未登录跳 /login） ✓

---

## 六、一键迁移与冒烟测试

### 一键 MySQL 迁移

```bash
bash scripts/migrate_mysql.sh
```

脚本行为：
1. 读取 `backend/.env` 中的 `DB_DSN` 解析连接信息
2. 列出将要执行的迁移文件，**提示用户这是破坏性迁移（DROP 旧 document 表）**
3. 需要输入 `YES` 才会继续
4. 按顺序执行 `000001` → `000002` → `000003` 迁移
5. 执行后自动检查 `flows / flow_nodes / flow_versions / flow_shares / users` 表是否存在
6. 任何一步失败立即退出

### 冒烟测试

```bash
# 确保后端已启动（go run cmd/server/main.go）
bash scripts/smoke_test.sh
```

脚本行为：
1. 读取 `backend/.env` 中的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`
2. 依次调用：
   - `GET /health` — 连通性
   - `POST /api/auth/login` — 登录获取 token
   - `GET /api/flows` — 流程列表（检查 data 是数组 `[]`）
   - `POST /api/flows` — 创建草稿（最小 payload）
   - `GET /api/flows/:id` — 流程详情（检查 nodes 是数组）
   - `POST /api/flows/:id/submit_review` — 提交评审
   - `POST /api/flows/:id/publish` — 发布生效
   - `GET /api/flows/:id/versions` — 版本列表
3. 每一步打印 HTTP 状态码，失败则打印响应前 200 字符并 `exit 1`
4. 最后输出通过/失败汇总

可选环境变量覆盖：
```bash
BASE_URL=http://localhost:9090 bash scripts/smoke_test.sh
```

---

## 七、常见问题排查

### 1. `Unexpected non-whitespace character after JSON at position 4`

**症状**：前端页面报 JSON 解析错误。

**原因**：后端某个接口返回了非 JSON 内容（或响应体前面有多余字符，如 `null{...}`）。

**排查步骤**：
1. 打开浏览器 Network 面板，找到报错的请求
2. 查看 Response 原始内容（前 50 字符）和 Content-Type
3. 如果 Content-Type 不是 `application/json` 或响应以非 `{`/`[` 开头，说明后端有问题
4. 检查 Go handler 是否有 `http.Error()`（返回 `text/plain`）、`fmt.Fprint()` 或 panic 导致响应被污染
5. 确认 handler 统一使用 `respondOK()` / `respondError()` / `respondCreated()` 返回

**前端兜底**：`lib/api.ts` 的 `request()` 函数已改为先 `res.text()` 再 `try JSON.parse()`，解析失败时会在控制台打印完整诊断（HTTP 方法、路径、状态码、Content-Type、响应前 200 字符）。

### 2. `data` 字段返回 `null` 而非 `[]`

**症状**：前端 `.filter()` 报 `TypeError: Cannot read properties of null`。

**原因**：Go 的 `json.Marshal(nil slice)` 会输出 `null`。

**修复**：所有 repo 的 list 方法使用 `make([]T, 0)` 初始化切片，确保序列化为 `[]`。前端用 `Array.isArray(data) ? data : []` 兜底。

### 3. 迁移脚本报错"mysql: command not found"

确保 MySQL 客户端在 PATH 中：
```bash
export PATH="/opt/homebrew/bin:$PATH"  # macOS Homebrew
# 或
export PATH="/usr/local/mysql/bin:$PATH"
```

### 4. 后端启动报 `failed to connect to database`

检查 `backend/.env` 中的 `DB_DSN` 是否正确，MySQL 是否在运行：
```bash
mysql -u docmv -p -h 127.0.0.1 -P 3306 -e "SELECT 1"
```

---

## 八、技术要点

1. **reactflow** 用于渲染交互式流程图，支持 SEQ/COND/PARALLEL 三种连线类型
2. **快照版本**：发布时将 flow + nodes + diagram + computed 打成 JSON 快照存储
3. **flow_no 自动编号**：FLOW-YYYY-NNNN 格式，查询当前年份最大值 +1
4. **时长汇总**：V1 口径为所有节点耗时求和（HOUR 按 8 小时工作日转天）
5. **权限**：owner 或 EDIT share 可编辑；owner 或任意 share 可查看
6. **状态机**：DRAFT → IN_REVIEW → EFFECTIVE，仅 DRAFT 可编辑
