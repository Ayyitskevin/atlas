import { AtlasClient } from "../../../../atlas-client";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  return <AtlasClient initialWorkspaceId={workspaceId} initialProjectId={projectId} />;
}
