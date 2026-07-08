"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import DynastyShell from "@/components/courtsim/DynastyShell";
import { dynastyThemeLabel } from "@/lib/dynasty-theme";
import { useScenarioWizardStore } from "@/store/scenario-wizard-store";

type DynastyRow = { id: string; name: string; period: string };
type EraRow = {
  id: string;
  name: string;
  nianhao: string;
  emperor?: string;
  years: string;
  notes?: string;
};
type HighlightRow = {
  id: string;
  name: string;
  yearsLabel: string;
  anchorYear?: number;
  description: string;
};
type SceneRow = {
  universalId: string;
  name: string;
  location?: string;
  description: string;
  category: string;
};

const TOPIC_PRESETS: {
  label: string;
  title: string;
  type: string;
  context: string;
}[] = [
  {
    label: "边饷拖欠与是否加派",
    title: "辽饷加派与太仓存银",
    type: "border",
    context:
      "九边欠饷数月，户部议加派或挪内帑；文武对百姓、对宦官与内廷态度不一，各怀私利。",
  },
  {
    label: "党争：封疆与追赃",
    title: "封疆案与追赃名单",
    type: "faction",
    context:
      "某督抚失事牵连东林及浙党，各方借题发挥，意在打击对手、保全己系。",
  },
  {
    label: "宦官与部院：批红与票拟",
    title: "批红越权与部院体面",
    type: "historical",
    context:
      "司礼监传谕与内阁票拟相左，吏部、都察院争体统与实权，无人自居「正义」一方。",
  },
  {
    label: "改制争议（一条鞭/新法）",
    title: "新法利弊与谁得益",
    type: "reform",
    context:
      "赋役并折、商税调整触动官绅与宦官利益，争论以实利与风险为核心。",
  },
  {
    label: "储位/册立风波",
    title: "国本与册立时日",
    type: "succession",
    context:
      "立储牵动外朝与内廷博弈，各方押注未来恩宠与清洗风险。",
  },
  {
    label: "大礼仪/名分与礼法",
    title: "名分礼制与政治站队",
    type: "historical",
    context:
      "以礼法为名行权力再分配，无人承认自己在「纯粹争面子」。",
  },
  {
    label: "对外和战（款贡/封贡）",
    title: "款贡数额与边防开支",
    type: "border",
    context:
      "主战主款各陈利害，背后多为饷源、兵权与私人恩怨。",
  },
];

