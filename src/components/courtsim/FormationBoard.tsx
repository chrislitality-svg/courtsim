"use client";

import { useCallback, useState } from "react";
import { formatCharacterCardLine } from "@/lib/character-identity-display";
import type { CourtFormation } from "@/lib/court-formation";
import { readApiJson } from "@/lib/read-api-json";

type Char = { id: string; name: string; identity?: string };

function removeFromAll(f: CourtFormation, charId: string): CourtFormation {
  const absentIds = f.absentIds.filter((id) => id !== charId);
  const groupMembers = { ...f.groupMembers };
  for (const g of f.groups) {
    groupMembers[g.id] = (groupMembers[g.id] ?? []).filter((id) => id !== charId);
  }
  return { ...f, absentIds, groupMembers };
}

function addToAbsent(f: CourtFormation, charId: string): CourtFormation {
  const base = removeFromAll(f, charId);
  if (base.absentIds.includes(charId)) return base;
  return { ...base, absentIds: [...base.absentIds, charId] };
}

function addToGroup(f: CourtFormation, charId: string, groupId: string): CourtFormation {
  const base = removeFromAll(f, charId);
  const gm = { ...base.groupMembers };
  gm[groupId] = [...(gm[groupId] ?? []), charId];
  return { ...base, groupMembers: gm };
}

function moveInGroup(
  f: CourtFormation,
  groupId: string,
  charId: string,
  dir: -1 | 1,
): CourtFormation {
  const gm = { ...f.groupMembers };
  const list = [...(gm[groupId] ?? [])];
  const i = list.indexOf(charId);
  if (i < 0) return f;
  const j = i + dir;
  if (j < 0 || j >= list.length) return f;
  [list[i], list[j]] = [list[j]!, list[i]!];
  gm[groupId] = list;
  return { ...f, groupMembers: gm };
}

