"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { listDocuments, getCurrentUserId, type Document } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Constants (identical to original docs page)                        */
/* ------------------------------------------------------------------ */

const VISIBILITY_LABEL: Record<string, string> = {
  PRIVATE: "私有",
  PUBLIC: "公开",
  SHARED: "共享",
};

const VISIBILITY_COLOR: Record<string, string> = {
  PRIVATE: "bg-stone-100 text-stone-600",
  PUBLIC: "bg-emerald-50 text-emerald-700",
  SHARED: "bg-blue-50 text-blue-700",
};

const TAB_TITLES: Record<string, string> = {
  "": "文档库",
  mine: "我的文档",
  shared: "共享给我",
};

/* ------------------------------------------------------------------ */
/*  Inner content (reads searchParams → wrapped in Suspense)           */
/* ------------------------------------------------------------------ */

function DocsListContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "";

  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const userId = getCurrentUserId();

  useEffect(() => {
    listDocuments()
      .then(setAllDocs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  /* ---------- Tab-based filtering ---------- */
  const docs = filterByTab(allDocs, tab, userId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-stone-900">
            {TAB_TITLES[tab] || "文档库"}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            共 {docs.length} 篇文档
          </p>
        </div>
        <Link href="/docs/new" className="btn-primary">
          新建文档
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100 mb-6">
          {error}
        </div>
      )}

      {/* Document list — structure identical to original */}
      {docs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-stone-400">
          <svg className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-sm">
            {tab === "shared"
              ? "暂无共享文档"
              : tab === "mine"
                ? "还没有文档，开始创建第一篇吧"
                : "还没有文档，开始创建第一篇吧"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <Link
              key={doc.id}
              href={`/docs/${doc.id}`}
              className="card block px-5 py-4 hover:shadow-md transition-shadow duration-150 group"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-stone-900 group-hover:text-brand-600 transition-colors">
                  {doc.title}
                </h2>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    VISIBILITY_COLOR[doc.visibility] || "bg-stone-100 text-stone-600"
                  }`}
                >
                  {VISIBILITY_LABEL[doc.visibility] || doc.visibility}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                更新于 {new Date(doc.updated_at).toLocaleString("zh-CN")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export (Suspense boundary for useSearchParams)                */
/* ------------------------------------------------------------------ */

export default function DocsListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
        </div>
      }
    >
      <DocsListContent />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter helper                                                      */
/* ------------------------------------------------------------------ */

function filterByTab(
  docs: Document[],
  tab: string,
  userId: string | null
): Document[] {
  if (!tab) return docs; // "all" — no filter
  if (tab === "mine") return docs.filter((d) => d.owner_id === userId);
  if (tab === "shared")
    return docs.filter((d) => d.owner_id !== userId);
  return docs;
}
