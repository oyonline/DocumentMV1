"use client";

import { useState, useCallback } from "react";
import { FlowNode } from "@/lib/api";

// ---------- Constants ----------

const EXEC_FORM_LABEL: Record<string, string> = {
  SYSTEM_APPROVAL: "系统审批",
  OFFLINE_MEETING: "线下会议",
  EMAIL_CONFIRM: "邮件确认",
  DOC_REVIEW: "文档评审",
  SYSTEM_OPERATION: "系统操作",
};

const EXEC_FORM_OPTIONS = Object.entries(EXEC_FORM_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const RACI_KEYS = ["R", "A", "C", "I"] as const;
const RACI_LABELS: Record<string, string> = {
  R: "执行 (R)",
  A: "审批 (A)",
  C: "咨询 (C)",
  I: "知会 (I)",
};

// ---------- Types ----------

type RACIData = Record<string, string[]>;

interface NodeDetailPanelProps {
  node: FlowNode | null;
  nodes: FlowNode[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  readonly?: boolean;
  /** Edit mode: show editable form */
  editing?: boolean;
  /** Callback when node data changes in edit mode */
  onNodeChange?: (updated: FlowNode) => void;
  /** Callback to delete the selected node */
  onDeleteNode?: () => void;
}

// ---------- Component ----------

export default function NodeDetailPanel({
  node,
  nodes,
  selectedIndex,
  onSelect,
  readonly = true,
  editing = false,
  onNodeChange,
  onDeleteNode,
}: NodeDetailPanelProps) {
  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 text-sm">
        {editing ? "点击左侧流程图节点进行编辑" : "请选择节点查看说明"}
      </div>
    );
  }

  if (editing && onNodeChange) {
    return (
      <NodeEditForm
        node={node}
        nodes={nodes}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
        onChange={onNodeChange}
        onDelete={onDeleteNode}
      />
    );
  }

  return (
    <NodeReadView
      node={node}
      nodes={nodes}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      readonly={readonly}
    />
  );
}

// ================================================================
//  READ-ONLY VIEW
// ================================================================

