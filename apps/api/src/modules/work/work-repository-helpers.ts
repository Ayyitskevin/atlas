import type { AttachmentScanStatus, Prisma } from "@atlas/db";
import type { SearchResultType } from "@atlas/shared";


export type AttachmentScanWrite = {
  checkedAt: Date;
  message: string | null;
  provider: string;
  status: Exclude<AttachmentScanStatus, "PENDING">;
};

export const attachmentCommentVersionSelect = {
  fileName: true,
  id: true,
  sizeBytes: true,
  version: true,
};

export const attachmentCommentInclude = {
  version: {
    select: attachmentCommentVersionSelect,
  },
};

export const attachmentWithActiveVersions = {
  comments: {
    include: attachmentCommentInclude,
    orderBy: { createdAt: "asc" as const },
    where: { deletedAt: null },
  },
  versions: {
    orderBy: { version: "desc" as const },
    where: { activatedAt: { not: null } },
  },
};

export type SearchWorkspaceCursor = {
  id: string;
  type: SearchResultType;
  updatedAt: Date;
};

export const searchResultTypeRank: Record<SearchResultType, number> = {
  project: 0,
  task: 1,
};

export function compactWhere<TWhere>(items: Array<TWhere | undefined>) {
  return items.filter((item): item is TWhere => Boolean(item));
}

export function attachmentScanData(scan: AttachmentScanWrite) {
  return {
    scanCheckedAt: scan.checkedAt,
    scanMessage: scan.message,
    scanProvider: scan.provider,
    scanStatus: scan.status,
  };
}

export function searchAfterWhere<TWhere>(resultType: SearchResultType, after?: SearchWorkspaceCursor): TWhere | undefined {
  if (!after) return undefined;
  const resultRank = searchResultRank(resultType);
  const afterRank = searchResultRank(after.type);
  const sameTimestampFilters: Prisma.ProjectWhereInput[] = [];
  if (resultRank > afterRank) sameTimestampFilters.push({ updatedAt: after.updatedAt });
  if (resultRank === afterRank) sameTimestampFilters.push({ id: { gt: after.id }, updatedAt: after.updatedAt });
  return {
    OR: [{ updatedAt: { lt: after.updatedAt } }, ...sameTimestampFilters],
  } as TWhere;
}

export function searchResultRank(type: SearchResultType) {
  return searchResultTypeRank[type] ?? 0;
}
