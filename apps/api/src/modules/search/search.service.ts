import type { AuthContext } from "../../shared/auth-context.js";
import {
  type SearchQuery,
} from "@atlas/shared";
import {
  SearchResultItem,
  compareSearchResults,
  decodeSearchCursor,
  encodeSearchCursor,
} from "../work/work-helpers.js";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class SearchService extends WorkDomainBase {
  async search(ctx: AuthContext, workspaceId: string, query: SearchQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    const after = decodeSearchCursor(query.cursor, query.type);
    const [tasks, projects] = await this.searchRepo.searchWorkspace({ ...query, after, userId: ctx.userId, workspaceId });
    const items: SearchResultItem[] = [
      ...projects.map((project) => ({ type: "project" as const, project })),
      ...tasks.map((task) => ({ type: "task" as const, task })),
    ].sort(compareSearchResults);
    const pageItems = items.slice(0, query.limit);
    const hasNextPage = items.length > query.limit;
    const lastPageItem = pageItems.at(-1);
    return {
      items: pageItems,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage && lastPageItem ? encodeSearchCursor(lastPageItem) : null,
      },
    };
  }

}
