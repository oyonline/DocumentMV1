"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth";
import { createDocument } from "@/lib/api";

export default function NewDocPage() {
  const { loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("PRIVATE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const doc = await createDocument({ title, content, visibility });
      router.push(`/docs/${doc.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-stone-900 mb-6">新建文档</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="title" className="label">标题</label>
          <input
            id="title"
            className="input"
            placeholder="输入文档标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="visibility" className="label">可见性</label>
          <select
            id="visibility"
            className="input"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="PRIVATE">私有 — 仅自己可见</option>
            <option value="PUBLIC">公开 — 所有人可见</option>
            <option value="SHARED">共享 — 指定人可见</option>
          </select>
        </div>

        <div>
          <label htmlFor="content" className="label">内容</label>
          <textarea
            id="content"
            className="input min-h-[240px] resize-y font-mono text-sm leading-relaxed"
            placeholder="开始书写…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.back()}
          >
            取消
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "创建中…" : "创建文档"}
          </button>
        </div>
      </form>
    </div>
  );
}
