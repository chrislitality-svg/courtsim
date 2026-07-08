"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import DynastyShell from "@/components/courtsim/DynastyShell";

type CharRow = {
  id: string;
  name: string;
  identity: unknown;
  relationships: unknown;
};

function positionOf(identity: unknown): string {
  if (identity && typeof identity === "object" && "position" in identity) {
    return String((identity as { position?: unknown }).position ?? "");
  }
  if (typeof identity === "string") {
    try {
      const o = JSON.parse(identity) as { position?: string };
      return String(o.position ?? "");
    } catch {
      return "";
    }
  }
  return "";
}

function relRecord(r: unknown): Record<string, unknown> {
  if (r && typeof r === "object" && !Array.isArray(r)) {
    return r as Record<string, unknown>;
  }
  if (typeof r === "string") {
    try {
      return JSON.parse(r) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

/** 从 relationships JSON 抽取边：支持 { allies:[], rivals:[] } 或 { edges:[{to,type}]} */
function edgesFromRels(
  chars: CharRow[],
): { from: string; to: string; label: string }[] {
  const byName = new Map(chars.map((c) => [c.name, c.id]));
  const out: { from: string; to: string; label: string }[] = [];
  for (const c of chars) {
    const r = relRecord(c.relationships);
    const addList = (arr: unknown, label: string) => {
      if (!Array.isArray(arr)) return;
      for (const x of arr) {
        const name = typeof x === "string" ? x : null;
        if (!name) continue;
        const tid = byName.get(name);
        if (tid) out.push({ from: c.id, to: tid, label });
      }
    };
    addList(r.allies, "盟");
    addList(r.rivals, "敌");
    addList(r.patrons, "座主");
    addList(r.clients, "门生");
    const edges = r.edges;
    if (Array.isArray(edges)) {
      for (const e of edges) {
        if (!e || typeof e !== "object") continue;
        const o = e as Record<string, unknown>;
        const toName = String(o.to ?? o.target ?? "");
        const tid = byName.get(toName);
        if (tid) {
          out.push({
            from: c.id,
            to: tid,
            label: String(o.type ?? o.label ?? "关联"),
          });
        }
      }
    }
  }
  return out;
}

export default function ScenarioNetworkClient({ scenarioId }: { scenarioId: string }) {
  const [chars, setChars] = useState<CharRow[]>([]);
  const [dynastyId, setDynastyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/scenario/${scenarioId}`);
    if (!r.ok) {
      setErr("无法加载场景");
      return;
    }
    const j = (await r.json()) as { characters?: CharRow[]; dynastyId?: string };
    setChars(j.characters ?? []);
    setDynastyId(j.dynastyId ?? null);
  }, [scenarioId]);

  useEffect(() => {
    load();
  }, [load]);

  const { nodes, links } = useMemo(() => {
    const edges = edgesFromRels(chars);
    const n = chars.map((c, i) => {
      const angle = (2 * Math.PI * i) / Math.max(chars.length, 1);
      const r = 120;
      return {
        id: c.id,
        name: c.name,
        sub: positionOf(c.identity),
        x: 200 + r * Math.cos(angle),
        y: 200 + r * Math.sin(angle),
      };
    });
    return { nodes: n, links: edges };
  }, [chars]);

  return (
    <DynastyShell dynastyId={dynastyId}>
      <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="cs-nav mb-6 text-sm text-[var(--cs-ink-faint)]">
        <Link href="/" className="text-[var(--cs-link)]">
          首页
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/scenario/${scenarioId}`} className="text-[var(--cs-link)]">
          场景
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--cs-ink)]">关系网络</span>
      </nav>

      <h1 className="text-xl font-medium text-[var(--cs-ink)]">人物关系示意</h1>
      <p className="mt-2 text-sm text-[var(--cs-ink-muted)]">
        基于各角色{" "}
        <code className="rounded border border-[var(--cs-border)] bg-[var(--cs-paper-elevated)] px-1 text-xs">
          relationships
        </code>{" "}
        JSON（如 allies / rivals / edges）生成的简易网络图；可在人物编辑中补充关系数组以丰富连线。
      </p>

      {err && (
        <p className="mt-4 text-sm" style={{ color: "var(--cs-danger)" }}>
          {err}
        </p>
      )}

      {chars.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--cs-ink-faint)]">暂无人物数据。</p>
      ) : (
        <div className="cs-surface mt-8 overflow-x-auto p-4">
          <svg width={420} height={420} className="mx-auto">
            {links.map((l, i) => {
              const a = nodes.find((x) => x.id === l.from);
              const b = nodes.find((x) => x.id === l.to);
              if (!a || !b) return null;
              return (
                <g key={`${l.from}-${l.to}-${i}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--cs-border-strong)"
                    strokeWidth={1.5}
                    strokeOpacity={0.8}
                  />
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2}
                    fontSize={9}
                    fill="var(--cs-ink-faint)"
                    textAnchor="middle"
                  >
                    {l.label}
                  </text>
                </g>
              );
            })}
            {nodes.map((n) => (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={28}
                  fill="var(--cs-paper-elevated)"
                  stroke="var(--cs-border-strong)"
                />
                <text
                  x={n.x}
                  y={n.y - 4}
                  fontSize={11}
                  textAnchor="middle"
                  fill="var(--cs-ink)"
                  fontWeight={500}
                >
                  {n.name.length > 4 ? `${n.name.slice(0, 4)}…` : n.name}
                </text>
                {n.sub && (
                  <text
                    x={n.x}
                    y={n.y + 10}
                    fontSize={8}
                    textAnchor="middle"
                    fill="var(--cs-ink-faint)"
                  >
                    {n.sub.length > 8 ? `${n.sub.slice(0, 8)}…` : n.sub}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      )}
      </div>
    </DynastyShell>
  );
}
