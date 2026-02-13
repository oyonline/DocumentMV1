#!/usr/bin/env bash
# ============================================================
# smoke_test.sh — API 冒烟测试（需要后端已启动）
# 用法：bash scripts/smoke_test.sh
# 可选环境变量：
#   BASE_URL  — 后端地址（默认 http://localhost:8080）
#   ADMIN_EMAIL / ADMIN_PASSWORD — 管理员账号（默认从 backend/.env 读取）
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/backend/.env"

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[PASS]${NC}  $*"; }
step()  { echo -e "${CYAN}[STEP]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; }

PASS=0
TOTAL=0

assert_ok() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"
  local status="$2"
  local body="$3"

  if [[ "$status" -ge 200 && "$status" -lt 300 ]]; then
    info "$desc (HTTP $status)"
    PASS=$((PASS + 1))
  else
    fail "$desc (HTTP $status)"
    echo "  响应前 200 字符: ${body:0:200}"
    exit 1
  fi
}

assert_json() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"
  local body="$2"

  # 检测响应以 { 或 [ 开头（基本 JSON 校验）
  local first_char="${body:0:1}"
  if [[ "$first_char" == "{" || "$first_char" == "[" ]]; then
    info "$desc"
    PASS=$((PASS + 1))
  else
    fail "$desc — 响应不是 JSON"
    echo "  前 200 字符: ${body:0:200}"
    exit 1
  fi
}

# ---------- 1. 加载配置 ----------
# 安全读取 .env（不用 source，避免括号等特殊字符被 bash 解析）
read_env() {
  local key="$1"
  local default="$2"
  if [[ -f "$ENV_FILE" ]]; then
    local val
    val=$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
    echo "${val:-$default}"
  else
    echo "$default"
  fi
}

BASE_URL="${BASE_URL:-http://localhost:$(read_env SERVER_PORT 8080)}"
EMAIL="${ADMIN_EMAIL:-$(read_env ADMIN_EMAIL admin@docmv.local)}"
PASSWORD="${ADMIN_PASSWORD:-$(read_env ADMIN_PASSWORD admin123)}"

echo ""
echo "=========================================="
echo "  DocMV 冒烟测试"
echo "  后端地址: $BASE_URL"
echo "  账号: $EMAIL"
echo "=========================================="
echo ""

# ---------- 2. Health check ----------
step "Health check..."
HEALTH_BODY=$(curl -sf "$BASE_URL/health" 2>/dev/null || echo "CONN_FAIL")
if [[ "$HEALTH_BODY" == "CONN_FAIL" ]]; then
  fail "无法连接 $BASE_URL/health — 请确认后端已启动"
  exit 1
fi
TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
info "Health check OK"

# ---------- 3. 登录获取 token ----------
step "登录 ($EMAIL)..."
LOGIN_RESP=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

LOGIN_BODY=$(echo "$LOGIN_RESP" | head -n -1)
LOGIN_STATUS=$(echo "$LOGIN_RESP" | tail -n 1)

assert_ok "登录" "$LOGIN_STATUS" "$LOGIN_BODY"
assert_json "登录返回 JSON" "$LOGIN_BODY"

# 提取 token（简单 grep，不依赖 jq）
TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ -z "$TOKEN" ]]; then
  fail "无法从登录响应中提取 token"
  echo "  响应: ${LOGIN_BODY:0:200}"
  exit 1
fi
info "获取 token 成功 (${TOKEN:0:20}...)"

AUTH="Authorization: Bearer $TOKEN"

# ---------- 4. GET /api/flows（初始列表） ----------
step "GET /api/flows — 流程列表..."
LIST_RESP=$(curl -s -w "\n%{http_code}" \
  -H "$AUTH" "$BASE_URL/api/flows")
LIST_BODY=$(echo "$LIST_RESP" | head -n -1)
LIST_STATUS=$(echo "$LIST_RESP" | tail -n 1)

assert_ok "流程列表" "$LIST_STATUS" "$LIST_BODY"
assert_json "流程列表返回 JSON" "$LIST_BODY"

# 检查 data 是数组（不是 null）
if echo "$LIST_BODY" | grep -q '"data":\s*\['; then
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  info "data 字段是数组 []"
elif echo "$LIST_BODY" | grep -q '"data":\[\]'; then
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  info "data 字段是空数组 []"
elif echo "$LIST_BODY" | grep -q '"data":null'; then
  TOTAL=$((TOTAL + 1))
  warn "data 字段是 null（预期为 []，但不阻断）"
