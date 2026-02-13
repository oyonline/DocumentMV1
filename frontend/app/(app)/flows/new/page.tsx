"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFlow } from "@/lib/api";

export default function NewFlowPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [ownerDeptId, setOwnerDeptId] = useState("");
  const [overview, setOverview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("请输入流程标题");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const flow = await createFlow({
        title: title.trim(),
        owner_dept_id: ownerDeptId.trim(),
        overview: overview.trim(),
      });
      router.push(`/flows/${flow.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">新建流程</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label">流程标题 *</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：新员工入职流程"
          />
        </div>

        <div>
          <label className="label">负责部门</label>
          <input
            className="input"
            value={ownerDeptId}
            onChange={(e) => setOwnerDeptId(e.target.value)}
            placeholder="例如：人力资源部"
          />
        </div>

        <div>
          <label className="label">概述</label>
          <textarea
            className="input min-h-[100px]"
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            placeholder="简述该流程的目标与范围"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "创建中…" : "创建草稿"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