export default function CreateWizardPage() {
  const s = useScenarioWizardStore();
  const [dynasties, setDynasties] = useState<DynastyRow[]>([]);
  const [eras, setEras] = useState<EraRow[]>([]);
  const [highlights, setHighlights] = useState<HighlightRow[]>([]);
  const [polityNote, setPolityNote] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const [endpoints, setEndpoints] = useState<{ id: string; name: string }[]>([]);
  const [knowledgeProcessed, setKnowledgeProcessed] = useState<
    { id: string; title: string; totalChunks: number }[]
  >([]);
  const [embeddingEndpoints, setEmbeddingEndpoints] = useState<
    { id: string; name: string }[]
  >([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refreshKnowledge = useCallback(() => {
    fetch("/api/knowledge?processed=1")
      .then((r) => r.json())
      .then(setKnowledgeProcessed);
  }, []);

  useEffect(() => {
    fetch("/api/dynasty")
      .then((r) => r.json())
      .then(setDynasties);
    fetch("/api/model/endpoint")
      .then((r) => r.json())
      .then((rows) =>
        setEndpoints(
          rows.map((x: { id: string; name: string }) => ({
            id: x.id,
            name: x.name,
          })),
        ),
      );
    fetch("/api/model/embedding")
      .then((r) => r.json())
      .then((rows: { id: string; name: string }[]) =>
        setEmbeddingEndpoints(rows.map((x) => ({ id: x.id, name: x.name }))),
      );
    refreshKnowledge();
    fetch("/api/project")
      .then((r) => r.json())
      .then((rows: { id: string; name: string }[]) =>
        setProjects(rows.map((p) => ({ id: p.id, name: p.name }))),
      );
  }, [refreshKnowledge]);

  const loadDynastyTemporal = useCallback(async (id: string) => {
    const r = await fetch(`/api/dynasty/${id}`);
    if (!r.ok) return;
    const d = (await r.json()) as {
      era_segments: EraRow[];
      highlight_events: HighlightRow[];
      polity_context?: string;
    };
    setEras(d.era_segments ?? []);
    setHighlights(d.highlight_events ?? []);
    setPolityNote(d.polity_context ?? null);
  }, []);

  const loadScenes = useCallback(async (id: string) => {
    const r = await fetch(`/api/dynasty/${id}/scenes`);
    setScenes(await r.json());
  }, []);

  useEffect(() => {
    if (s.dynastyId) {
      loadDynastyTemporal(s.dynastyId);
      loadScenes(s.dynastyId);
    }
  }, [s.dynastyId, loadDynastyTemporal, loadScenes]);

  async function generatePersonnel() {
    if (!s.dynastyId || !s.sceneId || !s.modelEndpointId) {
      setErr("请先选择朝代、场景，并选择模型端点（可在设置中添加）");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const ragQuery =
        [s.topicTitle, s.topicContext, s.background].filter(Boolean).join("\n") ||
        `${s.dynastyId ?? ""} ${s.sceneId ?? ""}`;
      const useRag =
        s.selectedKnowledgeIds.length > 0 && s.embeddingModelId != null;
      const r = await fetch("/api/personnel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dynastyId: s.dynastyId,
          periodId: s.periodId ?? undefined,
          year: s.year ?? undefined,
          sceneId: s.sceneId,
          fidelityMode: s.fidelity,
          modelEndpointId: s.modelEndpointId,
          ...(useRag
            ? {
                embeddingEndpointId: s.embeddingModelId,
                knowledgeSourceIds: s.selectedKnowledgeIds,
                ragQuery,
              }
            : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "生成失败");
      const chars =
        j.positions?.map(
          (p: {
            position: string;
            character: { name: string; identity?: Record<string, unknown>; behavior?: Record<string, unknown> };
          }) => ({
            position: p.position,
            name: p.character.name,
            identity: {
              ...(p.character.identity ?? {}),
              position: p.position,
            },
            behavior: p.character.behavior,
            autoGenerated: true,
          }),
        ) ?? [];
      const dedup: typeof chars = [];
      const seenName = new Set<string>();
      for (const ch of chars) {
        const n = String(ch.name).trim();
        if (seenName.has(n)) continue;
        seenName.add(n);
        dedup.push(ch);
      }
      s.setCharacters(dedup);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveScenario() {
    if (!s.dynastyId || !s.sceneId) {
      setErr("朝代与场景必填");
      return;
    }
    if (!s.periodId) {
      setErr("请完成时间锚点：在年号轴与关键事件中二选一（可使用「横向时间轴」页）");
      return;
    }
    const name =
      s.topicTitle ||
      `${dynasties.find((d) => d.id === s.dynastyId)?.name ?? ""} · ${s.sceneId}`;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dynastyId: s.dynastyId,
          periodId: s.periodId,
          year: s.year,
          sceneType: s.sceneId,
          background: s.background || s.topicContext || "（待补充背景）",
          topic: {
            title: s.topicTitle,
            type: s.topicType,
            context: s.topicContext,
          },
          protagonist: {
            name: "",
            role: "用户主角",
            objective: s.protagonistObjective,
            constraints: s.protagonistConstraints,
            allies: [],
            playableDirectives: s.playableDirectives || undefined,
          },
          rules: {
            speaking_order: "hierarchical",
            max_rounds: 10,
            context_window_rounds: 2,
            context_max_chars: 14000,
            enable_round_summary: true,
          },
          rulesLayer: {
            preset: s.dynastyId,
            fidelity: s.fidelity,
            timeKind: s.timeKind,
            periodId: s.periodId,
          },
          fidelity: s.fidelity,
          agentModelId: s.modelEndpointId,
          summarizerModelId: s.modelEndpointId,
          embeddingModelId: s.embeddingModelId,
          knowledgeSourceIds: s.selectedKnowledgeIds,
          projectId: s.projectId,
        }),
      });
      const row = await r.json();
      if (!r.ok) throw new Error(row.error ?? "保存失败");
      const charIds: string[] = [];
      for (const c of s.characters) {
        const cr = await fetch(`/api/scenario/${row.id}/character`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: c.name,
            identity: { ...c.identity, position: c.position },
            behavior: c.behavior ?? {},
            autoGenerated: c.autoGenerated,
          }),
        });
        const cj = await cr.json();
        if (!cr.ok) throw new Error(cj.error ?? "人物保存失败");
        charIds.push(cj.id);
      }
      const playIdx = s.protagonistCharacterIndex;
      const protagonistCharacterId =
        playIdx != null && playIdx >= 0 && playIdx < charIds.length
          ? charIds[playIdx]!
          : null;
      if (protagonistCharacterId) {
        await fetch(`/api/scenario/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ protagonistCharacterId }),
        });
      }
      window.location.href = `/scenario/${row.id}`;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const steps = ["朝代", "场景", "人物", "议题", "真实度", "模型"];

  return (
    <DynastyShell dynastyId={s.dynastyId}>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <nav className="cs-nav mb-6 text-sm text-[var(--cs-ink-faint)]">
          <Link href="/" className="text-[var(--cs-link)]">
            首页
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--cs-ink)]">新建场景</span>
          {s.dynastyId && (
            <span className="ml-2 text-xs text-[var(--cs-ink-faint)]">
              （{dynastyThemeLabel(s.dynastyId)}）
            </span>
          )}
        </nav>

        <div className="mb-8 flex flex-wrap gap-2">
          {steps.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => s.setStep(i + 1)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity ${
                s.step === i + 1
                  ? "bg-[var(--cs-accent)] text-[var(--cs-on-accent)]"
                  : "border border-[var(--cs-border)] bg-[var(--cs-paper-elevated)] text-[var(--cs-ink-muted)] hover:opacity-90"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {err && (
          <div
            className="mb-4 rounded-lg border px-4 py-2 text-sm"
            style={{
              borderColor: "var(--cs-danger)",
              backgroundColor: "var(--cs-accent-soft)",
              color: "var(--cs-danger)",
            }}
          >
            {err}
          </div>
        )}

      {s.step === 1 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">选择朝代与时间锚点</h2>
          <p className="text-sm text-zinc-600">
            先选朝代；再在<strong>年号轴</strong>与<strong>关键大事</strong>中<strong>二选一</strong>作为主线（互斥），否则无法进入下一步。推荐在横向时间轴上完成选择。
          </p>
          <Link
            href="/create/timeline"
            className="inline-flex rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100"
          >
            打开全朝代横向时间轴
          </Link>
          <div className="flex flex-wrap gap-2">
            {dynasties.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => s.setDynasty(d.id)}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  s.dynastyId === d.id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white hover:border-zinc-400"
                }`}
              >
                {d.name}
                <span className="ml-1 text-xs opacity-70">{d.period}</span>
              </button>
            ))}
          </div>

          {s.dynastyId && polityNote && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3 text-xs text-amber-950/90">
              <span className="font-medium text-amber-900">多政权提示：</span>
              {polityNote}
            </div>
          )}

          {s.dynastyId && eras.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-xs font-medium text-zinc-600">
                  一、按皇帝年号（主线序）
                </p>
                {s.timeKind && (
                  <button
                    type="button"
                    className="text-xs text-zinc-500 underline"
                    onClick={() => s.clearTimeAnchor()}
                  >
                    清除时间选择
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/50 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {eras.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => s.setTimeEra(e.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs ${
                        s.timeKind === "era" && s.periodId === e.id
                          ? "border-amber-600 bg-amber-50 text-amber-950"
                          : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
                      }`}
                    >
                      <div className="font-medium">
                        {e.nianhao} · {e.name}
                      </div>
                      <div className="mt-0.5 text-zinc-500">{e.years}</div>
                      {e.emperor && (
                        <div className="mt-0.5 text-zinc-600">{e.emperor}</div>
                      )}
                      {e.notes && (
                        <div className="mt-1 line-clamp-2 text-zinc-500">
                          {e.notes}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {s.dynastyId && highlights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-600">
                二、关键事件 / 名场面（与年号轴二选一）
              </p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/50 p-3">
                <div className="grid gap-2 sm:grid-cols-1">
                  {highlights.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => s.setTimeHighlight(h.id, h.anchorYear)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs ${
                        s.timeKind === "highlight" &&
                        s.periodId === `evt:${h.id}`
                          ? "border-violet-600 bg-violet-50 text-violet-950"
                          : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
                      }`}
                    >
                      <div className="font-medium">{h.name}</div>
                      <div className="mt-0.5 text-zinc-500">
                        {h.yearsLabel}
                        {h.anchorYear != null
                          ? ` · 锚点 ${h.anchorYear} 年`
                          : ""}
                      </div>
                      <div className="mt-1 text-zinc-600">{h.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-500">
              精确年份（可选，覆盖/细化上面选择）
            </label>
            <input
              type="number"
              className="mt-1 w-40 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={s.year ?? ""}
              onChange={(e) =>
                s.setYear(e.target.value ? Number(e.target.value) : null)
              }
              placeholder="如 1622"
            />
          </div>
          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
            onClick={() => {
              if (!s.periodId) {
                setErr("请先选择年号或关键事件之一");
                return;
              }
              setErr(null);
              s.setStep(2);
            }}
          >
            下一步
          </button>
        </section>
      )}

      {s.step === 2 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">场景类型</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {scenes.map((sc) => (
              <button
                key={`${sc.universalId}-${sc.name}`}
                type="button"
                onClick={() => s.setScene(sc.universalId)}
                className={`rounded-xl border p-4 text-left text-sm transition ${
                  s.sceneId === sc.universalId
                    ? "border-zinc-900 ring-1 ring-zinc-900"
                    : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <div className="text-xs uppercase tracking-wide text-zinc-400">
                  {sc.category}
                </div>
                <div className="font-medium text-zinc-900">{sc.name}</div>
                {sc.location && (
                  <div className="text-xs text-zinc-500">{sc.location}</div>
                )}
                <p className="mt-1 text-xs text-zinc-600 line-clamp-3">
                  {sc.description}
                </p>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm"
              onClick={() => s.setStep(1)}
            >
              上一步
            </button>
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
              onClick={() => s.setStep(3)}
            >
              下一步
            </button>
          </div>
        </section>
      )}

      {s.step === 3 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">人物配置</h2>
          <p className="text-sm text-zinc-600">
            生成后列表以<strong>官职 → 姓名</strong>展示；请核对<strong>姓名与背景</strong>，可按史实手动改正（同岗换人）。
            <strong>设为主视角</strong>表示玩家穿越附体该人；推演页可唤「幕僚」给局势建议或代拟台词。
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <label className="text-xs font-medium text-amber-900">
              穿越者额外倾向（可选）
            </label>
            <textarea
              className="mt-2 min-h-[72px] w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="例如：优先保命与家族；表面顺从、暗留证据……"
              value={s.playableDirectives}
              onChange={(e) => s.setPlayableDirectives(e.target.value)}
            />
            <p className="mt-1 text-xs text-amber-800/80">
              写入场景 protagonist JSON，与主视角人物一并作用于推演提示。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={s.modelEndpointId ?? ""}
              onChange={(e) => s.setModelEndpointId(e.target.value || null)}
            >
              <option value="">选择模型端点…</option>
              {endpoints.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <Link
              href="/settings/models"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              去添加端点
            </Link>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => generatePersonnel()}
            >
              {busy ? "生成中…" : "自动生成人物"}
            </button>
          </div>
          <ul className="space-y-3">
            {s.characters.map((c, idx) => (
              <li
                key={idx}
                className={`rounded-lg border p-3 text-sm ${
                  s.protagonistCharacterIndex === idx
                    ? "border-violet-400 bg-violet-50"
                    : "border-zinc-100 bg-zinc-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        className="min-w-[120px] flex-1 rounded border border-zinc-200 px-2 py-1 text-xs"
                        placeholder="官职"
                        value={c.position}
                        onChange={(e) => {
                          const v = e.target.value;
                          s.updateCharacter(idx, {
                            position: v,
                            identity: { ...c.identity, position: v },
                          });
                        }}
                      />
                      <input
                        className="min-w-[100px] flex-1 rounded border border-zinc-200 px-2 py-1 text-sm font-medium"
                        placeholder="姓名"
                        value={c.name}
                        onChange={(e) =>
                          s.updateCharacter(idx, { name: e.target.value })
                        }
                      />
                    </div>
                    <textarea
                      className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700"
                      rows={2}
                      placeholder="人物背景（可改：年龄、性格、当下利害等）"
                      value={String(c.identity.background ?? "")}
                      onChange={(e) =>
                        s.updateCharacter(idx, {
                          identity: {
                            ...c.identity,
                            background: e.target.value,
                          },
                        })
                      }
                    />
                    {s.protagonistCharacterIndex === idx && (
                      <span className="inline-block rounded bg-violet-800 px-1.5 py-0.5 text-xs text-white">
                        主视角（穿越附体）
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      className="text-xs text-violet-800 underline"
                      onClick={() =>
                        s.setProtagonistCharacterIndex(
                          s.protagonistCharacterIndex === idx ? null : idx,
                        )
                      }
                    >
                      {s.protagonistCharacterIndex === idx
                        ? "取消主视角"
                        : "设为主视角"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => {
                        const next = s.characters.filter((_, i) => i !== idx);
                        s.setCharacters(next);
                        if (s.protagonistCharacterIndex === idx) {
                          s.setProtagonistCharacterIndex(null);
                        } else if (
                          s.protagonistCharacterIndex != null &&
                          s.protagonistCharacterIndex > idx
                        ) {
                          s.setProtagonistCharacterIndex(
                            s.protagonistCharacterIndex - 1,
                          );
                        }
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm"
              onClick={() => s.setStep(2)}
            >
              上一步
            </button>
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
              onClick={() => s.setStep(4)}
            >
              下一步
            </button>
          </div>
        </section>
      )}

      {s.step === 4 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">议题与目的</h2>
          <div>
            <label className="text-xs font-medium text-zinc-500">快速选题（可再改）</label>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value=""
              onChange={(e) => {
                const i = Number(e.target.value);
                const p = TOPIC_PRESETS[i];
                if (p != null && e.target.value !== "") {
                  s.setTopic({
                    topicTitle: p.title,
                    topicType: p.type,
                    topicContext: p.context,
                  });
                }
                e.target.value = "";
              }}
            >
              <option value="">— 选择预设填充下方 —</option>
              {TOPIC_PRESETS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <input
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            placeholder="议题标题"
            value={s.topicTitle}
            onChange={(e) => s.setTopic({ topicTitle: e.target.value })}
          />
          <select
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            value={s.topicType}
            onChange={(e) => s.setTopic({ topicType: e.target.value })}
          >
            <option value="historical">历史议题（贴合其时）</option>
            <option value="variant">架空变体</option>
            <option value="modern">古今对照（思辨）</option>
            <option value="faction">党争 / 派系角力</option>
            <option value="border">边患 / 饷糈 / 军政</option>
            <option value="reform">改制 / 变法争议</option>
            <option value="succession">册立 / 储位 / 继承</option>
          </select>
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            placeholder="议题背景"
            value={s.topicContext}
            onChange={(e) => s.setTopic({ topicContext: e.target.value })}
          />
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            placeholder="主角目的"
            value={s.protagonistObjective}
            onChange={(e) =>
              s.setProtagonist(e.target.value, s.protagonistConstraints)
            }
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm"
              onClick={() => s.setStep(3)}
            >
              上一步
            </button>
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
              onClick={() => s.setStep(5)}
            >
              下一步
            </button>
          </div>
        </section>
      )}

      {s.step === 5 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">真实度</h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["strict", "严格史实"],
                ["moderate", "中等平衡"],
                ["fiction", "架空发挥"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => s.setFidelity(k)}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  s.fidelity === k
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            placeholder="补充场景背景（可选，写入 scenario.background）"
            value={s.background}
            onChange={(e) => s.setBackground(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm"
              onClick={() => s.setStep(4)}
            >
              上一步
            </button>
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
              onClick={() => s.setStep(6)}
            >
              下一步
            </button>
          </div>
        </section>
      )}

      {s.step === 6 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">史料、Embedding 与模型</h2>
          <p className="text-sm text-zinc-600">
            勾选已分块向量化的史料后，推演每轮会按议题与上下文检索摘录注入；人物生成亦可复用（见第 3
            步说明）。上传、分组与项目域见{" "}
            <Link href="/knowledge" className="text-violet-700 underline">
              史料库
            </Link>
            。
          </p>

          <div>
            <label className="text-xs font-medium text-zinc-500">
              所属项目（可选）
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={s.projectId ?? ""}
              onChange={(e) => s.setProjectId(e.target.value || null)}
            >
              <option value="">不归属项目</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              与史料库中的「项目」一致，便于按课题归档场景；可在史料库新建项目。
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500">
              关联史料（多选，须已「处理」）
            </label>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-3">
              {knowledgeProcessed.length === 0 ? (
                <p className="text-xs text-zinc-500">暂无已处理史料</p>
              ) : (
                knowledgeProcessed.map((k) => (
                  <label
                    key={k.id}
                    className="flex cursor-pointer items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={s.selectedKnowledgeIds.includes(k.id)}
                      onChange={() => s.toggleKnowledgeSource(k.id)}
                      className="mt-1"
                    />
                    <span>
                      {k.title}
                      <span className="ml-1 text-xs text-zinc-400">
                        ({k.totalChunks} 块)
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500">
              Embedding 端点（RAG 检索）
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={s.embeddingModelId ?? ""}
              onChange={(e) => s.setEmbeddingModelId(e.target.value || null)}
            >
              <option value="">不启用向量检索</option>
              {embeddingEndpoints.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <Link
              href="/settings/models?tab=embedding"
              className="mt-1 inline-block text-xs text-violet-700 underline"
            >
              配置 Embedding 端点
            </Link>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500">
              角色对话 LLM 端点
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={s.modelEndpointId ?? ""}
              onChange={(e) => s.setModelEndpointId(e.target.value || null)}
            >
              <option value="">选择模型端点…</option>
              {endpoints.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm"
              onClick={() => s.setStep(5)}
            >
              上一步
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => saveScenario()}
            >
              {busy ? "保存中…" : "保存场景"}
            </button>
          </div>
        </section>
      )}
      </div>
    </DynastyShell>
  );
}
