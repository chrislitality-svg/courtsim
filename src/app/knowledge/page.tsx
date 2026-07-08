"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import DynastyShell from "@/components/courtsim/DynastyShell";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  _count?: { scenarios: number; collections: number };
};

type CollectionRow = {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  project: { id: string; name: string } | null;
  _count?: { sources: number };
};

type SourceRow = {
  id: string;
  title: string;
  type: string;
  totalChunks: number;
  createdAt: string;
  collectionId: string | null;
  collection: {
    id: string;
    name: string;
    project: { id: string; name: string } | null;
  } | null;
  linkedScenarios: { id: string; name: string; projectId: string | null }[];
};

export default function KnowledgeListPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  /** 全部分组（用于文档「移动到分组」下拉，不受左侧筛选影响） */
  const [allCollections, setAllCollections] = useState<CollectionRow[]>([]);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [embeddings, setEmbeddings] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [epId, setEpId] = useState("");
  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterCollectionId, setFilterCollectionId] = useState<string>("");

  const [newProjectName, setNewProjectName] = useState("");
  const [newCollName, setNewCollName] = useState("");
  const [newCollProjectId, setNewCollProjectId] = useState("");

  const loadProjects = useCallback(() => {
    fetch("/api/project")
      .then((r) => r.json())
      .then(setProjects);
  }, []);

  const loadAllCollections = useCallback(() => {
    fetch("/api/knowledge/collection")
      .then((r) => r.json())
      .then(setAllCollections);
  }, []);

  const loadCollections = useCallback(() => {
    const q =
      filterProjectId ? `?projectId=${encodeURIComponent(filterProjectId)}` : "";
    fetch(`/api/knowledge/collection${q}`)
      .then((r) => r.json())
      .then(setCollections);
  }, [filterProjectId]);

  const loadSources = useCallback(() => {
    const p = new URLSearchParams();
    if (filterCollectionId) p.set("collectionId", filterCollectionId);
    else if (filterProjectId) p.set("projectId", filterProjectId);
    const qs = p.toString();
    fetch(`/api/knowledge${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then(setRows);
  }, [filterProjectId, filterCollectionId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadAllCollections();
  }, [loadAllCollections]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    fetch("/api/model/embedding")
      .then((r) => r.json())
      .then((x: { id: string; name: string }[]) =>
        setEmbeddings(x.map((e) => ({ id: e.id, name: e.name }))),
      );
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;
    const r = await fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) {
      alert((await r.json()).error ?? "失败");
      return;
    }
    setNewProjectName("");
    loadProjects();
    loadAllCollections();
  }

  async function deleteProject(id: string) {
    if (!confirm("删除项目？关联场景的 projectId 将清空。")) return;
    await fetch(`/api/project/${id}`, { method: "DELETE" });
    if (filterProjectId === id) setFilterProjectId("");
    loadProjects();
    loadCollections();
    loadSources();
  }

  async function createCollection(e: React.FormEvent) {
    e.preventDefault();
    const name = newCollName.trim();
    if (!name) return;
    const r = await fetch("/api/knowledge/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        projectId: newCollProjectId || null,
      }),
    });
    if (!r.ok) {
      alert((await r.json()).error ?? "失败");
      return;
    }
    setNewCollName("");
    loadCollections();
    loadAllCollections();
  }

  async function deleteCollection(id: string) {
    const r = await fetch(`/api/knowledge/collection/${id}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      alert((await r.json()).error ?? "无法删除");
      return;
    }
    if (filterCollectionId === id) setFilterCollectionId("");
    loadCollections();
    loadAllCollections();
    loadSources();
  }

  async function process(id: string) {
    if (!epId) {
      alert("请选择 Embedding 端点");
      return;
    }
    setBusy(id);
    try {
      const r = await fetch(`/api/knowledge/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeddingEndpointId: epId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "失败");
      loadSources();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("删除该史料及全部分块？")) return;
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    loadSources();
  }

  async function setSourceCollection(sourceId: string, collectionId: string) {
    const r = await fetch(`/api/knowledge/${sourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collectionId: collectionId || null,
      }),
    });
    if (!r.ok) alert((await r.json()).error ?? "失败");
    loadSources();
    loadCollections();
    loadAllCollections();
  }

  const filteredCollections =
    filterProjectId === ""
      ? collections
      : collections.filter((c) => c.projectId === filterProjectId);

  return (
    <DynastyShell dynastyId={null}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <nav className="cs-nav mb-6 text-sm text-[var(--cs-ink-faint)]">
          <Link href="/" className="text-[var(--cs-link)]">
            首页
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--cs-ink)]">史料库</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium text-[var(--cs-ink)]">史料知识库</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--cs-ink-muted)]">
              按<strong>项目</strong>与<strong>分组（Collection）</strong>管理文档，类似
              Agent
              知识库；文档可关联到具体场景（创建向导第 6 步多选），此处展示已连接的场景链接。
            </p>
          </div>
          <Link href="/knowledge/upload" className="cs-btn-primary px-4 py-2 text-sm">
            上传文档
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-start">
          <aside className="space-y-6 lg:col-span-4">
            <section className="cs-surface p-4">
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--cs-ink-faint)]">
                项目
              </h2>
              <p className="mt-1 text-xs text-[var(--cs-ink-faint)]">
                场景可归属同一项目；史料分组也可挂到项目下，便于课题隔离。
              </p>
              <form onSubmit={createProject} className="mt-3 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] px-2 py-1.5 text-sm text-[var(--cs-ink)]"
                  placeholder="新项目名"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
                <button type="submit" className="cs-btn-primary px-3 py-1.5 text-xs">
                  添加
                </button>
              </form>
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterProjectId("");
                      setFilterCollectionId("");
                    }}
                    className={`w-full rounded-md px-2 py-1 text-left hover:bg-[var(--cs-accent-soft)] ${
                      filterProjectId === "" && filterCollectionId === ""
                        ? "bg-[var(--cs-accent-soft)] font-medium text-[var(--cs-ink)]"
                        : ""
                    }`}
                  >
                    全部文档
                  </button>
                </li>
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-1 rounded-md px-2 py-1 hover:bg-[var(--cs-accent-soft)]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFilterProjectId(p.id);
                        setFilterCollectionId("");
                      }}
                      className={`min-w-0 flex-1 truncate text-left ${
                        filterProjectId === p.id && !filterCollectionId
                          ? "font-medium text-[var(--cs-link)]"
                          : ""
                      }`}
                    >
                      {p.name}
                      {p._count != null && (
                        <span className="ml-1 text-xs text-[var(--cs-ink-faint)]">
                          ({p._count.scenarios} 场景 / {p._count.collections} 分组)
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-[var(--cs-danger)]"
                      onClick={() => deleteProject(p.id)}
                    >
                      删
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="cs-surface p-4">
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--cs-ink-faint)]">
                知识分组
              </h2>
              <form onSubmit={createCollection} className="mt-3 space-y-2">
                <input
                  className="w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] px-2 py-1.5 text-sm text-[var(--cs-ink)]"
                  placeholder="分组名称"
                  value={newCollName}
                  onChange={(e) => setNewCollName(e.target.value)}
                />
                <select
                  className="w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] px-2 py-1.5 text-sm text-[var(--cs-ink)]"
                  value={newCollProjectId}
                  onChange={(e) => setNewCollProjectId(e.target.value)}
                >
                  <option value="">（可选）归属项目</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="cs-btn-secondary w-full rounded-lg py-1.5 text-sm"
                >
                  新建分组
                </button>
              </form>
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
                {filteredCollections.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-2 rounded-md px-2 py-1 hover:bg-[var(--cs-accent-soft)]"
                  >
                    <button
                      type="button"
                      onClick={() => setFilterCollectionId(c.id)}
                      className={`min-w-0 flex-1 text-left ${
                        filterCollectionId === c.id
                          ? "font-medium text-[var(--cs-link)]"
                          : ""
                      }`}
                    >
                      {c.name}
                      {c.project && (
                        <span className="block truncate text-xs text-[var(--cs-ink-faint)]">
                          项目：{c.project.name}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-[var(--cs-danger)]"
                      onClick={() => deleteCollection(c.id)}
                    >
                      删
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </aside>

          <main className="lg:col-span-8">
            <div className="cs-surface p-4">
              <p className="text-xs text-[var(--cs-ink-muted)]">
                处理前请在{" "}
                <Link
                  href="/settings/models?tab=embedding"
                  className="text-[var(--cs-link)] underline"
                >
                  模型设置 → Embedding
                </Link>{" "}
                配置端点；仅支持 .txt / .md。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-xs text-[var(--cs-ink-faint)]">批量处理用端点：</label>
                <select
                  className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] px-2 py-1 text-sm text-[var(--cs-ink)]"
                  value={epId}
                  onChange={(e) => setEpId(e.target.value)}
                >
                  <option value="">选择…</option>
                  {embeddings.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              {(filterProjectId || filterCollectionId) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {filterCollectionId && (
                    <span className="rounded-full border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-2 py-0.5 text-[var(--cs-ink)]">
                      分组筛选中
                      <button
                        type="button"
                        className="ml-1 underline"
                        onClick={() => setFilterCollectionId("")}
                      >
                        清除
                      </button>
                    </span>
                  )}
                  {filterProjectId && !filterCollectionId && (
                    <span className="rounded-full border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-2 py-0.5 text-[var(--cs-ink)]">
                      按项目筛选
                      <button
                        type="button"
                        className="ml-1 underline"
                        onClick={() => setFilterProjectId("")}
                      >
                        清除
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            <ul className="mt-6 space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="cs-surface px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--cs-ink)]">{r.title}</div>
                      <div className="mt-1 text-xs text-[var(--cs-ink-faint)]">
                        {r.type} · {r.totalChunks} 块 ·{" "}
                        {new Date(r.createdAt).toLocaleString("zh-CN")}
                      </div>
                      {r.collection && (
                        <div className="mt-1 text-xs text-[var(--cs-link)]">
                          分组：{r.collection.name}
                          {r.collection.project && (
                            <span className="text-[var(--cs-ink-muted)]">
                              {" "}
                              · 项目 {r.collection.project.name}
                            </span>
                          )}
                        </div>
                      )}
                      {r.linkedScenarios.length > 0 && (
                        <div className="mt-2 text-xs text-[var(--cs-ink-muted)]">
                          已关联场景：
                          {r.linkedScenarios.map((sc, i) => (
                            <span key={sc.id}>
                              {i > 0 ? " · " : " "}
                              <Link
                                href={`/scenario/${sc.id}`}
                                className="text-[var(--cs-link)] underline"
                              >
                                {sc.name}
                              </Link>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="max-w-[140px] rounded-md border border-[var(--cs-border)] bg-[var(--cs-paper)] px-2 py-1 text-xs text-[var(--cs-ink)]"
                        value={r.collectionId ?? ""}
                        onChange={(e) =>
                          setSourceCollection(r.id, e.target.value)
                        }
                        title="移动到分组"
                      >
                        <option value="">未分组</option>
                        {allCollections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.project ? `${c.project.name} / ` : ""}
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <Link
                        href={`/knowledge/${r.id}`}
                        className="cs-btn-secondary rounded-md px-3 py-1 text-xs"
                      >
                        详情
                      </Link>
                      <button
                        type="button"
                        disabled={busy === r.id || !epId}
                        className="cs-btn-primary rounded-md px-3 py-1 text-xs disabled:opacity-50"
                        onClick={() => process(r.id)}
                      >
                        {busy === r.id ? "处理中…" : "分块+向量化"}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-[var(--cs-danger)] bg-[var(--cs-paper-elevated)] px-3 py-1 text-xs text-[var(--cs-danger)] hover:bg-[var(--cs-accent-soft)]"
                        onClick={() => remove(r.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {rows.length === 0 && (
              <p className="mt-8 text-sm text-[var(--cs-ink-faint)]">暂无史料，请先上传。</p>
            )}
          </main>
        </div>
      </div>
    </DynastyShell>
  );
}
