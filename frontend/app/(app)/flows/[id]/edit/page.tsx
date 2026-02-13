"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  FlowDetail,
  FlowNode,
  getFlowDetail,
  updateFlow,
} from "@/lib/api";
import NodeDetailPanel from "@/components/node-detail-panel";
import type { DiagramData, DiagramNode } from "@/components/flow-diagram";

// Dynamic import (reactflow needs client only)
const FlowDiagram = dynamic(() => import("@/components/flow-diagram"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-stone-400 text-sm">
      加载流程图…
    </div>
  ),
});

export default function EditFlowPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  const [detail, setDetail] = useState<FlowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [ownerDeptId, setOwnerDeptId] = useState("");
  const [overview, setOverview] = useState("");
  const [diagramData, setDiagramData] = useState<DiagramData>({ nodes: [], edges: [] });
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Derived: diagram JSON string (for saving + advanced view)
  const diagramJSON = useMemo(() => {
    if (diagramData.nodes.length === 0 && diagramData.edges.length === 0) return "";
    return JSON.stringify(diagramData, null, 2);
  }, [diagramData]);

  const fetchData = useCallback(async () => {
    try {
      const d = await getFlowDetail(flowId);
      setDetail(d);
      setTitle(d.flow.title);
      setOwnerDeptId(d.flow.owner_dept_id);
      setOverview(d.flow.overview);
      setNodes(Array.isArray(d.nodes) ? d.nodes : []);

      // Parse diagram
      if (d.flow.diagram_json) {
        try {
          setDiagramData(JSON.parse(d.flow.diagram_json) as DiagramData);
        } catch {
          setDiagramData({ nodes: [], edges: [] });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Save ---
  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await updateFlow(flowId, {
        title,
        owner_dept_id: ownerDeptId,
        overview,
        diagram_json: diagramJSON,
        nodes,
      });
      router.push(`/flows/${flowId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  // --- Diagram changes ---
  const handleDiagramChange = useCallback(
    (data: DiagramData) => {
      setDiagramData(data);
      // Sync diagram node labels into FlowNode names (if a diagram node was added)
      // Auto-create FlowNode entries for new diagram nodes
      setNodes((prevNodes) => {
        const existingIds = new Set(prevNodes.map((n) => n.id));
        const newDiagramNodes = data.nodes.filter((dn) => !existingIds.has(dn.id));
        if (newDiagramNodes.length === 0) return prevNodes;

        const additions: FlowNode[] = newDiagramNodes.map((dn, i) => ({
          id: dn.id,
          flow_id: flowId,
          node_no: `${prevNodes.length + i + 1}`,
          name: dn.label,
          intro: "",
          raci_json: "",
          exec_form: "",
          duration_min: null,
          duration_max: null,
          duration_unit: "DAY",
          prereq_text: "",
          outputs_text: "",
          subtasks_json: "[]",
          sort_order: prevNodes.length + i,
        }));
        return [...prevNodes, ...additions];
      });
    },
    [flowId]
  );

  // --- Node changes from panel ---
  const handleNodeChange = useCallback(
    (updated: FlowNode) => {
      setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      // Sync name to diagram node label
      setDiagramData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((dn) =>
          dn.id === updated.id ? { ...dn, label: updated.name || dn.label } : dn
        ),
      }));
    },
    []
  );

  // --- Delete node (from diagram or panel) ---
  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setDiagramData((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== selectedNodeId),
      edges: prev.edges.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
      ),
    }));
    setSelectedNodeId(null);
  }, [selectedNodeId]);

  // --- Add node (from panel, not on diagram) ---
  const handleAddNodeFromPanel = useCallback(() => {
    const id = `node-${Date.now()}`;
    const newNode: FlowNode = {
      id,
      flow_id: flowId,
      node_no: `${nodes.length + 1}`,
      name: `新节点 ${nodes.length + 1}`,
      intro: "",
      raci_json: "",
      exec_form: "",
      duration_min: null,
      duration_max: null,
      duration_unit: "DAY",
      prereq_text: "",
      outputs_text: "",
      subtasks_json: "[]",
      sort_order: nodes.length,
    };
    setNodes((prev) => [...prev, newNode]);
    // Also add to diagram
    const newDN: DiagramNode = {
      id,
      label: newNode.name,
      x: 100 + (diagramData.nodes.length % 5) * 180,
      y: 100 + Math.floor(diagramData.nodes.length / 5) * 120,
    };
    setDiagramData((prev) => ({ ...prev, nodes: [...prev.nodes, newDN] }));
    setSelectedNodeId(id);
  }, [flowId, nodes.length, diagramData.nodes.length]);

  // --- Advanced: parse JSON back into diagramData ---
  const handleAdvancedJSONChange = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw) as DiagramData;
      if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        setDiagramData(parsed);
      }
    } catch {
      // ignore invalid JSON while user is typing
    }
  }, []);

  // --- Selected node ---
  const selectedIndex = selectedNodeId
    ? nodes.findIndex((n) => n.id === selectedNodeId)
    : -1;
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : null;

  // --- Loading / Error ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400">
        加载中…
      </div>
    );
  }

  if (!detail || detail.flow.status !== "DRAFT") {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-600 mb-4">
          {error || "仅草稿状态的流程可以编辑"}
        </p>
        <button onClick={() => router.back()} className="btn-secondary">
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">编辑流程</h1>
          <span className="text-sm text-stone-400 font-mono">
            {detail.flow.flow_no}
          </span>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            onClick={() => router.push(`/flows/${flowId}`)}
            className="btn-secondary"
          >
            取消
          </button>
        </div>
      </div>

      {/* Overview section */}
      <div className="card p-5 space-y-4">
        <h2 className="text-base font-semibold text-stone-700">流程概览</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">标题 *</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label">负责部门</label>
            <input
              className="input"
              value={ownerDeptId}
              onChange={(e) => setOwnerDeptId(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">概述</label>
          <textarea
            className="input min-h-[60px]"
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
          />
        </div>
      </div>

      {/* Main content: Diagram (editable) + Node Edit Panel */}
      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 520 }}>
        {/* Diagram */}
        <div className="flex-1 card overflow-hidden" style={{ minHeight: 450 }}>
          <FlowDiagram
            diagramJSON={diagramJSON}
            selectedNodeId={selectedNodeId}
            onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
            editable
            onDiagramChange={handleDiagramChange}
          />
        </div>

        {/* Node Edit Panel */}
        <div
          className="w-full lg:w-[380px] card flex flex-col"
          style={{ minHeight: 450 }}
        >
          <NodeDetailPanel
            node={selectedNode}
            nodes={nodes}
            selectedIndex={selectedIndex}
            onSelect={(idx) => setSelectedNodeId(nodes[idx]?.id || null)}
            editing
            onNodeChange={handleNodeChange}
            onDeleteNode={handleDeleteNode}
          />
        </div>
      </div>

      {/* Advanced settings (collapsible) */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full px-5 py-3 text-sm text-stone-500 hover:bg-stone-50 transition-colors"
        >
          <span className="font-medium">高级设置</span>
          <svg
            className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="px-5 pb-5 space-y-4 border-t border-stone-100 pt-4">
            <div>
              <label className="label">流程图 JSON（调试/复制用）</label>
              <textarea
                className="input font-mono text-xs min-h-[120px]"
                value={diagramJSON}
                onChange={(e) => handleAdvancedJSONChange(e.target.value)}
                placeholder='{"nodes":[], "edges":[]}'
              />
            </div>

            <div>
              <label className="label">
                节点数据 JSON（只读预览，共 {nodes.length} 个节点）
              </label>
              <textarea
                className="input font-mono text-xs min-h-[100px]"
                value={JSON.stringify(
                  nodes.map((n) => ({
                    id: n.id,
                    node_no: n.node_no,
                    name: n.name,
                    raci_json: n.raci_json,
                    subtasks_json: n.subtasks_json,
                  })),
                  null,
                  2
                )}
                readOnly
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
