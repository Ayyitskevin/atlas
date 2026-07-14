import { AtlasClient } from "../../atlas-client";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <AtlasClient initialWorkspaceId={workspaceId} />;
}
