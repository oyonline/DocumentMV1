"use client";

import { Flow, FlowStatus } from "@/lib/api";

const STATUS_LABEL: Record<FlowStatus, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "评审中",
  EFFECTIVE: "已生效",
};

const STATUS_COLOR: Record<FlowStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  EFFECTIVE: "bg-emerald-100 text-emerald-700",
};

interface FlowOverviewCardProps {
  flow: Flow;
  totalDurationMinDays: number;
  totalDurationMaxDays: number;
}

export default function FlowOverviewCard({
  flow,
  totalDurationMinDays,
  totalDurationMaxDays,
}: FlowOverviewCardProps) {
  const durationText =
    totalDurationMinDays > 0 || totalDurationMaxDays > 0
      ? `${totalDurationMinDays.toFixed(1)} ~ ${totalDurationMaxDays.toFixed(1)} 天`
      : "暂无";

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h1 className="text-xl font-bold text-stone-800">{flow.title}</h1>
          <p className="text-sm text-stone-400 mt-1">
            编号：{flow.flow_no}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[flow.status]}`}
        >
          {STATUS_LABEL[flow.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-stone-400">负责部门</span>
          <p className="font-medium text-stone-700">
            {flow.owner_dept_id || "—"}
          </p>
        </div>
        <div>
          <span className="text-stone-400">标准时长</span>
          <p className="font-medium text-stone-700">{durationText}</p>
        </div>
        <div>
          <span className="text-stone-400">最后更新</span>
          <p className="font-medium text-stone-700">
            {new Date(flow.updated_at).toLocaleString("zh-CN")}
          </p>
        </div>
        <div>
          <span className="text-stone-400">创建时间</span>
          <p className="font-medium text-stone-700">
            {new Date(flow.created_at).toLocaleString("zh-CN")}
          </p>
        </div>
      </div>

      {flow.overview && (
        <div className="mt-4 pt-3 border-t border-stone-100">
          <span className="text-sm text-stone-400">概述</span>
          <p className="mt-1 text-sm text-stone-600 whitespace-pre-wrap">
            {flow.overview}
          </p>
        </div>
      )}
    </div>
  );
}
