/**
 * API client for the DocMV backend.
 * All requests go through Next.js rewrite -> Go backend.
 */

const BASE = "/api";

// ---------- Types ----------

export interface APIResponse<T> {
  data?: T;
  error?: { code: string; message: string; fields?: Record<string, string> };
  request_id: string;
}

export interface AuthResult {
  token: string;
  user: { id: string; email: string; role: string; created_at: string };
}

// ---------- Flow types ----------

export type FlowStatus = "DRAFT" | "IN_REVIEW" | "EFFECTIVE";

export interface Flow {
  id: string;
  flow_no: string;
  title: string;
  owner_id: string;
  owner_dept_id: string;
  overview: string;
  status: FlowStatus;
  diagram_json: string;
  latest_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  flow_id: string;
  node_no: string;
  name: string;
  intro: string;
  raci_json: string;
  exec_form: string;
  duration_min: number | null;
  duration_max: number | null;
  duration_unit: string;
  prereq_text: string;
  outputs_text: string;
  subtasks_json: string;
  sort_order: number;
}

export interface FlowDetail {
  flow: Flow;
  nodes: FlowNode[];
  total_duration_min_days: number;
  total_duration_max_days: number;
}

export interface FlowVersion {
  id: string;
  flow_id: string;
  snapshot_json: string;
  created_by: string;
  created_at: string;
}

export interface UserInfo {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

// ---------- Helpers ----------

export class APIError extends Error {
  code: string;
  fields?: Record<string, string>;
  requestId?: string;

  constructor(code: string, message: string, fields?: Record<string, string>, requestId?: string) {
    super(message);
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
    this.name = "APIError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  // Use text() + JSON.parse() instead of json() for better diagnostics
  const raw = await res.text();

  let body: APIResponse<T>;
  try {
    body = JSON.parse(raw);
  } catch {
    // Log full diagnostics so we can identify the offending endpoint
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[api] JSON parse failed: ${options.method || "GET"} ${path}`,
        `| status=${res.status}`,
        `| content-type=${res.headers.get("content-type")}`,
        `| body(0..200)=${raw.slice(0, 200)}`
      );
    }
    throw new APIError(
      "PARSE_ERROR",
      `接口返回了非 JSON 内容 (${options.method || "GET"} ${path}, status ${res.status})`
    );
  }

  if (body.error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[API Error]", { request_id: body.request_id, fields: body.error.fields });
    }
    throw new APIError(body.error.code, body.error.message, body.error.fields, body.request_id);
  }

  return body.data as T;
}

// ---------- Auth ----------

export async function login(email: string, password: string) {
  const result = await request<AuthResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("token", result.token);
  return result;
}

export function logout() {
  localStorage.removeItem("token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** Decode JWT payload to extract current user ID (no verification). */
export function getCurrentUserId(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

/** Decode JWT payload to extract current user role (no verification). */
export function getCurrentUserRole(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

// ---------- Flows ----------

export async function listFlows() {
  return request<Flow[]>("/flows");
}

export async function getFlowDetail(id: string) {
  return request<FlowDetail>(`/flows/${id}`);
}

export async function createFlow(data: {
  title: string;
  owner_dept_id: string;
  overview: string;
}) {
  return request<Flow>("/flows", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateFlow(
  id: string,
  data: {
    title: string;
    owner_dept_id: string;
    overview: string;
    diagram_json: string;
    nodes: FlowNode[];
  }
) {
  return request<Flow>(`/flows/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function submitFlowReview(id: string) {
  return request<Flow>(`/flows/${id}/submit_review`, {
    method: "POST",
  });
}

export async function publishFlow(id: string) {
  return request<Flow>(`/flows/${id}/publish`, {
    method: "POST",
  });
}

export async function listFlowVersions(flowId: string) {
  return request<FlowVersion[]>(`/flows/${flowId}/versions`);
}

export async function getFlowVersionDetail(
  flowId: string,
  versionId: string
) {
  return request<FlowVersion>(`/flows/${flowId}/versions/${versionId}`);
}

// ---------- Admin: User Management ----------

export async function listUsers() {
  return request<UserInfo[]>("/admin/users");
}

export async function createUser(data: {
  email: string;
  password: string;
  role?: string;
}) {
  return request<UserInfo>("/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resetUserPassword(userId: string, password: string) {
  return request<{ status: string }>(`/admin/users/${userId}/reset_password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

// ---------- Workflow Nodes ----------

export interface RACI {
  R: string[];
  A: string[];
  S: string[];
  C: string[];
  I: string[];
}

export interface DiagramJSON {
  nodes: unknown[];
  edges: unknown[];
}

export interface WorkflowNode {
  id: string;
  document_id: string;
  name: string;
  exec_form: string;
  description: string;
  preconditions: string;
  outputs: string;
  duration_min: number | null;
  duration_max: number | null;
  duration_unit: string;
  raci: RACI;
  subtasks: string[];
  diagram_json: DiagramJSON;
  created_at: string;
  updated_at: string;
}

export interface NodeInput {
  name: string;
  exec_form: string;
  description: string;
  preconditions: string;
  outputs: string;
  duration_min: number | null;
  duration_max: number | null;
  duration_unit: string;
  raci: RACI;
  subtasks: string[];
  diagram_json: DiagramJSON;
}

export async function listNodes(docId: string) {
  return request<WorkflowNode[]>(`/docs/${docId}/nodes`);
}

export async function createNode(docId: string, data: NodeInput) {
  return request<WorkflowNode>(`/docs/${docId}/nodes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getNode(nodeId: string) {
  return request<WorkflowNode>(`/nodes/${nodeId}`);
}

export async function updateNode(nodeId: string, data: NodeInput) {
  return request<WorkflowNode>(`/nodes/${nodeId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
