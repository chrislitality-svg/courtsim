"use client";

import { normalizeDynastyThemeId } from "@/lib/dynasty-theme";

export default function DynastyShell({
  dynastyId,
  className = "",
  children,
}: {
  dynastyId?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const slug = normalizeDynastyThemeId(dynastyId);
  return (
    <div
      data-dynasty={slug}
      className={`courtsim-dynasty-root min-h-full ${className}`.trim()}
    >
      {children}
    </div>
  );
}
