"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  FlowDetail,
  FlowVersion,
  getFlowDetail,
  listFlowVersions,
  submitFlowReview,
  publishFlow,
  getCurrentUserId,
} from "@/lib/api";
import FlowOverviewCard from "@/components/flow-overview-card";
import NodeDetailPanel from "@/components/node-detail-panel";

// Dynamically import FlowDiagram (it uses reactflow which needs client-side only)
const FlowDiagram = dynamic(() => import("@/components/flow-diagram"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-stone-400 text-sm">
      加载流程图…
    </div>
  ),
});

export default function FlowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;
  const userId = getCurrentUserId();

  const [detail, setDetail] = useState<FlowDetail | null>(null);
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const d = await getFlowDetail(flowId);
      setDetail(d);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (showVersions && versions.length === 0) {
      listFlowVersions(flowId)
        .then((v) => setVersions(Array.isArray(v) ? v : []))
        .catch(() => setVersions([]));
    }
  }, [showVersions, flowId, versions.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400">
        加载中…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-600 mb-4">{error || "流程不存在"}</p>
        <button onClick={() => router.push("/flows")} className="btn-secondary">
          返回列表
        </button>
      </div>
    );
  }

  const { flow, nodes } = detail;
  const isOwner = flow.owner_id === userId;
  const canEdit = isOwner && flow.status === "DRAFT";

  const selectedIndex = selectedNodeId
    ? nodes.findIndex((n) => n.id === selectedNodeId)
    : -1;
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : null;

  async function handleSubmitReview() {
    setActionLoading(true);
    try {
      await submitFlowReview(flowId);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePublish() {
    setActionLoading(true);
    try {
      await publishFlow(flowId);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Overview card */}
      <FlowOverviewCard
        flow={flow}
        totalDurationMinDays={detail.total_duration_min_days}
        totalDurationMaxDays={detail.total_duration_max_days}
      />

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {canEdit && (
          <Link href={`/flows/${flow.id}/edit`} className="btn-primary text-sm">
            编辑流程
          </Link>
        )}
        {isOwner && flow.status === "DRAFT" && (
          <button
            onClick={handleSubmitReview}
            disabled={actionLoading}
            className="btn-secondary text-sm"
          >
            {actionLoading ? "处理中…" : "提交评审"}
          </button>
        )}
        {isOwner && flow.status === "IN_REVIEW" && (
          <button
            onClick={handlePublish}
            disabled={actionLoading}
            className="btn-primary text-sm"
          >
            {actionLoading ? "处理中…" : "发布生效"}
          </button>
        )}
        <button
          onClick={() => setShowVersions(!showVersions)}
          className="btn-secondary text-sm"
        >
          {showVersions ? "收起版本" : "版本历史"}
        </button>
      </div>

      {/* Main content: Diagram + Node Panel */}
      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 500 }}>
        {/* Diagram */}
        <div className="flex-1 card overflow-hidden" style={{ minHeight: 400 }}>
          <FlowDiagram
            diagramJSON={flow.diagram_json}
            selectedNodeId={selectedNodeId}
            onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
          />
        </div>

        {/* Node Detail Panel */}
        <div className="w-full lg:w-[380px] card flex flex-col" style={{ minHeight: 400 }}>
          <NodeDetailPanel
            node={selectedNode}
            nodes={nodes}
            selectedIndex={selectedIndex}
            onSelect={(idx) => setSelectedNodeId(nodes[idx]?.id || null)}
            readonly={!canEdit}
          />
        </div>
      </div>

      {/* Version history */}
      {showVersions && (
        <div className="card p-5">
          <h2 className="text-base font-semibold text-stone-700 mb-3">
            版本历史
          </h2>
          {versions.length === 0 ? (
            <p className="text-sm text-stone-400">暂无历史版本</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v, i) => (
                <Link
                  key={v.id}
                  href={`/flows/${flow.id}/versions/${v.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-stone-50 transition-colors text-sm"
                >
                  <div>
                    <span className="font-medium text-stone-700">
                      版本 {versions.length - i}
                    </span>
                    <span className="ml-3 text-stone-400">
                      {new Date(v.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-brand-600">
                    查看 →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
