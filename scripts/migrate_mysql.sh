#!/usr/bin/env bash
# ============================================================
# migrate_mysql.sh — 一键执行 MySQL 迁移（破坏性：DROP 旧 document 表）
# 用法：bash scripts/migrate_mysql.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/backend/.env"
MIGRATION_DIR="$PROJECT_ROOT/backend/migrations"

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------- 1. 加载 .env ----------
if [[ ! -f "$ENV_FILE" ]]; then
  error "找不到 $ENV_FILE，请先从 .env.example 复制并配置"
  exit 1
fi

# 安全读取 .env（不用 source，避免括号等特殊字符被 bash 解析）
read_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d'=' -f2-
}

DB_DRIVER="$(read_env DB_DRIVER)"
DSN="$(read_env DB_DSN)"
JWT_SECRET="$(read_env JWT_SECRET)"

if [[ "${DB_DRIVER}" != "mysql" ]]; then
  error "当前 DB_DRIVER=${DB_DRIVER:-未设置}，此脚本仅支持 mysql"
  exit 1
fi

if [[ -z "$DSN" ]]; then
  error "DB_DSN 未设置"
  exit 1
fi

# ---------- 2. 解析 DSN ----------
# 格式: user:password@tcp(host:port)/dbname?params
DB_USER=$(echo "$DSN" | sed -E 's/^([^:]+):.*$/\1/')
DB_PASS=$(echo "$DSN" | sed -E 's/^[^:]+:([^@]+)@.*$/\1/')
DB_HOST=$(echo "$DSN" | sed -E 's/.*tcp\(([^:]+):.*$/\1/')
DB_PORT=$(echo "$DSN" | sed -E 's/.*tcp\([^:]+:([0-9]+)\).*$/\1/')
DB_NAME=$(echo "$DSN" | sed -E 's/.*\)\/([^?]+).*$/\1/')

info "数据库连接信息："
echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo ""

# ---------- 3. 确认迁移（列出要执行的文件） ----------
MIGRATIONS=()

# 按编号顺序收集所有 mysql 迁移文件
for f in "$MIGRATION_DIR"/000001_init_mysql.up.sql \
         "$MIGRATION_DIR"/000002_add_user_role_mysql.up.sql \
         "$MIGRATION_DIR"/000003_replace_doc_with_flow_mysql.up.sql; do
  if [[ -f "$f" ]]; then
    MIGRATIONS+=("$f")
  fi
done

if [[ ${#MIGRATIONS[@]} -eq 0 ]]; then
  error "未找到任何 MySQL 迁移文件"
  exit 1
fi

warn "⚠️  将要执行以下迁移文件（包含破坏性操作：DROP 旧表）："
for f in "${MIGRATIONS[@]}"; do
  echo "  → $(basename "$f")"
done
echo ""
warn "数据库 $DB_NAME 中的 documents/document_versions/document_shares 表将被删除！"
echo ""

read -rp "确认执行？输入 YES 继续: " CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
  info "已取消"
  exit 0
fi

# ---------- 4. 执行迁移 ----------
MYSQL_CMD=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME")

for f in "${MIGRATIONS[@]}"; do
  info "执行 $(basename "$f") ..."
  if "${MYSQL_CMD[@]}" < "$f" 2>&1; then
    info "  ✓ $(basename "$f") 完成"
  else
    error "  ✗ $(basename "$f") 失败"
    exit 1
  fi
done

# ---------- 5. 验证表存在 ----------
info "验证新表是否存在..."

EXPECTED_TABLES=("flows" "flow_nodes" "flow_versions" "flow_shares" "users")
MISSING=()

for t in "${EXPECTED_TABLES[@]}"; do
  COUNT=$("${MYSQL_CMD[@]}" -N -e "
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = '$DB_NAME' AND table_name = '$t';" 2>/dev/null || echo "0")
  if [[ "$COUNT" -ge 1 ]]; then
    info "  ✓ $t"
  else
    error "  ✗ $t 不存在"
    MISSING+=("$t")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  error "以下表缺失: ${MISSING[*]}"
  exit 1
fi

echo ""
info "🎉 迁移完成，所有表已就绪！"
info "下一步：cd backend && go run cmd/server/main.go"
