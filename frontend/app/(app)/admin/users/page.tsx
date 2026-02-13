"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  listUsers,
  createUser,
  resetUserPassword,
  getCurrentUserRole,
  type UserInfo,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  User Management Page (Admin only)                                  */
/* ------------------------------------------------------------------ */

export default function AdminUsersPage() {
  const router = useRouter();
  const role = getCurrentUserRole();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // New-user form
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("USER");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Reset password dialog
  const [resetTarget, setResetTarget] = useState<UserInfo | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      // 403 → redirect away
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Client-side guard: non-admin redirected
    if (role !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }
    fetchUsers();
  }, [role, router, fetchUsers]);

  // ---------- Create user ----------
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      await createUser({ email: formEmail, password: formPassword, role: formRole });
      setFormEmail("");
      setFormPassword("");
      setFormRole("USER");
      setShowForm(false);
      await fetchUsers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setFormLoading(false);
    }
  }

  // ---------- Reset password ----------
  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError("");
    setResetLoading(true);
    try {
      await resetUserPassword(resetTarget.id, resetPwd);
      setResetTarget(null);
      setResetPwd("");
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "重置失败");
    } finally {
      setResetLoading(false);
    }
  }

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">
            用户管理
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            管理系统内所有用户账号
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary gap-1.5 text-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新建用户
        </button>
      </div>

      {/* Create user form (slide-down) */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-800">新建用户</h2>
          {formError && (
            <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 border border-red-100">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">邮箱</label>
              <input
                type="email"
                className="input"
                placeholder="user@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">密码</label>
              <input
                type="password"
                className="input"
                placeholder="至少 6 个字符"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="label">角色</label>
              <select
                className="input"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                <option value="USER">普通用户</option>
                <option value="ADMIN">管理员</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={formLoading} className="btn-primary text-sm">
              {formLoading ? "创建中…" : "创建"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(""); }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* Users table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/60 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
              <th className="px-5 py-3">邮箱</th>
              <th className="px-5 py-3">角色</th>
              <th className="px-5 py-3">创建时间</th>
              <th className="px-5 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-stone-400">
                  暂无用户
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-stone-50/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-stone-800">{u.email}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "ADMIN"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {u.role === "ADMIN" ? "管理员" : "普通用户"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-stone-500">
                    {new Date(u.created_at).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => { setResetTarget(u); setResetPwd(""); setResetError(""); }}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                    >
                      重置密码
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <form onSubmit={handleReset} className="card w-full max-w-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-stone-800">
              重置密码：{resetTarget.email}
            </h2>
            {resetError && (
              <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 border border-red-100">
                {resetError}
              </div>
            )}
            <div>
              <label className="label">新密码</label>
              <input
                type="password"
                className="input"
                placeholder="至少 6 个字符"
                value={resetPwd}
                onChange={(e) => setResetPwd(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={resetLoading} className="btn-primary text-sm">
                {resetLoading ? "重置中…" : "确认重置"}
              </button>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
