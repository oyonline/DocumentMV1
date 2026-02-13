"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Flow, listFlows, getCurrentUserId, FlowStatus } from "@/lib/api";

const STATUS_LABEL: Record<FlowStatus, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "评审中",
  EFFECTIVE: "已生效",
};

const STATUS_COLOR: Record<FlowStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-600",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  EFFECTIVE: "bg-emerald-100 text-emerald-700",
};

export default function FlowListPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getCurrentUserId();

  useEffect(() => {
    listFlows()
      .then((data) => setFlows(Array.isArray(data) ? data : []))
      .catch(() => setFlows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = (() => {
    const arr = Array.isArray(flows) ? flows : [];
    if (tab === "mine") return arr.filter((f) => f.owner_id === userId);
    if (tab === "shared") return arr.filter((f) => f.owner_id !== userId);
    return arr;
  })();

  const tabLabel = tab === "mine" ? "我的流程" : tab === "shared" ? "共享给我" : "流程库";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400">
        加载中…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">{tabLabel}</h1>
        <Link href="/flows/new" className="btn-primary text-sm">
          新建流程
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="card px-6 py-12 text-center text-stone-400">
          暂无流程数据
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <Link
              key={f.id}
              href={`/flows/${f.id}`}
              className="card px-5 py-4 block hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-stone-400 font-mono mr-2">
                    {f.flow_no}
                  </span>
                  <span className="font-medium text-stone-800">{f.title}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[f.status]}`}
                >
                  {STATUS_LABEL[f.status]}
                </span>
              </div>
              <div className="mt-1 text-xs text-stone-400">
                {f.owner_dept_id && <span className="mr-3">{f.owner_dept_id}</span>}
                更新于 {new Date(f.updated_at).toLocaleString("zh-CN")}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