function NodeReadView({
  node,
  nodes,
  selectedIndex,
  onSelect,
}: {
  node: FlowNode;
  nodes: FlowNode[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  readonly: boolean;
}) {
  const raciData = parseJSON<RACIData>(node.raci_json);
  const subtasks = parseJSON<string[]>(node.subtasks_json) || [];
  const durationText = buildDurationText(node);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-stone-100">
        <div>
          <span className="text-xs text-stone-400 font-mono">{node.node_no}</span>
          <h3 className="text-lg font-semibold text-stone-800">{node.name}</h3>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 text-sm">
        {node.intro && (
          <Section title="说明">
            <p className="text-stone-600 whitespace-pre-wrap">{node.intro}</p>
          </Section>
        )}
        {node.exec_form && (
          <Section title="执行形式">
            <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
              {EXEC_FORM_LABEL[node.exec_form] || node.exec_form}
            </span>
          </Section>
        )}
        {durationText && (
          <Section title="标准耗时">
            <p className="text-stone-600">{durationText}</p>
          </Section>
        )}
        {raciData && Object.keys(raciData).length > 0 && (
          <Section title="RACI">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(raciData).map(([key, values]) => (
                <div key={key}>
                  <span className="font-medium text-stone-500 uppercase text-xs">{key}</span>
                  <p className="text-stone-700">
                    {Array.isArray(values) ? values.join("、") : String(values)}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}
        {node.prereq_text && (
          <Section title="前置条件">
            <p className="text-stone-600 whitespace-pre-wrap">{node.prereq_text}</p>
          </Section>
        )}
        {node.outputs_text && (
          <Section title="输出物">
            <p className="text-stone-600 whitespace-pre-wrap">{node.outputs_text}</p>
          </Section>
        )}
        {subtasks.length > 0 && (
          <Section title="子任务">
            <ul className="list-disc list-inside space-y-1">
              {subtasks.map((task, i) => (
                <li key={i} className="text-stone-600">{task}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <NavFooter nodes={nodes} selectedIndex={selectedIndex} onSelect={onSelect} />
    </div>
  );
}

// ================================================================
//  EDIT FORM
// ================================================================

function NodeEditForm({
  node,
  nodes,
  selectedIndex,
  onSelect,
  onChange,
  onDelete,
}: {
  node: FlowNode;
  nodes: FlowNode[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  onChange: (updated: FlowNode) => void;
  onDelete?: () => void;
}) {
  const raci = parseJSON<RACIData>(node.raci_json) || {};
  const subtasks = parseJSON<string[]>(node.subtasks_json) || [];

  // Update a single field
  const updateField = useCallback(
    (field: keyof FlowNode, value: unknown) => {
      onChange({ ...node, [field]: value });
    },
    [node, onChange]
  );

  // RACI update
  const updateRaci = useCallback(
    (key: string, values: string[]) => {
      const updated = { ...raci, [key]: values };
      // Remove empty keys
      if (values.length === 0) delete updated[key];
      onChange({ ...node, raci_json: JSON.stringify(updated) });
    },
    [node, raci, onChange]
  );

  // Subtask update
  const updateSubtasks = useCallback(
    (newList: string[]) => {
      onChange({ ...node, subtasks_json: JSON.stringify(newList) });
    },
    [node, onChange]
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-stone-100">
        <span className="text-sm font-semibold text-stone-700">编辑节点</span>
        {onDelete && (
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">
            删除节点
          </button>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 p-4 space-y-4 text-sm overflow-y-auto">
        {/* Basic info */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">编号</label>
            <input
              className="input"
              value={node.node_no}
              onChange={(e) => updateField("node_no", e.target.value)}
              placeholder="1.1"
            />
          </div>
          <div className="col-span-2">
            <label className="label">名称 *</label>
            <input
              className="input"
              value={node.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">说明</label>
          <textarea
            className="input min-h-[50px]"
            value={node.intro || ""}
            onChange={(e) => updateField("intro", e.target.value)}
          />
        </div>

        {/* Exec form */}
        <div>
          <label className="label">执行形式</label>
          <select
            className="input"
            value={node.exec_form || ""}
            onChange={(e) => updateField("exec_form", e.target.value)}
          >
            <option value="">请选择</option>
            {EXEC_FORM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Duration */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">最短耗时</label>
            <input
              type="number"
              className="input"
              value={node.duration_min ?? ""}
              onChange={(e) =>
                updateField("duration_min", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div>
            <label className="label">最长耗时</label>
            <input
              type="number"
              className="input"
              value={node.duration_max ?? ""}
              onChange={(e) =>
                updateField("duration_max", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div>
            <label className="label">单位</label>
            <select
              className="input"
              value={node.duration_unit || "DAY"}
              onChange={(e) => updateField("duration_unit", e.target.value)}
            >
              <option value="DAY">天</option>
              <option value="HOUR">小时</option>
            </select>
          </div>
        </div>

        {/* RACI — structured multi-tag input */}
        <Section title="RACI 职责分配">
          <div className="space-y-2">
            {RACI_KEYS.map((key) => (
              <RACITagInput
                key={key}
                label={RACI_LABELS[key]}
                values={raci[key] || []}
                onChange={(vals) => updateRaci(key, vals)}
              />
            ))}
          </div>
        </Section>

        {/* Prereq / Outputs */}
        <div>
          <label className="label">前置条件</label>
          <textarea
            className="input min-h-[40px]"
            value={node.prereq_text || ""}
            onChange={(e) => updateField("prereq_text", e.target.value)}
          />
        </div>
        <div>
          <label className="label">输出物</label>
          <textarea
            className="input min-h-[40px]"
            value={node.outputs_text || ""}
            onChange={(e) => updateField("outputs_text", e.target.value)}
          />
        </div>

        {/* Subtasks — addable list */}
        <Section title="子任务">
          <SubtaskList items={subtasks} onChange={updateSubtasks} />
        </Section>
      </div>

      <NavFooter nodes={nodes} selectedIndex={selectedIndex} onSelect={onSelect} />
    </div>
  );
}

// ================================================================
//  RACI Tag Input
// ================================================================

function RACITagInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  };

  const removeTag = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <span className="text-xs font-medium text-stone-500">{label}</span>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg border border-stone-200 bg-white min-h-[34px]">
        {values.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs"
          >
            {v}
            <button
              onClick={() => removeTag(i)}
              className="hover:text-red-500 font-bold"
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[80px] border-none outline-none bg-transparent text-xs text-stone-700 placeholder:text-stone-300"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder="输入角色后回车"
        />
      </div>
    </div>
  );
}

// ================================================================
//  Subtask List
// ================================================================

function SubtaskList({
  items,
  onChange,
}: {
  items: string[];
  onChange: (list: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addItem = () => {
    const trimmed = input.trim();
    if (trimmed) {
      onChange([...items, trimmed]);
      setInput("");
    }
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-50 text-sm"
        >
          <span className="text-stone-400 text-xs w-5">{i + 1}.</span>
          <span className="flex-1 text-stone-700">{item}</span>
          <button
            onClick={() => removeItem(i)}
            className="text-xs text-red-400 hover:text-red-600"
            type="button"
          >
            删除
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="输入子任务后回车添加"
        />
        <button
          type="button"
          onClick={addItem}
          className="btn-secondary text-xs px-3"
        >
          添加
        </button>
      </div>
    </div>
  );
}

// ================================================================
//  Shared helpers
// ================================================================

function NavFooter({
  nodes,
  selectedIndex,
  onSelect,
}: {
  nodes: FlowNode[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 border-t border-stone-100">
      <button
        disabled={selectedIndex <= 0}
        onClick={() => onSelect(selectedIndex - 1)}
        className="text-sm text-brand-600 disabled:text-stone-300 disabled:cursor-not-allowed"
      >
        ← 上一节点
      </button>
      <span className="text-xs text-stone-400">
        {selectedIndex + 1} / {nodes.length}
      </span>
      <button
        disabled={selectedIndex >= nodes.length - 1}
        onClick={() => onSelect(selectedIndex + 1)}
        className="text-sm text-brand-600 disabled:text-stone-300 disabled:cursor-not-allowed"
      >
        下一节点 →
      </button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
        {title}
      </span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function parseJSON<T>(s: string): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function buildDurationText(node: FlowNode): string {
  const unit = node.duration_unit === "HOUR" ? "小时" : "天";
  if (node.duration_min != null && node.duration_max != null) {
    return `${node.duration_min} ~ ${node.duration_max} ${unit}`;
  }
  if (node.duration_min != null) return `≥ ${node.duration_min} ${unit}`;
  if (node.duration_max != null) return `≤ ${node.duration_max} ${unit}`;
  return "";
}
