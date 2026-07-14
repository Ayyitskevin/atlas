import { Suspense } from "react";

import { AtlasClient } from "../atlas-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-600">Loading…</main>}>
      <AtlasClient initialMode="login" />
    </Suspense>
  );
}
