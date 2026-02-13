"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth";
import {
  getNode,
  updateNode,
  APIError,
  type NodeInput,
  type RACI,
  type DiagramJSON,
} from "@/lib/api";

// ---------- Constants ----------

const EXEC_FORM_OPTIONS = [
  { value: "", label: "请选择" },
  { value: "MANUAL", label: "人工执行" },
  { value: "AUTOMATIC", label: "自动执行" },
  { value: "DECISION", label: "决策节点" },
  { value: "REVIEW", label: "审批节点" },
];

const DURATION_UNIT_OPTIONS = [
  { value: "MINUTE", label: "分钟" },
  { value: "HOUR", label: "小时" },
  { value: "DAY", label: "天" },
  { value: "WEEK", label: "周" },
];

const RACI_KEYS = ["R", "A", "S", "C", "I"] as const;
const RACI_LABELS: Record<string, string> = {
  R: "负责 (R)",
  A: "审批 (A)",
  S: "支持 (S)",
  C: "咨询 (C)",
  I: "知会 (I)",
};

// ---------- Helpers ----------

function emptyRaci(): RACI {
  return { R: [], A: [], S: [], C: [], I: [] };
}

function emptyDiagram(): DiagramJSON {
  return { nodes: [], edges: [] };
}

/** Normalize RACI: ensure all 5 keys exist with array values. */
function normalizeRaci(raci: Partial<RACI> | null | undefined): RACI {
  const result = emptyRaci();
  if (!raci) return result;
  for (const k of RACI_KEYS) {
    if (Array.isArray(raci[k])) {
      result[k] = raci[k] as string[];
    }
  }
  return result;
}

// ---------- Validation ----------

interface FieldErrors {
  [key: string]: string;
}

