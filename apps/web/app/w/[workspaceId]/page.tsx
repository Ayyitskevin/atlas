import { Suspense } from "react";

import { AtlasClient } from "../../atlas-client";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-600">Loading…</main>}>
      <AtlasClient initialWorkspaceId={workspaceId} />
    </Suspense>
  );
}
