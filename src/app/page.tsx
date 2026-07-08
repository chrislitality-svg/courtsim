import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DynastyShell from "@/components/courtsim/DynastyShell";
import InkMountains from "@/components/courtsim/InkMountains";
import { humanSceneLabel } from "@/lib/scene-display";
import { dynastyThemeLabel } from "@/lib/dynasty-theme";

export default async function HomePage() {
  const scenarios = await prisma.scenario.findMany({
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      id: true,
      name: true,
      projectId: true,
      dynastyId: true,
      sceneType: true,
      updatedAt: true,
      project: { select: { name: true } },
    },
  });

  return (
    <DynastyShell dynastyId={null}>
      <header className="cs-rule-bottom bg-[var(--cs-paper-elevated)]">
        <div className="mx-auto flex max-w-4xl flex-col px-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="cs-logo text-2xl font-medium tracking-wide text-[var(--cs-ink)]">
                朝堂风云
              </h1>
              <p className="mt-1 text-xs text-[var(--cs-ink-faint)]">
                CourtSim · 历史场景推演
              </p>
            </div>
            <nav className="flex flex-wrap items-center justify-end gap-2 text-sm cs-nav">
              <Link href="/create/timeline" className="cs-btn-primary px-4 py-2">
                新建场景
              </Link>
              <Link
                href="/knowledge"
                className="cs-btn-secondary px-3 py-2 text-[var(--cs-ink-muted)]"
              >
                史料库
              </Link>
              <Link
                href="/settings/models"
                className="cs-btn-secondary px-3 py-2 text-[var(--cs-ink-muted)]"
              >
                模型设置
              </Link>
            </nav>
          </div>
          <InkMountains />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="cs-surface p-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--cs-ink-faint)]">
            已实现主干
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--cs-ink-muted)]">
            <li>
              朝代样本：秦、西汉、唐、北宋、五代十国、明、清；年号轴、大事锚点、史料 RAG
            </li>
            <li>向导、推演、轮次摘要与政治状态、章回体、关系网示意、主视角</li>
            <li>界面取意水墨与书画装裱，随场景朝代切换设色（见文档「美术风格」）</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-medium text-[var(--cs-ink-faint)]">最近场景</h2>
          {scenarios.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--cs-ink-muted)]">
              暂无场景，点击「新建场景」开始。
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {scenarios.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/scenario/${s.id}`}
                    className="cs-surface block p-4 transition-opacity hover:opacity-95"
                  >
                    <div className="cs-text-title">{s.name}</div>
                    <div className="mt-2 text-xs text-[var(--cs-ink-faint)]">
                      {s.project?.name && (
                        <span className="text-[var(--cs-link)]">{s.project.name} · </span>
                      )}
                      <span title={humanSceneLabel(s.dynastyId, s.sceneType)}>
                        {dynastyThemeLabel(s.dynastyId)} ·{" "}
                        {humanSceneLabel(s.dynastyId, s.sceneType)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </DynastyShell>
  );
}
