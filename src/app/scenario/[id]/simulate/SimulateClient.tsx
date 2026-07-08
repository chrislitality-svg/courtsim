"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import DynastyShell from "@/components/courtsim/DynastyShell";
import FormationBoard from "@/components/courtsim/FormationBoard";
import { formatIdentityDetails } from "@/lib/character-identity-display";
import type { CourtFormation } from "@/lib/court-formation";
import { humanSceneLabel } from "@/lib/scene-display";
import { dynastyThemeLabel } from "@/lib/dynasty-theme";
import { readApiJson } from "@/lib/read-api-json";

type SpeechRow = {
  id: string;
  innerMonologue: string;
  publicSpeech: string;
  strategyNote: string | null;
  sourceRefs: string | null;
  dialogueMeta: string | null;
  userDirective?: string | null;
  character: { id: string; name: string };
};

type RoundRow = {
  id: string;
  roundNumber: number;
  summary: string | null;
  politicalState?: string | null;
  speeches: SpeechRow[];
};

type SimPayload = {
  id: string;
  status: string;
  currentRound: number;
  totalTokens: number;
  chapterReport?: string | null;
  scenario: {
    id: string;
    name: string;
    dynastyId: string;
    sceneType: string;
    courtFormation?: string | null;
    protagonistCharacterId?: string | null;
    rules: string;
    background?: string | null;
    characters?: { id: string; name: string; identity: string }[];
  };
  rounds: RoundRow[];
};

function formatPoliticalStateUi(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.stringify(JSON.parse(raw) as object, null, 2);
  } catch {
    return raw;
  }
}

function parseDialogueMeta(
  raw: string | null,
): {
  relationToPrevious?: string;
  targets?: string[];
  towardAuthority?: string | null;
  note?: string;
} | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      relationToPrevious?: string;
      targets?: string[];
      towardAuthority?: string | null;
      note?: string;
    };
  } catch {
    return null;
  }
}

function parseSourceRefs(raw: string | null): {
  chunks?: {
    sourceTitle: string;
    chunkIndex: number;
    score: number;
    excerpt: string;
  }[];
} | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      chunks?: {
        sourceTitle: string;
        chunkIndex: number;
        score: number;
        excerpt: string;
      }[];
    };
  } catch {
    return null;
  }
}

function parseRules(rules: string): { max_rounds: number; speaking_order: string } {
  try {
    const o = JSON.parse(rules) as Record<string, unknown>;
    return {
      max_rounds: typeof o.max_rounds === "number" ? o.max_rounds : 10,
      speaking_order: String(o.speaking_order ?? "hierarchical"),
    };
  } catch {
    return { max_rounds: 10, speaking_order: "hierarchical" };
  }
}

function speakingOrderLabel(mode: string): string {
  if (mode === "free") return "轮转发言";
  return "品级序";
}

type LiveProgress = {
  characterName: string;
  index: number;
  total: number;
  roundNumber: number;
};

type LiveSpeechPreview = {
  characterName: string;
  innerMonologue: string;
  publicSpeech: string;
  roundNumber: number;
};