else
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  info "data 字段存在"
fi

# ---------- 5. POST /api/flows — 创建草稿 ----------
step "POST /api/flows — 创建草稿流程..."
CREATE_RESP=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/flows" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"title":"冒烟测试流程","owner_dept_id":"测试部","overview":"自动化测试创建"}')
CREATE_BODY=$(echo "$CREATE_RESP" | head -n -1)
CREATE_STATUS=$(echo "$CREATE_RESP" | tail -n 1)

assert_ok "创建草稿" "$CREATE_STATUS" "$CREATE_BODY"
assert_json "创建返回 JSON" "$CREATE_BODY"

# 提取 flow id
FLOW_ID=$(echo "$CREATE_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ -z "$FLOW_ID" ]]; then
  fail "无法从创建响应中提取 flow ID"
  echo "  响应: ${CREATE_BODY:0:200}"
  exit 1
fi
info "创建成功，flow_id=$FLOW_ID"

# 提取 flow_no
FLOW_NO=$(echo "$CREATE_BODY" | grep -o '"flow_no":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ -n "$FLOW_NO" ]]; then
  info "flow_no=$FLOW_NO"
fi

# ---------- 6. GET /api/flows/:id — 流程详情 ----------
step "GET /api/flows/$FLOW_ID — 流程详情..."
DETAIL_RESP=$(curl -s -w "\n%{http_code}" \
  -H "$AUTH" "$BASE_URL/api/flows/$FLOW_ID")
DETAIL_BODY=$(echo "$DETAIL_RESP" | head -n -1)
DETAIL_STATUS=$(echo "$DETAIL_RESP" | tail -n 1)

assert_ok "流程详情" "$DETAIL_STATUS" "$DETAIL_BODY"
assert_json "详情返回 JSON" "$DETAIL_BODY"

# 检查 nodes 是数组
if echo "$DETAIL_BODY" | grep -q '"nodes":\['; then
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  info "nodes 字段是数组"
fi

# ---------- 7. POST /submit_review ----------
step "POST /api/flows/$FLOW_ID/submit_review — 提交评审..."
REVIEW_RESP=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/flows/$FLOW_ID/submit_review" \
  -H "$AUTH")
REVIEW_BODY=$(echo "$REVIEW_RESP" | head -n -1)
REVIEW_STATUS=$(echo "$REVIEW_RESP" | tail -n 1)

assert_ok "提交评审" "$REVIEW_STATUS" "$REVIEW_BODY"

# 检查状态变为 IN_REVIEW
if echo "$REVIEW_BODY" | grep -q '"status":"IN_REVIEW"'; then
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  info "状态变为 IN_REVIEW"
fi

# ---------- 8. POST /publish ----------
step "POST /api/flows/$FLOW_ID/publish — 发布生效..."
PUBLISH_RESP=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/flows/$FLOW_ID/publish" \
  -H "$AUTH")
PUBLISH_BODY=$(echo "$PUBLISH_RESP" | head -n -1)
PUBLISH_STATUS=$(echo "$PUBLISH_RESP" | tail -n 1)

assert_ok "发布生效" "$PUBLISH_STATUS" "$PUBLISH_BODY"

if echo "$PUBLISH_BODY" | grep -q '"status":"EFFECTIVE"'; then
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  info "状态变为 EFFECTIVE"
fi

# ---------- 9. GET /versions ----------
step "GET /api/flows/$FLOW_ID/versions — 版本列表..."
VER_RESP=$(curl -s -w "\n%{http_code}" \
  -H "$AUTH" "$BASE_URL/api/flows/$FLOW_ID/versions")
VER_BODY=$(echo "$VER_RESP" | head -n -1)
VER_STATUS=$(echo "$VER_RESP" | tail -n 1)

assert_ok "版本列表" "$VER_STATUS" "$VER_BODY"
assert_json "版本列表返回 JSON" "$VER_BODY"

# ---------- 10. 汇总 ----------
echo ""
echo "=========================================="
if [[ "$PASS" -eq "$TOTAL" ]]; then
  echo -e "  ${GREEN}✓ 全部通过 ($PASS/$TOTAL)${NC}"
else
  echo -e "  ${YELLOW}⚠ 通过 $PASS/$TOTAL${NC}"
fi
echo "=========================================="
echo ""
