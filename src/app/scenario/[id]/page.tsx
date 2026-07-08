import Link from "next/link";
import { notFound } from "next/navigation";
import DynastyShell from "@/components/courtsim/DynastyShell";
import { humanSceneLabel } from "@/lib/scene-display";
import { dynastyThemeLabel } from "@/lib/dynasty-theme";
import { prisma } from "@/lib/prisma";

function parseJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export default async function ScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.scenario.findUnique({
    where: { id },
    include: {
      characters: true,
      project: { select: { id: true, name: true } },
    },
  });
  if (!row) notFound();

  const topic = parseJson<Record<string, unknown>>(row.topic, {});

  return (
    <DynastyShell dynastyId={row.dynastyId}>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <nav className="cs-nav mb-6 text-sm text-[var(--cs-ink-faint)]">
          <Link href="/" className="text-[var(--cs-link)]">
            首页
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--cs-ink)]">{row.name}</span>
        </nav>
        <h1 className="text-2xl font-medium text-[var(--cs-ink)]">{row.name}</h1>
        <p className="mt-2 text-sm text-[var(--cs-ink-muted)]">
          {row.project && (
            <span className="mr-2 rounded-md border border-[var(--cs-border)] bg-[var(--cs-paper-elevated)] px-2 py-0.5 text-xs text-[var(--cs-link)]">
              项目：{row.project.name}
            </span>
          )}
          <span className="text-[var(--cs-ink-faint)]">
            {dynastyThemeLabel(row.dynastyId)}
          </span>
          {" · "}
          {humanSceneLabel(row.dynastyId, row.sceneType)}
          {row.year ? ` · ${row.year}年` : ""}
        </p>
        {String(topic.title ?? "") && (
          <p className="mt-2 text-sm text-[var(--cs-ink-muted)]">
            议题：{String(topic.title)}
          </p>
        )}
        <div className="cs-surface mt-6 p-6">
          <h2 className="text-sm font-medium text-[var(--cs-ink-faint)]">背景</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--cs-ink)]">
            {row.background}
          </p>
        </div>
        {row.characters.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-[var(--cs-ink-faint)]">人物</h2>
            <ul className="mt-2 space-y-2">
              {row.characters.map((c) => {
                const idObj = parseJson<Record<string, unknown>>(c.identity, {});
                return (
                  <li
                    key={c.id}
                    className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-paper-elevated)] px-3 py-2 text-sm text-[var(--cs-ink-muted)]"
                  >
                    <span className="font-medium text-[var(--cs-ink)]">{c.name}</span>
                    {idObj.position != null && (
                      <span className="ml-2 text-[var(--cs-ink-faint)]">
                        {String(idObj.position)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/scenario/${id}/simulate`}
            className="cs-btn-primary inline-flex px-4 py-2 text-sm"
          >
            进入推演
          </Link>
          <Link
            href={`/scenario/${id}/network`}
            className="cs-btn-secondary inline-flex px-4 py-2 text-sm text-[var(--cs-ink-muted)]"
          >
            关系网络图
          </Link>
          <p className="self-center text-sm text-[var(--cs-ink-faint)]">
            需已配置模型端点且场景中至少有一名角色。
          </p>
        </div>
      </div>
    </DynastyShell>
  );
}
