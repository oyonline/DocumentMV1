"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  FlowVersion,
  getFlowVersionDetail,
  listFlowVersions,
} from "@/lib/api";
import FlowOverviewCard from "@/components/flow-overview-card";
import NodeDetailPanel from "@/components/node-detail-panel";

// Dynamically import FlowDiagram
const FlowDiagram = dynamic(() => import("@/components/flow-diagram"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-stone-400 text-sm">
      加载流程图…
    </div>
  ),
});

interface SnapshotData {
  flow: {
    id: string;
    flow_no: string;
    title: string;
    owner_id: string;
    owner_dept_id: string;
    overview: string;
    status: string;
    diagram_json: string;
    created_at: string;
    updated_at: string;
  };
  nodes: Array<{
    id: string;
    flow_id: string;
    node_no: string;
    name: string;
    intro: string;
    raci_json: string;
    exec_form: string;
    duration_min: number | null;
    duration_max: number | null;
    duration_unit: string;
    prereq_text: string;
    outputs_text: string;
    subtasks_json: string;
    sort_order: number;
  }>;
  total_duration_min_days: number;
  total_duration_max_days: number;
}

export default function FlowVersionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;
  const versionId = params.versionId as string;

  const [version, setVersion] = useState<FlowVersion | null>(null);
  const [allVersions, setAllVersions] = useState<FlowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [v, vs] = await Promise.all([
          getFlowVersionDetail(flowId, versionId),
          listFlowVersions(flowId),
        ]);
        setVersion(v);
        setAllVersions(Array.isArray(vs) ? vs : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [flowId, versionId]);

  const snapshot = useMemo<SnapshotData | null>(() => {
    if (!version?.snapshot_json) return null;
    try {
      return JSON.parse(version.snapshot_json) as SnapshotData;
    } catch {
      return null;
    }
  }, [version]);

  const versionIndex = allVersions.findIndex((v) => v.id === versionId);
  const versionNumber = versionIndex >= 0 ? allVersions.length - versionIndex : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400">
        加载中…
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-600 mb-4">{error || "无法解析版本快照"}</p>
        <button onClick={() => router.back()} className="btn-secondary">
          返回
        </button>
      </div>
    );
  }

  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
  const selectedIndex = selectedNodeId
    ? nodes.findIndex((n) => n.id === selectedNodeId)
    : -1;
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : null;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Version badge */}
      <div className="flex items-center gap-3">
        <Link
          href={`/flows/${flowId}`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← 返回流程详情
        </Link>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
          历史版本 {versionNumber}
        </span>
        <span className="text-xs text-stone-400">
          快照时间：{version && new Date(version.created_at).toLocaleString("zh-CN")}
        </span>
      </div>

      {/* Overview (from snapshot) */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <FlowOverviewCard
        flow={snapshot.flow as any}
        totalDurationMinDays={snapshot.total_duration_min_days}
        totalDurationMaxDays={snapshot.total_duration_max_days}
      />

      {/* Diagram + Node Panel */}
      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 500 }}>
        <div className="flex-1 card overflow-hidden" style={{ minHeight: 400 }}>
          <FlowDiagram
            diagramJSON={snapshot.flow.diagram_json || ""}
            selectedNodeId={selectedNodeId}
            onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
            readonly
          />
        </div>

        <div className="w-full lg:w-[380px] card flex flex-col" style={{ minHeight: 400 }}>
          <NodeDetailPanel
            node={selectedNode}
            nodes={nodes}
            selectedIndex={selectedIndex}
            onSelect={(idx) => setSelectedNodeId(nodes[idx]?.id || null)}
            readonly
          />
        </div>
      </div>
    </div>
  );
}
