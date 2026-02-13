"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listDocuments, getCurrentUserId, type Document } from "@/lib/api";

export default function DashboardPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getCurrentUserId();

  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Defensive: API may resolve to null when Go returns nil slice
  const docsArr = Array.isArray(docs) ? docs : [];

  const myDocs = docsArr.filter((d) => d.owner_id === userId);
  const sharedDocs = docsArr.filter(
    (d) => d.owner_id !== userId && d.visibility === "SHARED"
  );
  const publicDocs = docsArr.filter((d) => d.visibility === "PUBLIC");
  const recent = [...docsArr]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10);

  const stats = [
    {
      label: "我的文档",
      value: myDocs.length,
      href: "/docs?tab=mine",
      color: "text-brand-600",
      bg: "bg-brand-50",
    },
    {
      label: "共享给我",
      value: sharedDocs.length,
      href: "/docs?tab=shared",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "公开可见",
      value: publicDocs.length,
      href: "/docs",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div>
      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900">工作台</h1>
        <p className="mt-1 text-sm text-stone-500">
          欢迎回来，这是你的文档概览
        </p>
      </div>

      {/* Quick action */}
      <Link
        href="/docs/new"
        className="card mb-8 flex items-center gap-4 px-5 py-4 transition-shadow duration-150 hover:shadow-md group"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white transition-transform duration-150 group-hover:scale-105">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-stone-900">新建文档</p>
          <p className="text-xs text-stone-400">创建一篇新的文档</p>
        </div>
      </Link>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card px-5 py-4 transition-shadow duration-150 hover:shadow-md"
          >
            <p className="text-xs font-medium text-stone-500">{s.label}</p>
            <p className={`mt-2 text-2xl font-bold ${s.color}`}>
              {loading ? (
                <span className="inline-block h-7 w-10 animate-pulse rounded bg-stone-100" />
              ) : (
                s.value
              )}
            </p>
          </Link>
        ))}
      </div>

      {/* Recent documents */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">最近更新</h2>
          <Link
            href="/docs"
            className="text-xs text-brand-600 hover:text-brand-700 transition-colors"
          >
            查看全部
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="card h-16 animate-pulse bg-stone-50"
              />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="card flex items-center justify-center py-12 text-sm text-stone-400">
            暂无文档，点击上方按钮开始创建
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((doc) => (
              <Link
                key={doc.id}
                href={`/docs/${doc.id}`}
                className="card flex items-center justify-between px-5 py-3 transition-shadow duration-150 hover:shadow-md group"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900 group-hover:text-brand-600 transition-colors">
                    {doc.title}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400">
                    {new Date(doc.updated_at).toLocaleString("zh-CN")}
                  </p>
                </div>
                <VisibilityBadge visibility={doc.visibility} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared badge (same style as docs list)                             */
/* ------------------------------------------------------------------ */

const VIS_LABEL: Record<string, string> = {
  PRIVATE: "私有",
  PUBLIC: "公开",
  SHARED: "共享",
};
const VIS_COLOR: Record<string, string> = {
  PRIVATE: "bg-stone-100 text-stone-600",
  PUBLIC: "bg-emerald-50 text-emerald-700",
  SHARED: "bg-blue-50 text-blue-700",
};

function VisibilityBadge({ visibility }: { visibility: string }) {
  return (
    <span
      className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        VIS_COLOR[visibility] || "bg-stone-100 text-stone-600"
      }`}
    >
      {VIS_LABEL[visibility] || visibility}
    </span>
  );
}
