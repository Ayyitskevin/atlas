import type { WorkspaceRole } from "@atlas/db";

import type { EmailDeliveryOutcome, EmailDraft, EmailProvider } from "./email-provider.js";

export type WorkspaceInvitationEmailInput = {
  acceptToken: string;
  email: string;
  expiresAt: Date;
  invitedByName: string;
  invitationId: string;
  role: Exclude<WorkspaceRole, "OWNER">;
  webOrigin: string;
  workspaceId: string;
  workspaceName: string;
};

export async function sendWorkspaceInvitationEmail(
  emailProvider: EmailProvider,
  input: WorkspaceInvitationEmailInput,
): Promise<EmailDeliveryOutcome> {
  try {
    const result = await emailProvider.send(workspaceInvitationEmailDraft(input));
    return {
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      recipientCount: result.acceptedRecipientCount,
      status: result.stubbed ? "stubbed" : "delivered",
    };
  } catch (error) {
    return {
      provider: emailProvider.name,
      reason: errorMessage(error),
      recipientCount: 1,
      status: "failed",
    };
  }
}

export function workspaceInvitationEmailDraft(input: WorkspaceInvitationEmailInput): EmailDraft {
  const inviteLink = invitationLink(input.webOrigin, input.acceptToken);
  return {
    metadata: {
      invitationId: input.invitationId,
      role: input.role,
      workspaceId: input.workspaceId,
    },
    subject: input.invitedByName + " invited you to " + input.workspaceName + " on Atlas",
    text:
      input.invitedByName +
      " invited you to join " +
      input.workspaceName +
      " as " +
      input.role.toLowerCase() +
      ".\n\nAccept the invitation: " +
      inviteLink +
      "\n\nThis invitation expires " +
      input.expiresAt.toISOString() +
      ".",
    to: [{ email: input.email }],
  };
}

function invitationLink(webOrigin: string, token: string): string {
  return webOrigin.replace(/\/+$/, "") + "/invite?token=" + encodeURIComponent(token);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown email provider error.";
}