export default function SimulateClient({ scenarioId }: { scenarioId: string }) {
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [sim, setSim] = useState<SimPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveTail, setLiveTail] = useState<string[]>([]);
  const [chapterBusy, setChapterBusy] = useState(false);
  const [formation, setFormation] = useState<CourtFormation | null>(null);
  const [rosterChars, setRosterChars] = useState<
    { id: string; name: string; identity: string }[]
  >([]);
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [liveSpeechPreview, setLiveSpeechPreview] = useState<LiveSpeechPreview | null>(
    null,
  );
  const [directiveDrafts, setDirectiveDrafts] = useState<Record<string, string>>({});
  const [closeTopicBusy, setCloseTopicBusy] = useState(false);
  const [assistText, setAssistText] = useState<string | null>(null);
  const [assistTrace, setAssistTrace] = useState<{
    modeLabel: string;
    protagonist: string;
    lastRoundSpeeches: number;
    transcriptPreview: string;
  } | null>(null);
  const [assistBusy, setAssistBusy] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async (sid: string) => {
    const r = await fetch(`/api/simulate/${sid}`);
    const j = await readApiJson<SimPayload & { error?: string }>(r);
    if (!r.ok) throw new Error(j.error ?? `加载推演失败（HTTP ${r.status}）`);
    setSim(j as SimPayload);
  }, []);

  /** SSE / 后台同步用：失败时写入过程区，避免「有生成但主栏空白」却无任何提示 */
  const refreshFromStream = useCallback(
    (sid: string) => {
      void refresh(sid).catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setLiveTail((prev) => [
          ...prev.slice(-80),
          `【同步主栏数据失败】${msg}。发言可能已写入，可尝试刷新浏览器页面。`,
        ]);
      });
    },
    [refresh],
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [fr, sr] = await Promise.all([
          fetch(`/api/scenario/${scenarioId}/formation`),
          fetch(`/api/scenario/${scenarioId}`),
        ]);
        const fj = await readApiJson<{ formation?: CourtFormation; error?: string }>(fr);
        const sj = await readApiJson<{ characters?: unknown[]; error?: string }>(sr);
        if (cancel) return;
        if (!fr.ok) throw new Error(fj.error ?? "加载编组失败");
        if (!sr.ok) throw new Error(sj.error ?? "加载场景失败");
        if (fj.formation) setFormation(fj.formation as CourtFormation);
        const ch = (sj.characters ?? []) as {
          id: string;
          name: string;
          identity: unknown;
        }[];
        setRosterChars(
          ch.map((c) => ({
            id: c.id,
            name: c.name,
            identity:
              typeof c.identity === "object"
                ? JSON.stringify(c.identity)
                : String(c.identity ?? ""),
          })),
        );
      } catch (e) {
        if (!cancel) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [scenarioId]);

  useEffect(() => {
    if (!simulationId) return;
    const es = new EventSource(`/api/simulate/${simulationId}/stream`);
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as Record<string, unknown>;
        const t = data.type as string;

        if (t === "connected") {
          setLiveTail((prev) => [...prev.slice(-60), "已连接实时通道"]);
          return;
        }

        if (t === "speech_progress") {
          setLiveProgress({
            characterName: String(data.characterName ?? ""),
            index: Number(data.index ?? 0),
            total: Number(data.total ?? 0),
            roundNumber: Number(data.roundNumber ?? 0),
          });
          setLiveSpeechPreview(null);
          setLiveTail((prev) => [
            ...prev.slice(-80),
            `【进度】第 ${String(data.index)}/${String(data.total)} 位：${String(data.characterName ?? "")} — 正在生成台词与内心活动…`,
          ]);
          return;
        }

        if (t === "round_roster") {
          const names = (data.characterNames as string[] | undefined) ?? [];
          setLiveTail((prev) => [
            ...prev.slice(-80),
            `【顺序】本轮发言：${names.join(" → ") || "（空）"}`,
          ]);
          return;
        }

        if (t === "speech") {
          const sp = data.speech as {
            characterName?: string;
            innerMonologue?: string;
            publicSpeech?: string;
          };
          setLiveProgress(null);
          setLiveSpeechPreview({
            characterName: String(sp.characterName ?? ""),
            innerMonologue: String(sp.innerMonologue ?? ""),
            publicSpeech: String(sp.publicSpeech ?? ""),
            roundNumber: Number(data.roundNumber ?? 0),
          });
          setLiveTail((prev) => [
            ...prev.slice(-80),
            `【${String(sp.characterName ?? "")}】内心：${String(sp.innerMonologue ?? "").slice(0, 120)}${String(sp.innerMonologue ?? "").length > 120 ? "…" : ""}`,
            `【${String(sp.characterName ?? "")}】台词：${String(sp.publicSpeech ?? "").slice(0, 200)}${String(sp.publicSpeech ?? "").length > 200 ? "…" : ""}`,
          ]);
          refreshFromStream(simulationId);
          return;
        }

        if (t === "round_done" || t === "completed") {
          setLiveProgress(null);
          setLiveSpeechPreview(null);
          setLiveTail((prev) => [...prev.slice(-80), t === "completed" ? "推演已全部结束" : `第 ${String(data.roundNumber ?? "")} 轮已完成`]);
          refreshFromStream(simulationId);
          return;
        }

        if (t === "error") {
          setLiveProgress(null);
          setLiveSpeechPreview(null);
          setLiveTail((prev) => [
            ...prev.slice(-80),
            `错误：${String((data as { message?: string }).message ?? "未知")}`,
          ]);
          refreshFromStream(simulationId);
          return;
        }

        setLiveTail((prev) => [...prev.slice(-80), `[${t}]`]);
        if (t === "status") refreshFromStream(simulationId);
      } catch {
        /* ignore */
      }
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [simulationId, refreshFromStream]);

  async function startNew() {
    setBusy(true);
    setError(null);
    setLiveTail([]);
    try {
      const r = await fetch("/api/simulate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const j = await readApiJson<{ id?: string; error?: string }>(r);
      if (!r.ok) throw new Error(j.error ?? "无法开始");
      setSimulationId(j.id);
      await refresh(j.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function nextRound() {
    if (!simulationId || busy) return;
    setBusy(true);
    setError(null);
    setLiveTail((prev) => [
      ...prev.slice(-80),
      (sim?.currentRound ?? 0) === 0
        ? "【请求】已提交「第 1 轮」：在场角色将按编组顺序依次发言并承接前文，请关注下方进度与右侧「实时过程」。"
        : "【请求】已提交「下一轮」；全场继续按编组顺序依次生成台词，请关注进度与右侧「实时过程」。",
    ]);
    try {
      const r = await fetch(`/api/simulate/${simulationId}/next-round`, {
        method: "POST",
      });
      const j = await readApiJson<{
        ok?: boolean;
        error?: string;
        simulation?: SimPayload;
      }>(r);
      if (!r.ok || j.ok === false) {
        throw new Error(j.error ?? "下一轮失败");
      }
      if (j.simulation) setSim(j.simulation as SimPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!simulationId) return;
    await fetch(`/api/simulate/${simulationId}/pause`, { method: "POST" });
    await refresh(simulationId);
  }

  async function resume() {
    if (!simulationId) return;
    await fetch(`/api/simulate/${simulationId}/resume`, { method: "POST" });
    await refresh(simulationId);
  }

  async function generateChapterReport() {
    if (!simulationId) return;
    setChapterBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/simulate/${simulationId}/chapter-report`, {
        method: "POST",
      });
      const j = await readApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(j.error ?? "生成失败");
      await refresh(simulationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChapterBusy(false);
    }
  }

  async function saveSpeechDirective(speechId: string, directive: string) {
    const r = await fetch(`/api/speech/${speechId}/directive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directive: directive.trim() || null }),
    });
    if (!r.ok) throw new Error("保存批注失败");
    if (simulationId) await refresh(simulationId);
  }

  async function requestCloseTopic() {
    if (!simulationId) return;
    setCloseTopicBusy(true);
    try {
      const r = await fetch(`/api/simulate/${simulationId}/request-close-topic`, {
        method: "POST",
      });
      const j = await readApiJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(j.error ?? "设置失败");
      setError(null);
      setLiveTail((p) => [
        ...p.slice(-80),
        "已标记：下一轮全体收束当前议题并给出结果。",
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCloseTopicBusy(false);
    }
  }

  async function fetchPlayableAssist(mode: "situation" | "draft_line") {
    if (!simulationId) return;
    setAssistBusy(true);
    setError(null);
    setAssistTrace(null);
    setLiveTail((prev) => [
      ...prev.slice(-80),
      mode === "draft_line"
        ? "【幕僚】正在向模型请求「代拟台词」…"
        : "【幕僚】正在向模型请求「局势建议」…",
    ]);
    try {
      const r = await fetch(`/api/simulate/${simulationId}/playable-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const j = await readApiJson<{
        ok?: boolean;
        error?: string;
        text?: string;
        trace?: {
          modeLabel: string;
          protagonist: string;
          lastRoundSpeeches: number;
          transcriptPreview: string;
        };
      }>(r);
      if (!r.ok) throw new Error(j.error ?? "获取失败");
      setAssistText(String(j.text ?? ""));
      setAssistTrace(j.trace ?? null);
      setLiveTail((prev) => [...prev.slice(-80), "【幕僚】模型已返回正文，见下方框内。"]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssistBusy(false);
    }
  }

  const meta = sim ? parseRules(sim.scenario.rules) : null;
  const characters = sim?.scenario.characters ?? rosterChars;
  const protagonistId = sim?.scenario.protagonistCharacterId ?? null;
  const completedRoundCount = sim?.currentRound ?? 0;
  const advanceRoundButtonLabel =
    busy || sim?.status === "running"
      ? "推演中…"
      : completedRoundCount === 0
        ? "开始第 1 轮（全员依次发言）"
        : `下一轮：第 ${completedRoundCount + 1} 轮（全员继续）`;

  return (
    <DynastyShell dynastyId={sim?.scenario.dynastyId ?? null}>
      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <nav className="cs-nav mb-4 text-sm text-[var(--cs-ink-faint)]">
          <Link href="/" className="text-[var(--cs-link)]">
            首页
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/scenario/${scenarioId}`} className="text-[var(--cs-link)]">
            场景
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--cs-ink)]">推演</span>
        </nav>

        <header className="cs-rule-bottom pb-4">
          <h1 className="text-2xl font-medium text-[var(--cs-ink)]">推演观察</h1>
          {sim && (
            <p className="mt-2 text-sm text-[var(--cs-ink-muted)]">
              {sim.scenario.name} · {dynastyThemeLabel(sim.scenario.dynastyId)} ·{" "}
              {humanSceneLabel(sim.scenario.dynastyId, sim.scenario.sceneType)}
            </p>
          )}
        </header>

        <div className="sticky top-0 z-30 mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--cs-border)] bg-[var(--cs-paper)]/95 py-3 backdrop-blur-sm">
          {!simulationId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => startNew()}
              className="cs-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "正在创建会话…" : "① 开始新推演"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={
                  busy ||
                  sim?.status === "running" ||
                  sim?.status === "completed" ||
                  sim?.status === "paused"
                }
                onClick={() => nextRound()}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-[var(--cs-on-accent)] disabled:opacity-50"
                style={{ backgroundColor: "var(--cs-success)" }}
              >
                ② {advanceRoundButtonLabel}
              </button>
              <button
                type="button"
                disabled={sim?.status === "completed" || sim?.status === "running"}
                onClick={() => pause()}
                className="cs-btn-secondary px-3 py-2 text-sm text-[var(--cs-ink-muted)]"
              >
                暂停
              </button>
              <button
                type="button"
                disabled={sim?.status !== "paused"}
                onClick={() => resume()}
                className="cs-btn-secondary px-3 py-2 text-sm text-[var(--cs-ink-muted)]"
              >
                恢复
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSimulationId(null);
                  setSim(null);
                  setLiveTail([]);
                  setAssistText(null);
                  setAssistTrace(null);
                  esRef.current?.close();
                }}
                className="cs-btn-secondary border-[var(--cs-warn)] px-3 py-2 text-sm text-[var(--cs-warn)]"
              >
                结束本会话
              </button>
            </>
          )}
          <span className="max-w-xl text-xs leading-relaxed text-[var(--cs-ink-faint)]">
            {simulationId
              ? "流程：绿钮 = 一整轮朝会（编组内每人依次发言、钩连前文）。「自动起草」只帮主视角拟一句，不代替全场。"
              : "先点「开始新推演」创建会话，再用绿钮开启第 1 轮全场对话。"}
          </span>
        </div>

        {simulationId && (
          <div
            className="mb-4 rounded-lg border border-[var(--cs-border)] px-3 py-2.5 text-xs leading-relaxed text-[var(--cs-ink-muted)]"
            style={{ backgroundColor: "var(--cs-accent-soft)" }}
          >
            <p className="font-medium text-[var(--cs-ink)]">全场互动说明</p>
            <p className="mt-1">
              每点一次顶栏<strong>绿钮</strong>，系统会按左侧「朝堂编组」顺序，让<strong>每一位在场角色</strong>各生成一段公开发言（并承接本轮前文），形成一轮完整对话。
              {completedRoundCount === 0
                ? " 你尚未开局：第一次请点「开始第 1 轮…」，不是只有幕僚条子、也不是底部收束钮。"
                : ` 当前已存档 ${completedRoundCount} 轮；再点绿钮即推进到第 ${completedRoundCount + 1} 轮。`}
            </p>
            <p className="mt-1 text-[var(--cs-ink-faint)]">
              页面最下方的「收束议题」为<strong>可选</strong>：只影响<strong>再下一轮</strong>大家的口径（收口争点），与「开场发言」无关。
            </p>
          </div>
        )}

        {error && (
          <div
            className="mt-4 rounded-lg border px-4 py-2 text-sm"
            style={{
              borderColor: "var(--cs-danger)",
              backgroundColor: "var(--cs-accent-soft)",
              color: "var(--cs-danger)",
            }}
          >
            {error}
          </div>
        )}

        {formation && characters.length > 0 && (
          <div className="mt-6">
            <FormationBoard
              scenarioId={scenarioId}
              characters={characters.map((c) => ({
                id: c.id,
                name: c.name,
                identity: c.identity,
              }))}
              formation={formation}
              onFormationChange={setFormation}
              disabled={sim?.status === "running" || busy}
            />
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:items-start">
          {/* 左：人物档案 */}
          <aside className="cs-surface order-2 p-4 lg:order-1 lg:col-span-3 xl:col-span-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--cs-ink-faint)]">
              人物档案
            </h2>
            {characters.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--cs-ink-faint)]">
                本场景尚未配置人物。
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {characters.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] px-3 py-2"
                  >
                    <div className="whitespace-pre-wrap text-xs text-[var(--cs-ink-muted)]">
                      {formatIdentityDetails(c.identity, c.name)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* 中：控制 + 对话流 */}
          <main className="order-1 lg:order-2 lg:col-span-6 xl:col-span-7 min-w-0">
            <p className="text-xs text-[var(--cs-ink-faint)]">
              主栏为<strong>多轮对话时间线</strong>（每轮下列出各角色公开发言）。推进对话请用顶栏<strong>绿钮</strong>：第 1 次即开局第一轮全场发言。
            </p>

            {simulationId && protagonistId && (
              <div className="cs-surface mt-4 p-4">
                <h3 className="text-sm font-medium text-[var(--cs-ink)]">
                  穿越者幕僚（主视角辅助）
                </h3>
                <p className="mt-1 text-xs text-[var(--cs-ink-muted)]">
                  场景已设主视角：此处是<strong>幕僚参考</strong>（条子/代拟一句），不会替其他角色开口。
                  <strong className="text-[var(--cs-ink)]"> 全场多人对话</strong>
                  须点顶栏绿钮「开始第 1 轮 / 下一轮」——每轮按编组让所有人依次发言并相互钩连。
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={assistBusy || sim?.status === "running"}
                    onClick={() => fetchPlayableAssist("situation")}
                    className="cs-btn-secondary px-3 py-1.5 text-xs"
                  >
                    {assistBusy ? "请求中…" : "局势与开口建议"}
                  </button>
                  <button
                    type="button"
                    disabled={assistBusy || sim?.status === "running"}
                    onClick={() => fetchPlayableAssist("draft_line")}
                    className="cs-btn-primary px-3 py-1.5 text-xs"
                  >
                    自动起草台词
                  </button>
                </div>
                {assistTrace && (
                  <div className="mt-3 rounded-lg border border-dashed border-[var(--cs-border)] bg-[var(--cs-accent-soft)] p-2 text-[11px] text-[var(--cs-ink-muted)]">
                    <p className="font-medium text-[var(--cs-ink)]">本次请求摘要（非黑箱）</p>
                    <p className="mt-1">
                      {assistTrace.modeLabel} · 主视角 {assistTrace.protagonist} · 最近一轮发言条数{" "}
                      {assistTrace.lastRoundSpeeches}
                    </p>
                    <p className="mt-1 text-[var(--cs-ink-faint)]">
                      送入模型的上下文摘录（前 280 字）：
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
                      {assistTrace.transcriptPreview || "（尚无轮次台词，仅用场景背景）"}
                    </p>
                  </div>
                )}
                {assistText && (
                  <>
                    <p className="mt-2 text-[11px] text-[var(--cs-warn)]">
                      以上为单条参考。若要百官依次表态、互驳，请用顶栏绿钮跑完整一轮（或继续点多轮）。
                    </p>
                    <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] p-3 text-xs text-[var(--cs-ink)]">
                      {assistText}
                    </div>
                  </>
                )}
              </div>
            )}

            {liveProgress && (
              <div className="cs-surface mt-4 p-4">
                <p className="text-sm font-medium text-[var(--cs-ink)]">
                  进行中：第 {liveProgress.index}/{liveProgress.total} 位 —{" "}
                  {liveProgress.characterName}
                </p>
                <p className="mt-1 text-xs text-[var(--cs-ink-muted)]">
                  正在生成该角色的内心活动与公开发言；右侧「实时过程」会同步摘录，完成后正文区自动刷新。
                </p>
              </div>
            )}

            {sim?.status === "running" && !liveProgress && (
              <p className="mt-3 text-xs text-[var(--cs-warn)]">
                推演进行中：各角色台词逐条写入。若中间时间线暂未出现新条目，请看下方「刚生成」摘要或右侧实时过程；若提示「同步主栏数据失败」请刷新页面。
              </p>
            )}

            {liveSpeechPreview && (
              <div className="cs-surface mt-4 max-h-64 overflow-y-auto p-4 text-xs">
                <p className="font-medium text-[var(--cs-ink)]">
                  刚生成：{liveSpeechPreview.characterName}（第 {liveSpeechPreview.roundNumber}{" "}
                  轮）
                </p>
                <p className="mt-2 text-[var(--cs-ink-muted)]">
                  <span className="text-[var(--cs-ink-faint)]">内心：</span>
                  {liveSpeechPreview.innerMonologue}
                </p>
                <p className="mt-2 text-[var(--cs-ink)]">
                  <span className="text-[var(--cs-ink-faint)]">台词：</span>
                  {liveSpeechPreview.publicSpeech}
                </p>
              </div>
            )}

            {sim && sim.rounds.length > 0 && (
              <div className="mt-8 space-y-8">
                {sim.rounds.map((round) => (
                  <section key={round.id} id={`round-${round.roundNumber}`}>
                    <h2 className="text-sm font-medium text-[var(--cs-ink)]">
                      第 {round.roundNumber} 轮 · 朝堂对话实录
                    </h2>
                    {round.summary && (
                      <p className="mt-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-3 py-2 text-xs text-[var(--cs-ink-muted)]">
                        <span className="font-medium text-[var(--cs-ink)]">轮次摘要：</span>
                        {round.summary}
                      </p>
                    )}
                    {formatPoliticalStateUi(round.politicalState) && (
                      <details className="mt-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-medium text-[var(--cs-success)]">
                          政治状态要点（结构化）
                        </summary>
                        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-[var(--cs-ink-muted)]">
                          {formatPoliticalStateUi(round.politicalState)}
                        </pre>
                      </details>
                    )}
                    {round.speeches.length === 0 && (
                      <p className="mt-2 text-xs text-[var(--cs-ink-faint)]">
                        本轮尚无已保存的发言。若刚在生成中，请稍候同步；若长时间为空，请查看上方报错或刷新页面。
                      </p>
                    )}
                    <ul className="mt-3 space-y-4">
                      {round.speeches.map((sp, idx) => {
                        const dm = parseDialogueMeta(sp.dialogueMeta);
                        const rag = parseSourceRefs(sp.sourceRefs);
                        const prev =
                          idx > 0
                            ? (round.speeches[idx - 1]!.character?.name ?? null)
                            : null;
                        return (
                          <li key={sp.id} className="cs-surface p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-[var(--cs-ink)]">
                                {sp.character?.name ?? "（未知角色）"}
                              </span>
                              {dm?.relationToPrevious && (
                                <span className="rounded-full border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--cs-link)]">
                                  {dm.relationToPrevious}
                                  {prev ? ` ← 针对前文「${prev}」` : ""}
                                </span>
                              )}
                              {dm?.towardAuthority && (
                                <span className="rounded-full border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-2 py-0.5 text-[11px] text-[var(--cs-warn)]">
                                  对上位：{dm.towardAuthority}
                                </span>
                              )}
                            </div>
                            {dm?.targets && dm.targets.length > 0 && (
                              <p className="mt-1 text-[11px] text-[var(--cs-ink-faint)]">
                                指向：{dm.targets.join("、")}
                              </p>
                            )}
                            {dm?.note && (
                              <p className="mt-1 text-[11px] italic text-[var(--cs-ink-muted)]">
                                钩连：{dm.note}
                              </p>
                            )}
                            <p className="mt-2 text-sm text-[var(--cs-ink)] whitespace-pre-wrap">
                              {sp.publicSpeech}
                            </p>
                            {rag?.chunks && rag.chunks.length > 0 && (
                              <details className="mt-3 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-3 py-2 text-xs">
                                <summary className="cursor-pointer font-medium text-[var(--cs-link)]">
                                  本句关联史料（{rag.chunks.length}）
                                </summary>
                                <ul className="mt-2 space-y-2 text-[var(--cs-ink-muted)]">
                                  {rag.chunks.map((c, i) => (
                                    <li
                                      key={i}
                                      className="border-l-2 border-[var(--cs-border-strong)] pl-2"
                                    >
                                      <div className="text-[10px] text-[var(--cs-link)]">
                                        {c.sourceTitle} · 块 #{c.chunkIndex} · sim=
                                        {c.score.toFixed(3)}
                                      </div>
                                      <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed">
                                        {c.excerpt}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                            <details className="mt-2 text-xs text-[var(--cs-ink-faint)]">
                              <summary className="cursor-pointer">内心独白</summary>
                              <p className="mt-1 whitespace-pre-wrap text-[var(--cs-ink-muted)]">
                                {sp.innerMonologue}
                              </p>
                            </details>
                            {sp.strategyNote && (
                              <p className="mt-2 text-xs text-[var(--cs-warn)]">
                                策略：{sp.strategyNote}
                              </p>
                            )}
                            <div className="mt-4 border-t border-[var(--cs-border)] pt-3">
                              <label className="text-xs font-medium text-[var(--cs-ink-faint)]">
                                场外批注（下一轮该角色须按此意图组织台词）
                              </label>
                              <textarea
                                className="mt-1 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] px-2 py-1.5 text-xs text-[var(--cs-ink)]"
                                rows={2}
                                placeholder="例如：须明确反对封赏，并引用祖制……"
                                value={
                                  directiveDrafts[sp.id] ??
                                  sp.userDirective ??
                                  ""
                                }
                                onChange={(e) =>
                                  setDirectiveDrafts((d) => ({
                                    ...d,
                                    [sp.id]: e.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="mt-1 cs-btn-secondary px-2 py-1 text-[11px]"
                                onClick={async () => {
                                  try {
                                    await saveSpeechDirective(
                                      sp.id,
                                      directiveDrafts[sp.id] ??
                                        sp.userDirective ??
                                        "",
                                    );
                                    setDirectiveDrafts((d) => {
                                      const n = { ...d };
                                      delete n[sp.id];
                                      return n;
                                    });
                                  } catch (e) {
                                    setError(
                                      e instanceof Error ? e.message : String(e),
                                    );
                                  }
                                }}
                              >
                                保存批注
                              </button>
                              {sp.userDirective && (
                                <span className="ml-2 text-[11px] text-[var(--cs-success)]">
                                  已保存，将在该角色下次开口时生效
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {sim && sim.rounds.length === 0 && simulationId && (
              <p className="mt-8 text-sm text-[var(--cs-ink-muted)]">
                尚无朝堂实录。请点顶栏绿钮<strong>「开始第 1 轮（全员依次发言）」</strong>
                ：第一轮就会让每位在场角色按编组顺序各发一段、彼此钩连。
              </p>
            )}

            {simulationId && sim && sim.status !== "completed" && (
              <div className="mt-10 border-t border-[var(--cs-border)] pt-6">
                <p className="mb-2 text-center text-xs font-medium uppercase tracking-[0.15em] text-[var(--cs-ink-faint)]">
                  可选 · 议题收束
                </p>
                <button
                  type="button"
                  disabled={
                    closeTopicBusy || sim.status === "running" || busy
                  }
                  onClick={() => requestCloseTopic()}
                  className="cs-btn-secondary w-full border-[var(--cs-border-strong)] px-4 py-3 text-sm disabled:opacity-50"
                >
                  {closeTopicBusy
                    ? "提交中…"
                    : "标记：再下一轮全体收口当前议题"}
                </button>
                <p className="mt-2 text-center text-xs text-[var(--cs-ink-faint)]">
                  与「开场/继续对话」无关：仅在你<strong>下一次</strong>点绿钮推进的那一轮生效，让每位在场角色表态收口、少生枝节。
                </p>
              </div>
            )}

            <p className="mt-10 text-xs text-[var(--cs-ink-faint)]">
              主流程只有顶栏绿钮：每按一次生成<strong>一整轮</strong>多人发言。进行中可看「刚生成」摘要与右侧实时过程。
            </p>
          </main>

          {/* 右：轮次 / 状态 / SSE / 导出 */}
          <aside className="cs-surface order-3 p-4 lg:col-span-3 xl:col-span-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--cs-ink-faint)]">
              会话与事件
            </h2>
            {sim && meta && (
              <dl className="mt-3 space-y-2 text-sm text-[var(--cs-ink-muted)]">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--cs-ink-faint)]">当前轮次</dt>
                  <dd className="font-medium tabular-nums text-[var(--cs-ink)]">
                    {sim.currentRound} / {meta.max_rounds}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--cs-ink-faint)]">状态</dt>
                  <dd className="font-medium text-[var(--cs-ink)]">{sim.status}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--cs-ink-faint)]">发言顺序</dt>
                  <dd className="text-right text-xs leading-snug">
                    {speakingOrderLabel(meta.speaking_order)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--cs-ink-faint)]">累计 tokens</dt>
                  <dd className="font-medium tabular-nums text-[var(--cs-ink)]">{sim.totalTokens}</dd>
                </div>
              </dl>
            )}

            {simulationId && (
              <div className="mt-4 border-t border-[var(--cs-border)] pt-4 space-y-3">
                <button
                  type="button"
                  disabled={
                    chapterBusy ||
                    !sim ||
                    !sim.rounds.length ||
                    sim.status === "running"
                  }
                  onClick={() => generateChapterReport()}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--cs-border-strong)] bg-[var(--cs-accent-soft)] px-3 py-2 text-sm font-medium text-[var(--cs-link)] hover:bg-[var(--cs-paper)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {chapterBusy ? "生成中…" : "生成章回体总结"}
                </button>
                {sim?.chapterReport && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] p-3 text-xs leading-relaxed text-[var(--cs-ink)] whitespace-pre-wrap">
                    {sim.chapterReport}
                  </div>
                )}
                <a
                  href={`/api/simulate/${simulationId}/export`}
                  download
                  className="cs-btn-secondary inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium"
                >
                  导出推演 JSON
                </a>
                <p className="text-[11px] leading-relaxed text-[var(--cs-ink-faint)]">
                  含场景、人物、各轮发言全文，便于存档或外部分析。
                </p>
              </div>
            )}

            {sim && sim.rounds.length > 0 && (
              <nav className="mt-4 border-t border-[var(--cs-border)] pt-4">
                <div className="text-xs font-medium text-[var(--cs-ink-faint)]">跳转轮次</div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {sim.rounds.map((r) => (
                    <li key={r.id}>
                      <a
                        href={`#round-${r.roundNumber}`}
                        className="inline-block rounded-md border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] px-2 py-1 text-xs text-[var(--cs-ink-muted)] hover:border-[var(--cs-border-strong)]"
                      >
                        {r.roundNumber}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <div className="mt-4 border-t border-[var(--cs-border)] pt-4">
              <div className="text-xs font-medium text-[var(--cs-ink-faint)]">
                实时过程
              </div>
              {liveTail.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--cs-ink-faint)]">连接后将显示最近事件。</p>
              ) : (
                <ul className="mt-2 max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed text-[var(--cs-ink-muted)]">
                  {liveTail.map((x, i) => (
                    <li
                      key={i}
                      className="border-b border-[var(--cs-border)] py-1 last:border-0"
                    >
                      {x}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </DynastyShell>
  );
}
