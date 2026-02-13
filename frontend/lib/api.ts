/**
 * API client for the DocMV backend.
 * All requests go through Next.js rewrite -> Go backend.
 */

const BASE = "/api";

// ---------- Types ----------

export interface APIResponse<T> {
  data?: T;
  error?: { code: string; message: string };
  request_id: string;
}

export interface AuthResult {
  token: string;
  user: { id: string; email: string; role: string; created_at: string };
}

export interface Document {
  id: string;
  owner_id: string;
  title: string;
  visibility: "PRIVATE" | "PUBLIC" | "SHARED";
  latest_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetail {
  document: Document;
  content: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  content: string;
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

class APIError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
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
  const body: APIResponse<T> = await res.json();

  if (body.error) {
    throw new APIError(body.error.code, body.error.message);
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

// ---------- Documents ----------

export async function listDocuments() {
  return request<Document[]>("/docs");
}

export async function getDocument(id: string) {
  return request<DocumentDetail>(`/docs/${id}`);
}

export async function createDocument(data: {
  title: string;
  content: string;
  visibility: string;
}) {
  return request<Document>("/docs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDocument(
  id: string,
  data: { title: string; content: string; visibility: string }
) {
  return request<Document>(`/docs/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function listVersions(docId: string) {
  return request<DocumentVersion[]>(`/docs/${docId}/versions`);
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
