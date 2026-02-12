"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
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
            {isRegister ? "创建新账户" : "登录你的账户"}
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
              placeholder={isRegister ? "至少 6 个字符" : "输入密码"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isRegister ? 6 : undefined}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                处理中…
              </span>
            ) : isRegister ? (
              "注册"
            ) : (
              "登录"
            )}
          </button>
        </form>

        {/* Toggle */}
        <p className="mt-5 text-center text-sm text-stone-500">
          {isRegister ? "已有账户？" : "还没有账户？"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="font-medium text-brand-600 hover:text-brand-700 transition-colors"
          >
            {isRegister ? "去登录" : "去注册"}
          </button>
        </p>
      </div>
    </div>
  );
}
