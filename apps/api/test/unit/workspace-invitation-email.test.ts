import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { EmailProvider } from "../../src/email/email-provider.js";
import {
  sendWorkspaceInvitationEmail,
  workspaceInvitationEmailDraft,
  type WorkspaceInvitationEmailInput,
} from "../../src/email/workspace-invitation-email.js";

describe("workspace invitation email", () => {
  it("builds an invitation email with the accept link outside metadata", () => {
    const input = invitationEmailInput({ acceptToken: "accept token with spaces" });

    const draft = workspaceInvitationEmailDraft(input);

    expect(draft).toMatchObject({
      metadata: {
        invitationId: input.invitationId,
        role: "MEMBER",
        workspaceId: input.workspaceId,
      },
      subject: "Alice Admin invited you to Launch Workspace on Atlas",
      to: [{ email: input.email }],
    });
    expect(draft.text).toContain("https://app.example.com/invite?token=accept%20token%20with%20spaces");
    expect(JSON.stringify(draft.metadata)).not.toContain(input.acceptToken);
  });

  it("returns a delivered outcome from provider success without exposing the token", async () => {
    const input = invitationEmailInput({ acceptToken: "secret-token" });
    const provider = emailProvider(
      vi.fn<EmailProvider["send"]>().mockResolvedValue({
        acceptedRecipientCount: 1,
        provider: "test-email",
        providerMessageId: "provider-message",
        stubbed: false,
      }),
    );

    await expect(sendWorkspaceInvitationEmail(provider, input)).resolves.toEqual({
      provider: "test-email",
      providerMessageId: "provider-message",
      recipientCount: 1,
      status: "delivered",
    });
  });

  it("returns a failed outcome when the provider rejects", async () => {
    const provider = emailProvider(vi.fn<EmailProvider["send"]>().mockRejectedValue(new Error("provider offline")));

    await expect(sendWorkspaceInvitationEmail(provider, invitationEmailInput())).resolves.toEqual({
      provider: "test-email",
      reason: "provider offline",
      recipientCount: 1,
      status: "failed",
    });
  });
});

function invitationEmailInput(input: Partial<WorkspaceInvitationEmailInput> = {}): WorkspaceInvitationEmailInput {
  return {
    acceptToken: "accept-token",
    email: "invitee@example.com",
    expiresAt: new Date("2026-07-09T00:00:00.000Z"),
    invitationId: randomUUID(),
    invitedByName: "Alice Admin",
    role: "MEMBER",
    webOrigin: "https://app.example.com/",
    workspaceId: randomUUID(),
    workspaceName: "Launch Workspace",
    ...input,
  };
}

function emailProvider(send: EmailProvider["send"]): EmailProvider {
  return {
    from: "no-reply@example.com",
    name: "test-email",
    send,
  };
}
