import { Suspense } from "react";
import ModelsSettingsClient from "./ModelsSettingsClient";

export default function ModelsSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16 text-sm text-zinc-500">
          加载设置…
        </div>
      }
    >
      <ModelsSettingsClient />
    </Suspense>
  );
}