export default function FormationBoard({
  scenarioId,
  characters,
  formation,
  onFormationChange,
  disabled,
}: {
  scenarioId: string;
  characters: Char[];
  formation: CourtFormation;
  onFormationChange: (f: CourtFormation) => void;
  disabled?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const byId = useCallback(
    (id: string) => characters.find((c) => c.id === id),
    [characters],
  );

  const persist = useCallback(
    async (f: CourtFormation) => {
      setSaving(true);
      setErr(null);
      try {
        const r = await fetch(`/api/scenario/${scenarioId}/formation`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formation: f }),
        });
        const j = await readApiJson<Record<string, unknown> & { error?: string }>(r);
        if (!r.ok) throw new Error(String(j.error ?? "保存失败"));
        onFormationChange(j.formation as CourtFormation);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [scenarioId, onFormationChange],
  );

  const suggest = useCallback(async () => {
    setSuggestBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/scenario/${scenarioId}/formation/suggest`, {
        method: "POST",
      });
      const j = await readApiJson<Record<string, unknown> & { error?: string }>(r);
      if (!r.ok) throw new Error(String(j.error ?? "建议失败"));
      onFormationChange(j.formation as CourtFormation);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSuggestBusy(false);
    }
  }, [scenarioId, onFormationChange]);

  const onDragStart = (e: React.DragEvent, charId: string) => {
    e.dataTransfer.setData("text/courtsim-char", charId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropTo = (
    e: React.DragEvent,
    target: { type: "absent" } | { type: "group"; groupId: string },
  ) => {
    e.preventDefault();
    if (disabled) return;
    const charId = e.dataTransfer.getData("text/courtsim-char");
    if (!charId) return;
    const next =
      target.type === "absent"
        ? addToAbsent(formation, charId)
        : addToGroup(formation, charId, target.groupId);
    onFormationChange(next);
  };

  const addGroup = () => {
    if (disabled) return;
    const id = `g${Date.now()}`;
    onFormationChange({
      ...formation,
      groups: [...formation.groups, { id, name: "新编组" }],
      groupMembers: { ...formation.groupMembers, [id]: [] },
    });
  };

  const renameGroup = (gid: string, name: string) => {
    if (disabled) return;
    onFormationChange({
      ...formation,
      groups: formation.groups.map((g) => (g.id === gid ? { ...g, name } : g)),
    });
  };

  const cardLabel = (c: Char) =>
    formatCharacterCardLine(c.identity ?? "{}", c.name);

  return (
    <section className="cs-surface p-4">
      <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper)] px-3 py-2 text-xs text-[var(--cs-ink-muted)]">
        <p className="font-medium text-[var(--cs-ink)]">怎么用（三步）</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>
            <strong>在场</strong>：把人物拖进下面某一<strong>编组列</strong>；列内越靠上越先发言。
          </li>
          <li>
            <strong>退场</strong>：拖进<strong>未入场人物库</strong>则本轮不发言。
          </li>
          <li>
            改完后点<strong>保存编组</strong>；需要可参考史实站位时点「依史实建议编组」。
          </li>
        </ol>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--cs-ink-faint)]">
          ① 谁在场 · ② 站哪一队 · ③ 谁先开口
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || suggestBusy}
            onClick={() => suggest()}
            className="cs-btn-secondary px-3 py-1 text-xs"
          >
            {suggestBusy ? "推演站位…" : "依史实建议编组"}
          </button>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => persist(formation)}
            className="cs-btn-primary px-3 py-1 text-xs"
          >
            {saving ? "保存中…" : "保存编组"}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={addGroup}
            className="cs-btn-secondary px-3 py-1 text-xs"
          >
            添加编组列
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--cs-ink-muted)]">
        多列表示不同派系或班次；同一列内为同一队列。与中间「第 N 轮」对话区配合：每轮按此处顺序依次生成台词。
      </p>
      {err && <p className="mt-2 text-xs text-[var(--cs-danger)]">{err}</p>}

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <div
          className="min-h-[100px] flex-1 rounded-lg border-2 border-dashed border-[var(--cs-border)] bg-[var(--cs-paper)] p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDropTo(e, { type: "absent" })}
        >
          <div className="text-xs font-medium text-[var(--cs-ink-faint)]">未入场人物库</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {formation.absentIds.map((id) => {
              const c = byId(id);
              if (!c) return null;
              return (
                <div
                  key={id}
                  draggable={!disabled}
                  onDragStart={(e) => onDragStart(e, id)}
                  className="cursor-grab rounded-md border border-[var(--cs-border)] bg-[var(--cs-paper-elevated)] px-2 py-1.5 text-xs text-[var(--cs-ink)] active:cursor-grabbing"
                >
                  {cardLabel(c)}
                </div>
              );
            })}
            {formation.absentIds.length === 0 && (
              <span className="text-xs text-[var(--cs-ink-faint)]">（无人退场）</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {formation.groups.map((g) => (
          <div
            key={g.id}
            className="min-h-[120px] rounded-lg border border-[var(--cs-border)] bg-[var(--cs-accent-soft)] p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropTo(e, { type: "group", groupId: g.id })}
          >
            <input
              disabled={disabled}
              className="mb-2 w-full border-b border-transparent bg-transparent text-sm font-medium text-[var(--cs-ink)] outline-none focus:border-[var(--cs-border-strong)]"
              value={g.name}
              onChange={(e) => renameGroup(g.id, e.target.value)}
            />
            <div className="flex flex-col gap-1">
              {(formation.groupMembers[g.id] ?? []).map((cid) => {
                const c = byId(cid);
                if (!c) return null;
                return (
                  <div
                    key={cid}
                    draggable={!disabled}
                    onDragStart={(e) => onDragStart(e, cid)}
                    className="flex items-center gap-1 rounded-md border border-[var(--cs-border)] bg-[var(--cs-paper-elevated)] px-2 py-1 text-xs text-[var(--cs-ink)]"
                  >
                    <span className="min-w-0 flex-1 cursor-grab text-left leading-snug active:cursor-grabbing">
                      {cardLabel(c)}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      className="shrink-0 text-[10px] text-[var(--cs-ink-faint)] hover:text-[var(--cs-ink)]"
                      onClick={() => onFormationChange(moveInGroup(formation, g.id, cid, -1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      className="shrink-0 text-[10px] text-[var(--cs-ink-faint)] hover:text-[var(--cs-ink)]"
                      onClick={() => onFormationChange(moveInGroup(formation, g.id, cid, 1))}
                    >
                      ↓
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
