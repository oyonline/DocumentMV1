"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login as apiLogin, isLoggedIn } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, loggedIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in → redirect to dashboard
  useEffect(() => {
    if (!authLoading && (loggedIn || isLoggedIn())) {
      router.replace("/dashboard");
    }
  }, [authLoading, loggedIn, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiLogin(email, password);
      signIn(); // update auth context so AppShell sees loggedIn=true
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Title area */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            DocMV
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            登录你的账户
          </p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="label">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              密码
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                处理中…
              </span>
            ) : (
              "登录"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-stone-400">
          账号由管理员创建，如需帮助请联系管理员
        </p>
      </div>
    </div>
  );
}
