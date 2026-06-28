import { describe, expect, it } from "vitest";

import type { PrismaClient } from "@atlas/db";

import type { AuthContext } from "../../src/shared/auth-context.js";
import { AtlasHttpError } from "../../src/shared/errors.js";
import { PermissionsService } from "../../src/modules/permissions/permissions.service.js";

const ctx: AuthContext = {
  ip: "127.0.0.1",
  sessionId: "session-1",
  userId: "00000000-0000-0000-0000-000000000001",
};

function prismaWithWorkspaceRole(role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST" | null): PrismaClient {
  return {
    project: {
      findFirst: async () => ({ id: "project-1", visibility: "WORKSPACE" }),
    },
    projectMember: {
      findFirst: async () => null,
    },
    task: {
      findFirst: async () => ({ projectId: "project-1" }),
    },
    workspaceMember: {
      findFirst: async () => (role ? { role } : null),
    },
  } as unknown as PrismaClient;
}

describe("PermissionsService", () => {
  it("allows a member to satisfy member workspace permission", async () => {
    const service = new PermissionsService(prismaWithWorkspaceRole("MEMBER"));

    await expect(service.requireWorkspaceRole(ctx, "workspace-1", "MEMBER")).resolves.toBe("MEMBER");
  });

  it("rejects a guest for member workspace permission", async () => {
    const service = new PermissionsService(prismaWithWorkspaceRole("GUEST"));

    await expect(service.requireWorkspaceRole(ctx, "workspace-1", "MEMBER")).rejects.toBeInstanceOf(AtlasHttpError);
  });

  it("allows workspace admins to administer any project in the workspace", async () => {
    const service = new PermissionsService(prismaWithWorkspaceRole("ADMIN"));

    await expect(service.requireProjectRole(ctx, "workspace-1", "project-1", "PROJECT_ADMIN")).resolves.toBeUndefined();
  });
});
