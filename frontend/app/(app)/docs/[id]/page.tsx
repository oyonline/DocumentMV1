"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth";
import {
  getDocument,
  listVersions,
  type DocumentDetail,
  type DocumentVersion,
} from "@/lib/api";

const VISIBILITY_LABEL: Record<string, string> = {
  PRIVATE: "私有",
  PUBLIC: "公开",
  SHARED: "共享",
};

export default function DocDetailPage() {
  const { loading: authLoading } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVersions, setShowVersions] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !params.id) return;

    Promise.all([getDocument(params.id), listVersions(params.id)])
      .then(([doc, vers]) => {
        setDetail(doc);
        setVersions(vers);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authLoading, params.id]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
        {error}
      </div>
    );
  }

  if (!detail) return null;

  const { document: doc, content } = detail;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{doc.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-xs text-stone-400">
            <span>{VISIBILITY_LABEL[doc.visibility] || doc.visibility}</span>
            <span>·</span>
            <span>
              更新于 {new Date(doc.updated_at).toLocaleString("zh-CN")}
            </span>
          </div>
        </div>
        <Link href={`/docs/${doc.id}/edit`} className="btn-primary shrink-0">
          编辑
        </Link>
      </div>

      {/* Content */}
      <div className="card p-6">
        <div className="prose prose-stone max-w-none whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
          {content || (
            <span className="text-stone-400 italic">暂无内容</span>
          )}
        </div>
      </div>

      {/* Version history */}
      <div className="mt-8">
        <button
          onClick={() => setShowVersions(!showVersions)}
          className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${
              showVersions ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
          版本历史 ({versions.length})
        </button>

        {showVersions && (
          <div className="mt-3 space-y-2">
            {versions.map((v, i) => (
              <div
                key={v.id}
                className="card px-4 py-3 flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-medium text-stone-700">
                    版本 {versions.length - i}
                  </span>
                  <span className="ml-3 text-stone-400">
                    {new Date(v.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>
                <span className="text-xs text-stone-400 font-mono">
                  {v.id.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back link */}
      <div className="mt-8">
        <button
          onClick={() => router.push("/docs")}
          className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          ← 返回文档列表
        </button>
      </div>
    </div>
  );
}
