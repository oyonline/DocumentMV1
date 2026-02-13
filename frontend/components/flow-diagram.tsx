"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeMouseHandler,
  Connection,
  addEdge,
  MarkerType,
  useNodesState,
  useEdgesState,
  OnNodesChange,
  OnEdgesChange,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";

// ---------- Types (exported for reuse) ----------

export interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: "SEQ" | "COND" | "PARALLEL";
  label?: string;
}

export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export type EdgeType = "SEQ" | "COND" | "PARALLEL";

interface FlowDiagramProps {
  diagramJSON: string;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  readonly?: boolean;
  /** Enable edit mode: drag, connect, add/delete */
  editable?: boolean;
  /** Callback when diagram data changes (only in editable mode) */
  onDiagramChange?: (data: DiagramData) => void;
}

// ---------- Edge style helpers ----------

const EDGE_STYLES: Record<string, { stroke: string; strokeDasharray?: string }> = {
  SEQ: { stroke: "#57534e" },
  COND: { stroke: "#d97706", strokeDasharray: "5 3" },
  PARALLEL: { stroke: "#2563eb" },
};

const EDGE_TYPE_OPTIONS: { value: EdgeType; label: string; desc: string }[] = [
  { value: "SEQ", label: "顺序", desc: "按顺序执行" },
  { value: "COND", label: "条件分支", desc: "满足条件时执行" },
  { value: "PARALLEL", label: "并行", desc: "同时执行" },
];

// ---------- Helpers ----------

let nodeCounter = 0;

function parseDiagram(json: string): DiagramData {
  if (!json) return { nodes: [], edges: [] };
  try {
    return JSON.parse(json) as DiagramData;
  } catch {
    return { nodes: [], edges: [] };
  }
}

function toRfNodes(diagram: DiagramData, selectedNodeId: string | null, editable: boolean): Node[] {
  return diagram.nodes.map((n) => ({
    id: n.id,
    data: { label: n.label },
    position: { x: n.x, y: n.y },
    draggable: editable,
    connectable: editable,
    style: {
      background: n.id === selectedNodeId ? "#dbeafe" : "#fff",
      border: n.id === selectedNodeId ? "2px solid #3b82f6" : "1px solid #d6d3d1",
      borderRadius: 8,
      padding: "8px 16px",
      fontSize: 13,
      fontWeight: n.id === selectedNodeId ? 600 : 400,
      minWidth: 120,
      textAlign: "center" as const,
      cursor: editable ? "grab" : "pointer",
    },
  }));
}

function toRfEdges(diagram: DiagramData): Edge[] {
  return diagram.edges.map((e) => {
    const edgeStyle = EDGE_STYLES[e.type] || EDGE_STYLES.SEQ;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || (e.type !== "SEQ" ? e.type : undefined),
      style: edgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed },
      labelStyle: { fontSize: 11, fill: "#78716c" },
      animated: e.type === "PARALLEL",
    };
  });
}

// ---------- Edge Type Picker Modal ----------

function EdgeTypePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (type: EdgeType, label: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<EdgeType>("SEQ");
  const [label, setLabel] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl p-5 w-80 space-y-4">
        <h3 className="text-sm font-semibold text-stone-800">选择连线类型</h3>
        <div className="space-y-2">
          {EDGE_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                selected === opt.value
                  ? "border-brand-500 bg-brand-50"
                  : "border-stone-200 hover:bg-stone-50"
              }`}
            >
              <input
                type="radio"
                name="edgeType"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="accent-brand-600"
              />
              <div>
                <span className="text-sm font-medium text-stone-800">{opt.label}</span>
                <span className="ml-2 text-xs text-stone-400">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>

        {selected === "COND" && (
          <div>
            <label className="label">条件说明</label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：审批通过"
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm px-4 py-1.5">
            取消
          </button>
          <button
            onClick={() => onSelect(selected, selected === "COND" ? label : "")}
            className="btn-primary text-sm px-4 py-1.5"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Component ----------

export default function FlowDiagram({
  diagramJSON,
  selectedNodeId,
  onNodeClick,
  readonly = false,
  editable = false,
  onDiagramChange,
}: FlowDiagramProps) {
  const diagram = useMemo(() => parseDiagram(diagramJSON), [diagramJSON]);
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;

  const rfNodes = useMemo(
    () => toRfNodes(diagram, selectedNodeId, editable),
    [diagram, selectedNodeId, editable]
  );
  const rfEdges = useMemo(() => toRfEdges(diagram), [diagram]);

  // Pending connection (waiting for edge type selection)
  const [pendingConn, setPendingConn] = useState<Connection | null>(null);

  // --- Emit changes ---
  const emitChange = useCallback(
    (updated: DiagramData) => {
      onDiagramChange?.(updated);
    },
    [onDiagramChange]
  );

  // --- Node drag end: update positions ---
  const handleNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!editable) return;
      // Only care about position changes
      const posChanges = changes.filter(
        (c) => c.type === "position" && c.position
      );
      if (posChanges.length === 0) return;

      const updated = { ...diagramRef.current };
      updated.nodes = updated.nodes.map((n) => {
        const change = posChanges.find((c) => c.type === "position" && c.id === n.id);
        if (change && change.type === "position" && change.position) {
          return { ...n, x: Math.round(change.position.x), y: Math.round(change.position.y) };
        }
        return n;
      });
      emitChange(updated);
    },
    [editable, emitChange]
  );

  // --- Connection: open edge type picker ---
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!editable) return;
      setPendingConn(connection);
    },
    [editable]
  );

  const handleEdgeTypeSelected = useCallback(
    (type: EdgeType, label: string) => {
      if (!pendingConn) return;
      const newEdge: DiagramEdge = {
        id: `e-${pendingConn.source}-${pendingConn.target}-${Date.now()}`,
        source: pendingConn.source!,
        target: pendingConn.target!,
        type,
        label: label || undefined,
      };
      const updated: DiagramData = {
        ...diagramRef.current,
        edges: [...diagramRef.current.edges, newEdge],
      };
      emitChange(updated);
      setPendingConn(null);
    },
    [pendingConn, emitChange]
  );

  // --- Node click ---
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  // --- Add node ---
  const handleAddNode = useCallback(() => {
    nodeCounter++;
    const id = `node-${Date.now()}-${nodeCounter}`;
    const newNode: DiagramNode = {
      id,
      label: `新节点 ${diagram.nodes.length + 1}`,
      x: 100 + (diagram.nodes.length % 5) * 180,
      y: 100 + Math.floor(diagram.nodes.length / 5) * 120,
    };
    emitChange({
      ...diagramRef.current,
      nodes: [...diagramRef.current.nodes, newNode],
    });
    onNodeClick(id);
  }, [diagram.nodes.length, emitChange, onNodeClick]);

  // --- Delete selected node ---
  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const updated: DiagramData = {
      nodes: diagramRef.current.nodes.filter((n) => n.id !== selectedNodeId),
      edges: diagramRef.current.edges.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
      ),
    };
    emitChange(updated);
    onNodeClick("");
  }, [selectedNodeId, emitChange, onNodeClick]);

  // --- Empty state ---
  if (!editable && diagram.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 text-sm border border-dashed border-stone-200 rounded-lg">
        暂无流程图
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col" style={{ minHeight: 400 }}>
      {/* Toolbar (edit mode only) */}
      {editable && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-100 bg-stone-50/50">
          <button onClick={handleAddNode} className="btn-primary text-xs px-3 py-1">
            + 添加节点
          </button>
          {selectedNodeId && (
            <button onClick={handleDeleteSelected} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">
              删除选中节点
            </button>
          )}
          <span className="ml-auto text-[11px] text-stone-400">
            {editable ? "拖拽移动节点 · 从节点边缘拖出连线" : ""}
          </span>
        </div>
      )}

      {/* ReactFlow canvas */}
      <div className="flex-1" style={{ minHeight: 350 }}>
        <ReactFlow
          key={`${editable}-${diagramJSON.length}`}
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={editable ? handleNodesChange : undefined}
          onConnect={editable ? handleConnect : undefined}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={editable}
          nodesConnectable={editable}
          elementsSelectable={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e7e5e4" gap={16} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeColor="#a8a29e"
            nodeColor={(n) => (n.id === selectedNodeId ? "#93c5fd" : "#fafaf9")}
            maskColor="rgba(245, 245, 244, 0.7)"
            style={{ border: "1px solid #e7e5e4" }}
          />
        </ReactFlow>
      </div>

      {/* Edge type picker modal */}
      {pendingConn && (
        <EdgeTypePicker
          onSelect={handleEdgeTypeSelected}
          onCancel={() => setPendingConn(null)}
        />
      )}
    </div>
  );
}
