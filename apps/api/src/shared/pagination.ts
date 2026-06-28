import type { CursorPage } from "@atlas/shared";

export function pageFromLimit<TItem extends { id: string }>(items: TItem[], limit: number): CursorPage<TItem> {
  const pageItems = items.slice(0, limit);
  const hasNextPage = items.length > limit;
  return {
    items: pageItems,
    pageInfo: {
      hasNextPage,
      nextCursor: hasNextPage ? pageItems.at(-1)?.id ?? null : null,
    },
  };
}

export function paginationArgs(input: { cursor?: string; limit: number }) {
  return {
    cursor: input.cursor ? { id: input.cursor } : undefined,
    skip: input.cursor ? 1 : 0,
    take: input.limit + 1,
  };
}
