import Link from "next/link";
import { notFound } from "next/navigation";
import DynastyShell from "@/components/courtsim/DynastyShell";
import { prisma } from "@/lib/prisma";

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.knowledgeSource.findUnique({
    where: { id },
    include: {
      chunks: { orderBy: { chunkIndex: "asc" } },
      collection: {
        include: { project: { select: { id: true, name: true } } },
      },
      scenarios: {
        include: {
          scenario: { select: { id: true, name: true, projectId: true } },
        },
      },
    },
  });
  if (!row) notFound();

  return (
    <DynastyShell dynastyId={null}>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/knowledge" className="cs-nav text-sm text-[var(--cs-link)]">
          ← 史料库
        </Link>
        <h1 className="mt-4 text-xl font-medium text-[var(--cs-ink)]">{row.title}</h1>
        <p className="mt-1 text-xs text-[var(--cs-ink-faint)]">
          共 {row.totalChunks} 块 · {row.fileName}
        </p>
        {row.collection && (
          <p className="mt-2 text-sm text-[var(--cs-link)]">
            分组：{row.collection.name}
            {row.collection.project && (
              <span className="text-[var(--cs-ink-muted)]">
                {" "}
                · 项目 {row.collection.project.name}
              </span>
            )}
          </p>
        )}
        {row.scenarios.length > 0 && (
          <p className="mt-2 text-sm text-[var(--cs-ink-muted)]">
            已关联场景：
            {row.scenarios.map((sk, i) => (
              <span key={sk.scenario.id}>
                {i > 0 ? " · " : " "}
                <Link
                  href={`/scenario/${sk.scenario.id}`}
                  className="text-[var(--cs-link)] underline"
                >
                  {sk.scenario.name}
                </Link>
              </span>
            ))}
          </p>
        )}
        <ul className="mt-6 space-y-4">
          {row.chunks.map((c) => (
            <li key={c.id} className="cs-surface p-4 text-sm">
              <div className="text-xs text-[var(--cs-ink-faint)]">块 #{c.chunkIndex}</div>
              <p className="mt-2 whitespace-pre-wrap text-[var(--cs-ink)]">
                {c.content.length > 800 ? `${c.content.slice(0, 800)}…` : c.content}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </DynastyShell>
  );
}
