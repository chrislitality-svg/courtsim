"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DynastyShell from "@/components/courtsim/DynastyShell";

type CollOpt = {
  id: string;
  name: string;
  project: { name: string } | null;
};

export default function KnowledgeUploadPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollOpt[]>([]);

  useEffect(() => {
    fetch("/api/knowledge/collection")
      .then((r) => r.json())
      .then((rows: CollOpt[]) => setCollections(rows));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "上传失败");
      router.push("/knowledge");
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] px-3 py-2 text-sm text-[var(--cs-ink)]";

  return (
    <DynastyShell dynastyId={null}>
      <div className="mx-auto max-w-lg px-4 py-10">
        <nav className="cs-nav mb-6 text-sm text-[var(--cs-ink-faint)]">
          <Link href="/knowledge" className="text-[var(--cs-link)]">
            史料库
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--cs-ink)]">上传</span>
        </nav>
        <h1 className="text-xl font-medium text-[var(--cs-ink)]">上传史料</h1>
        {err && <p className="mt-4 text-sm text-[var(--cs-danger)]">{err}</p>}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-xs text-[var(--cs-ink-faint)]">标题 *</label>
          <input name="title" required className={`mt-1 w-full ${field}`} />
        </div>
        <div>
          <label className="text-xs text-[var(--cs-ink-faint)]">类型</label>
          <select name="type" className={`mt-1 w-full ${field}`}
            defaultValue="其他"
          >
            <option value="正史">正史</option>
            <option value="笔记">笔记</option>
            <option value="实录">实录</option>
            <option value="奏疏">奏疏</option>
            <option value="方志">方志</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--cs-ink-faint)]">作者</label>
          <input name="author" className={`mt-1 w-full ${field}`} />
        </div>
        <div>
          <label className="text-xs text-[var(--cs-ink-faint)]">归入分组（可选）</label>
          <select name="collectionId" className={`mt-1 w-full ${field}`}
            defaultValue=""
          >
            <option value="">未分组</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.project ? `${c.project.name} / ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--cs-ink-faint)]">朝代标签</label>
          <input
            name="dynasty"
            placeholder="如 ming"
            className={`mt-1 w-full ${field}`}
          />
        </div>
        <div>
          <label className="text-xs text-[var(--cs-ink-faint)]">文件 (.txt / .md) *</label>
          <input
            name="file"
            type="file"
            required
            accept=".txt,.md,text/plain,text/markdown"
            className="mt-1 w-full text-sm text-[var(--cs-ink-muted)]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="cs-btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "上传中…" : "提交"}
        </button>
        </form>
      </div>
    </DynastyShell>
  );
}
