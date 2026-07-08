"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DynastyShell from "@/components/courtsim/DynastyShell";
import InkMountains from "@/components/courtsim/InkMountains";
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
  category?: string;
};

type Track = "era" | "highlight";

const CAT_FILTER = ["全部", "政变", "改革", "政治", "军事", "其它"] as const;

export default function TimelineClient() {
  const router = useRouter();
  const s = useScenarioWizardStore();
  const [dynasties, setDynasties] = useState<DynastyRow[]>([]);
  const [eras, setEras] = useState<EraRow[]>([]);
  const [highlights, setHighlights] = useState<HighlightRow[]>([]);
  const [polityNote, setPolityNote] = useState<string | null>(null);
  const [dynId, setDynId] = useState<string | null>(s.dynastyId);
  const [track, setTrack] = useState<Track | null>(null);
  const [catFilter, setCatFilter] = useState<string>("全部");
  const dynastyStripRef = useRef<HTMLDivElement>(null);
  const contentStripRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && !sessionStorage.getItem("courtsim_timeline_welcome_ok")) {
        setShowWelcome(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function dismissWelcome() {
    try {
      sessionStorage.setItem("courtsim_timeline_welcome_ok", "1");
    } catch {
      /* ignore */
    }
    setShowWelcome(false);
  }

  useEffect(() => {
    fetch("/api/dynasty")
      .then((r) => r.json())
      .then(setDynasties);
  }, []);

  useEffect(() => {
    if (s.dynastyId) setDynId(s.dynastyId);
  }, [s.dynastyId]);

  const loadDynasty = useCallback(async (id: string) => {
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

  useEffect(() => {
    if (dynId) loadDynasty(dynId);
    else {
      setEras([]);
      setHighlights([]);
      setPolityNote(null);
    }
  }, [dynId, loadDynasty]);

  function scrollStrip(el: HTMLDivElement | null, dir: -1 | 1) {
    if (!el) return;
    el.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  const filteredHigh =
    catFilter === "全部"
      ? highlights
      : highlights.filter((h) => (h.category ?? "其它") === catFilter);

  function commit() {
    if (!dynId || !track) return;
    s.setDynasty(dynId);
    s.setStep(2);
    router.push("/create");
  }

  const eraOk =
    track === "era" &&
    s.timeKind === "era" &&
    !!s.periodId &&
    !String(s.periodId).startsWith("evt:");
  const hiOk =
    track === "highlight" &&
    s.timeKind === "highlight" &&
    !!s.periodId?.startsWith("evt:");
  const canProceed = !!dynId && !!track && (eraOk || hiOk);

  return (
    <DynastyShell dynastyId={dynId ?? s.dynastyId}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {showWelcome && (
          <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm text-violet-950 shadow-sm">
            <p className="font-medium">首次使用时间轴？</p>
            <p className="mt-1 text-xs text-violet-900/90">
              先选朝代 → 选轨道 A（年号）或 B（大事）→ 点具体卡片 → 再点「完成时间定位，进入向导」。可直接进入<strong>第 2 步·场景</strong>。
            </p>
            <button
              type="button"
              onClick={dismissWelcome}
              className="mt-2 rounded-lg bg-violet-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800"
            >
              知道了
            </button>
          </div>
        )}

        <nav className="cs-nav mb-4 text-sm text-[var(--cs-ink-faint)]">
          <Link href="/" className="text-[var(--cs-link)]">
            首页
          </Link>
          <span className="mx-2">/</span>
          <Link href="/create" className="text-[var(--cs-link)]">
            新建场景
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--cs-ink)]">时间轴</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="cs-logo text-2xl font-medium text-[var(--cs-ink)]">
            全朝代横向时间轴
          </h1>
          {dynId && (
            <span className="text-xs text-[var(--cs-ink-faint)]">
              当前设色：{dynastyThemeLabel(dynId)}
            </span>
          )}
        </div>
        <InkMountains />
        <p className="mt-4 max-w-3xl text-sm text-[var(--cs-ink-muted)]">
          先选朝代；再<strong>二选一</strong>轨道——<strong>皇帝年号（主线序）</strong>或
          <strong>关键事件 / 名场面</strong>。必须选定一条轨道并点选具体项后，才能进入分步向导。
        </p>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              朝代（横向滑动）
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs"
                onClick={() => scrollStrip(dynastyStripRef.current, -1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs"
                onClick={() => scrollStrip(dynastyStripRef.current, 1)}
              >
                ›
              </button>
            </div>
          </div>
          <div
            ref={dynastyStripRef}
            className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
          >
            {dynasties.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDynId(d.id);
                  setTrack(null);
                  s.setDynasty(d.id);
                  s.clearTimeAnchor();
                }}
                className={`min-w-[160px] shrink-0 snap-start rounded-xl border px-4 py-3 text-left transition ${
                  dynId === d.id
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-md"
                    : "border-zinc-200 bg-white hover:border-zinc-400"
                }`}
              >
                <div className="font-medium">{d.name}</div>
                <div className="mt-1 text-xs opacity-80">{d.period}</div>
              </button>
            ))}
          </div>
        </section>

        {dynId && polityNote && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-950">
            <span className="font-semibold">多政权提示：</span>
            {polityNote}
          </div>
        )}

        {dynId && (
          <section className="mt-8 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-800">
              选择时间主线（二选一）
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrack("era");
                  s.clearTimeAnchor();
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  track === "era"
                    ? "bg-amber-800 text-white"
                    : "bg-white text-zinc-700 ring-1 ring-zinc-200"
                }`}
              >
                轨道 A · 皇帝年号（主线序）
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrack("highlight");
                  s.clearTimeAnchor();
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  track === "highlight"
                    ? "bg-violet-800 text-white"
                    : "bg-white text-zinc-700 ring-1 ring-zinc-200"
                }`}
              >
                轨道 B · 关键事件 / 名场面
              </button>
            </div>

            {track === "era" && (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">左右滑动或点击箭头浏览年号</p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs"
                      onClick={() => scrollStrip(contentStripRef.current, -1)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs"
                      onClick={() => scrollStrip(contentStripRef.current, 1)}
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div
                  ref={contentStripRef}
                  className="mt-2 flex snap-x gap-3 overflow-x-auto pb-3"
                >
                  {eras.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setTrack("era");
                        s.setTimeEra(e.id);
                      }}
                      className={`min-w-[220px] shrink-0 snap-start rounded-xl border px-4 py-3 text-left text-sm ${
                        s.timeKind === "era" && s.periodId === e.id
                          ? "border-amber-600 bg-amber-50 ring-1 ring-amber-500"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      <div className="font-medium text-amber-950">
                        {e.nianhao} · {e.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">{e.years}</div>
                      {e.emperor && (
                        <div className="text-xs text-zinc-600">{e.emperor}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {track === "highlight" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {CAT_FILTER.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatFilter(c)}
                      className={`rounded-full px-3 py-1 text-xs ${
                        catFilter === c
                          ? "bg-violet-900 text-white"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="max-h-[420px] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredHigh.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setTrack("highlight");
                          s.setTimeHighlight(h.id, h.anchorYear);
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs ${
                          s.timeKind === "highlight" &&
                          s.periodId === `evt:${h.id}`
                            ? "border-violet-600 bg-violet-50"
                            : "border-zinc-100 hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-violet-950">
                            {h.name}
                          </span>
                          {h.category && (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
                              {h.category}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-zinc-500">
                          {h.yearsLabel}
                        </div>
                        <p className="mt-1 line-clamp-3 text-zinc-600">
                          {h.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
              <label className="text-xs text-zinc-500">公元年微调（可选）</label>
              <input
                type="number"
                className="mt-1 w-40 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={s.year ?? ""}
                onChange={(e) =>
                  s.setYear(e.target.value ? Number(e.target.value) : null)
                }
                placeholder="如 1622"
              />
            </div>
          </section>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => commit()}
            className="cs-btn-primary px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            完成时间定位，进入向导
          </button>
          <Link
            href="/create"
            className="cs-btn-secondary inline-block px-6 py-2.5 text-sm text-[var(--cs-ink-muted)]"
          >
            返回向导（保留已选）
          </Link>
        </div>
        {!canProceed && dynId && track && (
          <p className="mt-2 text-xs text-amber-800">
            请在当前轨道中点击一个具体年号或事件卡片。
          </p>
        )}
      </div>
    </DynastyShell>
  );
}
