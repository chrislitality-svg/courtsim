"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DynastyShell from "@/components/courtsim/DynastyShell";

type LlmEndpoint = {
  id: string;
  name: string;
  apiBaseUrl: string;
  modelName: string;
  apiFormat: string;
  maxContextTokens: number | null;
  defaultTemperature: number | null;
};

type EmbRow = {
  id: string;
  name: string;
  apiBaseUrl: string;
  modelName: string;
  dimensions: number | null;
};

type Tab = "llm" | "embedding";

export default function ModelsSettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = tabParam === "embedding" ? "embedding" : "llm";

  const setTab = (t: Tab) => {
    router.replace(t === "embedding" ? "/settings/models?tab=embedding" : "/settings/models");
  };

  const [llmList, setLlmList] = useState<LlmEndpoint[]>([]);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmForm, setLlmForm] = useState({
    name: "",
    apiBaseUrl: "https://api.openai.com",
    apiKey: "",
    modelName: "gpt-4o-mini",
    apiFormat: "openai",
  });

  const [embList, setEmbList] = useState<EmbRow[]>([]);
  const [embLoading, setEmbLoading] = useState(true);
  const [embForm, setEmbForm] = useState({
    name: "",
    apiBaseUrl: "https://api.openai.com",
    apiKey: "",
    modelName: "text-embedding-3-small",
  });

  const [msg, setMsg] = useState<string | null>(null);

  const loadLlm = useCallback(async () => {
    const r = await fetch("/api/model/endpoint");
    setLlmList(await r.json());
    setLlmLoading(false);
  }, []);

  const loadEmb = useCallback(async () => {
    const r = await fetch("/api/model/embedding");
    setEmbList(await r.json());
    setEmbLoading(false);
  }, []);

  useEffect(() => {
    loadLlm();
    loadEmb();
  }, [loadLlm, loadEmb]);

  async function addLlm(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await fetch("/api/model/endpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(llmForm),
    });
    if (!r.ok) {
      const j = await r.json();
      setMsg(j.error ?? "保存失败");
      return;
    }
    setLlmForm((f) => ({ ...f, apiKey: "" }));
    await loadLlm();
    setMsg("LLM 端点已保存");
  }

  async function testLlm(id: string) {
    setMsg(null);
    const r = await fetch(`/api/model/endpoint/${id}/test`, { method: "POST" });
    const j = await r.json();
    setMsg(j.ok ? `连通成功：${j.sample}` : `失败：${j.error}`);
  }

  async function removeLlm(id: string) {
    if (!confirm("删除此端点？")) return;
    await fetch(`/api/model/endpoint/${id}`, { method: "DELETE" });
    await loadLlm();
  }

  async function addEmb(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await fetch("/api/model/embedding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(embForm),
    });
    if (!r.ok) {
      const j = await r.json();
      setMsg(j.error ?? "保存失败");
      return;
    }
    setEmbForm((f) => ({ ...f, apiKey: "" }));
    await loadEmb();
    setMsg("Embedding 端点已保存");
  }

  async function testEmb(id: string) {
    setMsg(null);
    const r = await fetch(`/api/model/embedding/${id}/test`, { method: "POST" });
    const j = await r.json();
    setMsg(j.ok ? `维度 ${j.dimensions}` : j.error);
  }

  async function removeEmb(id: string) {
    if (!confirm("删除？")) return;
    await fetch(`/api/model/embedding/${id}`, { method: "DELETE" });
    await loadEmb();
  }

  const field =
    "rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] px-3 py-2 text-sm text-[var(--cs-ink)]";

  return (
    <DynastyShell dynastyId={null}>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <nav className="cs-nav mb-6 text-sm text-[var(--cs-ink-faint)]">
          <Link href="/" className="text-[var(--cs-link)]">
            首页
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--cs-ink)]">模型设置</span>
        </nav>

        <h1 className="text-2xl font-medium tracking-tight text-[var(--cs-ink)]">
          模型设置
        </h1>
        <p className="mt-2 text-sm text-[var(--cs-ink-muted)]">
          对话用 <strong>LLM 端点</strong> 与 RAG 用 <strong>Embedding 端点</strong>{" "}
          在同一页配置。生产环境请配置{" "}
          <code className="rounded border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-1 text-[var(--cs-ink)]">
            ENCRYPTION_KEY
          </code>
          。
        </p>

        <div className="mt-6 flex gap-1 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] p-1">
          <button
            type="button"
            onClick={() => setTab("llm")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "llm"
                ? "bg-[var(--cs-paper-elevated)] text-[var(--cs-ink)]"
                : "text-[var(--cs-ink-muted)] hover:text-[var(--cs-ink)]"
            }`}
          >
            LLM 端点
          </button>
          <button
            type="button"
            onClick={() => setTab("embedding")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "embedding"
                ? "bg-[var(--cs-paper-elevated)] text-[var(--cs-ink)]"
                : "text-[var(--cs-ink-muted)] hover:text-[var(--cs-ink)]"
            }`}
          >
            Embedding 端点
          </button>
        </div>

        {msg && (
          <p className="mt-4 text-sm text-[var(--cs-warn)]">{msg}</p>
        )}

      {tab === "llm" && (
        <>
          <form onSubmit={addLlm} className="cs-surface mt-8 space-y-4 p-6">
            <div>
              <label className="text-xs font-medium text-[var(--cs-ink-faint)]">名称</label>
              <input className={`mt-1 w-full ${field}`}
                value={llmForm.name}
                onChange={(e) => setLlmForm({ ...llmForm, name: e.target.value })}
                required
                placeholder="例如：我的 OpenAI"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--cs-ink-faint)]">API Base URL</label>
              <input className={`mt-1 w-full ${field}`}
                value={llmForm.apiBaseUrl}
                onChange={(e) =>
                  setLlmForm({ ...llmForm, apiBaseUrl: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--cs-ink-faint)]">API Key</label>
              <input className={`mt-1 w-full ${field}`}
                type="password"
                value={llmForm.apiKey}
                onChange={(e) =>
                  setLlmForm({ ...llmForm, apiKey: e.target.value })
                }
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--cs-ink-faint)]">模型名</label>
              <input className={`mt-1 w-full ${field}`}
                value={llmForm.modelName}
                onChange={(e) =>
                  setLlmForm({ ...llmForm, modelName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--cs-ink-faint)]">格式</label>
              <select className={`mt-1 w-full ${field}`}
                value={llmForm.apiFormat}
                onChange={(e) =>
                  setLlmForm({ ...llmForm, apiFormat: e.target.value })
                }
              >
                <option value="openai">openai（兼容 /v1/chat/completions）</option>
                <option value="anthropic">anthropic（/v1/messages）</option>
              </select>
            </div>
            <button type="submit" className="cs-btn-primary px-4 py-2 text-sm font-medium">
              添加端点
            </button>
          </form>

          <ul className="mt-10 space-y-3">
            {llmLoading ? (
              <li className="text-sm text-[var(--cs-ink-faint)]">加载中…</li>
            ) : llmList.length === 0 ? (
              <li className="text-sm text-[var(--cs-ink-faint)]">暂无端点</li>
            ) : (
              llmList.map((ep) => (
                <li
                  key={ep.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-[var(--cs-ink)]">{ep.name}</div>
                    <div className="text-xs text-[var(--cs-ink-faint)]">
                      {ep.modelName} · {ep.apiFormat} · {ep.apiBaseUrl}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="cs-btn-secondary rounded-md px-3 py-1 text-xs"
                      onClick={() => testLlm(ep.id)}
                    >
                      测试
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-[var(--cs-danger)] bg-[var(--cs-paper-elevated)] px-3 py-1 text-xs text-[var(--cs-danger)] hover:bg-[var(--cs-accent-soft)]"
                      onClick={() => removeLlm(ep.id)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      )}

      {tab === "embedding" && (
        <>
          <p className="mt-6 text-sm text-[var(--cs-ink-muted)]">
            OpenAI 兼容{" "}
            <code className="rounded border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-1 text-[var(--cs-ink)]">
              /v1/embeddings
            </code>
            ，用于史料分块向量化与 RAG。
          </p>
          <form onSubmit={addEmb} className="cs-surface mt-6 space-y-4 p-6">
            <input className={`w-full ${field}`}
              placeholder="名称"
              value={embForm.name}
              onChange={(e) => setEmbForm({ ...embForm, name: e.target.value })}
              required
            />
            <input
              className={`w-full ${field}`}
              placeholder="API Base URL"
              value={embForm.apiBaseUrl}
              onChange={(e) =>
                setEmbForm({ ...embForm, apiBaseUrl: e.target.value })
              }
              required
            />
            <input
              type="password"
              className={`w-full ${field}`}
              placeholder="API Key"
              value={embForm.apiKey}
              onChange={(e) =>
                setEmbForm({ ...embForm, apiKey: e.target.value })
              }
              required
              autoComplete="off"
            />
            <input className={`w-full ${field}`} placeholder="模型名"
              value={embForm.modelName}
              onChange={(e) =>
                setEmbForm({ ...embForm, modelName: e.target.value })
              }
              required
            />
            <button type="submit" className="cs-btn-primary px-4 py-2 text-sm">
              添加 Embedding 端点
            </button>
          </form>

          <ul className="mt-10 space-y-3">
            {embLoading ? (
              <li className="text-sm text-[var(--cs-ink-faint)]">加载中…</li>
            ) : (
              embList.map((ep) => (
                <li
                  key={ep.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-[var(--cs-ink)]">{ep.name}</div>
                    <div className="text-xs text-[var(--cs-ink-faint)]">
                      {ep.modelName} · {ep.apiBaseUrl}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="cs-btn-secondary rounded-md px-3 py-1 text-xs"
                      onClick={() => testEmb(ep.id)}
                    >
                      测试
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-[var(--cs-danger)] bg-[var(--cs-paper-elevated)] px-3 py-1 text-xs text-[var(--cs-danger)] hover:bg-[var(--cs-accent-soft)]"
                      onClick={() => removeEmb(ep.id)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      )}
      </div>
    </DynastyShell>
  );
}
