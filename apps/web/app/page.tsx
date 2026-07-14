import { Suspense } from "react";

import { AtlasClient } from "./atlas-client";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-600">Loading…</main>}>
      <AtlasClient />
    </Suspense>
  );
}
