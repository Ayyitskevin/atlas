import { Suspense } from "react";

import { AtlasClient } from "../../../../atlas-client";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-600">Loading…</main>}>
      <AtlasClient initialWorkspaceId={workspaceId} initialProjectId={projectId} />
    </Suspense>
  );
}
