"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listFlows, getCurrentUserId, type Flow, type FlowStatus } from "@/lib/api";

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

export default function DashboardPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getCurrentUserId();

  useEffect(() => {
    listFlows()
      .then((data) => setFlows(Array.isArray(data) ? data : []))
      .catch(() => setFlows([]))
      .finally(() => setLoading(false));
  }, []);

  // Defensive: API may resolve to null when Go returns nil slice
  const flowsArr = Array.isArray(flows) ? flows : [];

  const myFlows = flowsArr.filter((f) => f.owner_id === userId);
  const sharedFlows = flowsArr.filter((f) => f.owner_id !== userId);
  const effectiveFlows = flowsArr.filter((f) => f.status === "EFFECTIVE");
  const recent = [...flowsArr]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10);

  const stats = [
    {
      label: "我的流程",
      value: myFlows.length,
      href: "/flows?tab=mine",
      color: "text-brand-600",
      bg: "bg-brand-50",
    },
    {
      label: "共享给我",
      value: sharedFlows.length,
      href: "/flows?tab=shared",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "已生效",
      value: effectiveFlows.length,
      href: "/flows",
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
          欢迎回来，这是你的流程概览
        </p>
      </div>

      {/* Quick action */}
      <Link
        href="/flows/new"
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
          <p className="text-sm font-medium text-stone-900">新建流程</p>
          <p className="text-xs text-stone-400">创建一个新的流程草稿</p>
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

      {/* Recent flows */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">最近更新</h2>
          <Link
            href="/flows"
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
            暂无流程，点击上方按钮开始创建
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((flow) => (
              <Link
                key={flow.id}
                href={`/flows/${flow.id}`}
                className="card flex items-center justify-between px-5 py-3 transition-shadow duration-150 hover:shadow-md group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 font-mono">
                      {flow.flow_no}
                    </span>
                    <p className="truncate text-sm font-medium text-stone-900 group-hover:text-brand-600 transition-colors">
                      {flow.title}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-400">
                    {flow.owner_dept_id && `${flow.owner_dept_id} · `}
                    {new Date(flow.updated_at).toLocaleString("zh-CN")}
                  </p>
                </div>
                <StatusBadge status={flow.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: FlowStatus }) {
  return (
    <span
      className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_COLOR[status] || "bg-stone-100 text-stone-600"
      }`}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}