function validateForm(data: {
  name: string;
  exec_form: string;
  duration_min: string;
  duration_max: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (!data.name.trim()) {
    errors.name = "节点名称不能为空";
  }

  if (!data.exec_form) {
    errors.exec_form = "请选择执行形式";
  }

  const minStr = data.duration_min.trim();
  const maxStr = data.duration_max.trim();

  if (minStr !== "") {
    const minVal = Number(minStr);
    if (isNaN(minVal)) {
      errors.duration_min = "请输入数字";
    } else if (minVal < 0) {
      errors.duration_min = "不能为负数";
    }
  }

  if (maxStr !== "") {
    const maxVal = Number(maxStr);
    if (isNaN(maxVal)) {
      errors.duration_max = "请输入数字";
    } else if (maxVal < 0) {
      errors.duration_max = "不能为负数";
    }
  }

  if (minStr !== "" && maxStr !== "" && !errors.duration_min && !errors.duration_max) {
    if (Number(minStr) > Number(maxStr)) {
      errors.duration = "最短耗时不能大于最长耗时";
    }
  }

  return errors;
}

// ---------- Field error labels for backend errors ----------

const FIELD_ERROR_LABELS: Record<string, string> = {
  required: "必填",
  invalid_enum: "值不合法",
  min_gt_max: "最短耗时不能大于最长耗时",
  must_be_non_negative: "不能为负数",
  missing_key: "缺少必要字段",
};

function formatFieldError(field: string, reason: string): string {
  const label = FIELD_ERROR_LABELS[reason] || reason;
  return `${field}: ${label}`;
}

// ---------- Component ----------

export default function EditNodePage() {
  const { loading: authLoading } = useRequireAuth();
  const params = useParams<{ id: string; nodeId: string }>();
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [execForm, setExecForm] = useState("");
  const [description, setDescription] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [outputs, setOutputs] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [durationMax, setDurationMax] = useState("");
  const [durationUnit, setDurationUnit] = useState("DAY");
  const [raci, setRaci] = useState<RACI>(emptyRaci());
  const [raciInputs, setRaciInputs] = useState<Record<string, string>>({
    R: "", A: "", S: "", C: "", I: "",
  });
  const [subtasksText, setSubtasksText] = useState("");

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Load existing node
  useEffect(() => {
    if (authLoading || !params.nodeId) return;

    getNode(params.nodeId)
      .then((node) => {
        setName(node.name);
        setExecForm(node.exec_form);
        setDescription(node.description);
        setPreconditions(node.preconditions);
        setOutputs(node.outputs);
        setDurationMin(node.duration_min != null ? String(node.duration_min) : "");
        setDurationMax(node.duration_max != null ? String(node.duration_max) : "");
        setDurationUnit(node.duration_unit || "DAY");
        setRaci(normalizeRaci(node.raci));
        setSubtasksText((node.subtasks || []).join("\n"));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authLoading, params.nodeId]);

  // RACI tag management
  function addRaciTag(key: string) {
    const val = raciInputs[key]?.trim();
    if (!val) return;
    if (raci[key as keyof RACI].includes(val)) return;
    setRaci((prev) => ({ ...prev, [key]: [...prev[key as keyof RACI], val] }));
    setRaciInputs((prev) => ({ ...prev, [key]: "" }));
  }

  function removeRaciTag(key: string, idx: number) {
    setRaci((prev) => ({
      ...prev,
      [key]: prev[key as keyof RACI].filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    // Front-end validation
    const errs = validateForm({ name, exec_form: execForm, duration_min: durationMin, duration_max: durationMax });
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);

    // Build payload with normalisation
    const normalizedRaci = normalizeRaci(raci);
    const subtasks = subtasksText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: NodeInput = {
      name: name.trim(),
      exec_form: execForm,
      description,
      preconditions,
      outputs,
      duration_min: durationMin.trim() !== "" ? Number(durationMin) : null,
      duration_max: durationMax.trim() !== "" ? Number(durationMax) : null,
      duration_unit: durationUnit,
      raci: normalizedRaci,
      subtasks,
      diagram_json: emptyDiagram(),
    };

    if (process.env.NODE_ENV === "development") {
      console.log("[Node Save] payload:", payload);
    }

    try {
      await updateNode(params.nodeId, payload);
      router.push(`/docs/${params.id}`);
    } catch (err: unknown) {
      if (err instanceof APIError) {
        setError(err.message);
        if (err.fields) {
          setFieldErrors(err.fields);
        }
        if (process.env.NODE_ENV === "development") {
          console.warn("[Node Save Error]", { requestId: err.requestId, fields: err.fields, payload });
        }
      } else {
        setError(err instanceof Error ? err.message : "保存失败");
      }
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-stone-900 mb-6">编辑节点</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Global error */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
            <p>{error}</p>
            {/* Field-level errors from backend */}
            {Object.keys(fieldErrors).length > 0 && (
              <ul className="mt-2 list-disc list-inside">
                {Object.entries(fieldErrors).map(([field, reason]) => (
                  <li key={field}>{formatFieldError(field, reason)}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="label">节点名称 *</label>
          <input
            id="name"
            className={`input ${fieldErrors.name ? "border-red-400" : ""}`}
            placeholder="输入节点名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
          )}
        </div>

        {/* Exec Form */}
        <div>
          <label htmlFor="exec_form" className="label">执行形式 *</label>
          <select
            id="exec_form"
            className={`input ${fieldErrors.exec_form ? "border-red-400" : ""}`}
            value={execForm}
            onChange={(e) => setExecForm(e.target.value)}
          >
            {EXEC_FORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {fieldErrors.exec_form && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.exec_form}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="label">说明</label>
          <textarea
            id="description"
            className="input min-h-[80px] resize-y"
            placeholder="节点说明（可选）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Duration */}
        <div>
          <label className="label">耗时范围</label>
          <div className="flex items-center gap-2">
            <input
              className={`input w-28 ${fieldErrors.duration_min || fieldErrors.duration ? "border-red-400" : ""}`}
              placeholder="最短"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
            <span className="text-stone-400">~</span>
            <input
              className={`input w-28 ${fieldErrors.duration_max || fieldErrors.duration ? "border-red-400" : ""}`}
              placeholder="最长"
              value={durationMax}
              onChange={(e) => setDurationMax(e.target.value)}
            />
            <select
              className="input w-24"
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value)}
            >
              {DURATION_UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {(fieldErrors.duration_min || fieldErrors.duration_max || fieldErrors.duration) && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.duration || fieldErrors.duration_min || fieldErrors.duration_max}
            </p>
          )}
        </div>

        {/* Preconditions */}
        <div>
          <label htmlFor="preconditions" className="label">前置条件</label>
          <textarea
            id="preconditions"
            className="input min-h-[60px] resize-y"
            placeholder="前置条件（可选）"
            value={preconditions}
            onChange={(e) => setPreconditions(e.target.value)}
          />
        </div>

        {/* Outputs */}
        <div>
          <label htmlFor="outputs" className="label">输出物</label>
          <textarea
            id="outputs"
            className="input min-h-[60px] resize-y"
            placeholder="输出物（可选）"
            value={outputs}
            onChange={(e) => setOutputs(e.target.value)}
          />
        </div>

        {/* RACI Panel */}
        <div>
          <label className="label">RACI(S) 矩阵</label>
          <div className="space-y-3 rounded-lg border border-stone-200 p-4 bg-stone-50">
            {RACI_KEYS.map((key) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-stone-600 w-20">
                    {RACI_LABELS[key]}
                  </span>
                  <input
                    className="input flex-1 text-sm"
                    placeholder="输入人员名称后回车"
                    value={raciInputs[key]}
                    onChange={(e) =>
                      setRaciInputs((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRaciTag(key);
                      }
                    }}
                  />
                </div>
                {raci[key].length > 0 && (
                  <div className="flex flex-wrap gap-1 ml-20">
                    {raci[key].map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700"
                      >
                        {tag}
                        <button
                          type="button"
                          className="hover:text-red-600"
                          onClick={() => removeRaciTag(key, idx)}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <label htmlFor="subtasks" className="label">子任务</label>
          <textarea
            id="subtasks"
            className="input min-h-[80px] resize-y font-mono text-sm"
            placeholder="每行一个子任务（可选）"
            value={subtasksText}
            onChange={(e) => setSubtasksText(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-stone-400">* 为必填项</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.back()}
            >
              取消
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
