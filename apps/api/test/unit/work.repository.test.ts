import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@atlas/db";

import { WorkRepository } from "../../src/modules/work/work.repository.js";

describe("WorkRepository", () => {
  it("scopes comment mutations to the workspace and active row", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn().mockResolvedValue({ id: "comment-1", workspaceId: "workspace-1" });
    const repository = new WorkRepository({
      comment: {
        findFirst,
        updateMany,
      },
    } as unknown as PrismaClient);

    await repository.updateComment({
      body: "Updated comment",
      commentId: "comment-1",
      workspaceId: "workspace-1",
    });
    await repository.softDeleteComment({
      commentId: "comment-1",
      workspaceId: "workspace-1",
    });

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      data: { body: "Updated comment", editedAt: expect.any(Date) },
      where: { deletedAt: null, id: "comment-1", workspaceId: "workspace-1" },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      data: { deletedAt: expect.any(Date) },
      where: { deletedAt: null, id: "comment-1", workspaceId: "workspace-1" },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { deletedAt: null, id: "comment-1", workspaceId: "workspace-1" },
    });
  });
});
