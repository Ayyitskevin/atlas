import { describe, expect, it, vi } from "vitest";

import { createEmailProvider, createResendEmailProvider } from "../../src/email/email-provider.js";

describe("email providers", () => {
  it("sends email through Resend with bearer auth and idempotency", async () => {
    const fetchEmail = vi.fn().mockResolvedValue(jsonResponse({ id: "email_123" }, 200));
    const provider = createResendEmailProvider({
      apiKey: "resend-secret",
      apiUrl: "https://api.resend.test",
      fetch: fetchEmail,
      from: "Atlas <no-reply@example.com>",
    });

    await expect(
      provider.send({
        metadata: { eventId: "00000000-0000-4000-8000-000000000001" },
        subject: "Task updated",
        text: "A task changed.",
        to: [{ email: "user@example.com", name: "User Name" }],
      }),
    ).resolves.toEqual({
      acceptedRecipientCount: 1,
      provider: "resend",
      providerMessageId: "email_123",
      stubbed: false,
    });

    expect(fetchEmail).toHaveBeenCalledWith("https://api.resend.test/emails", {
      body: JSON.stringify({
        from: "Atlas <no-reply@example.com>",
        subject: "Task updated",
        text: "A task changed.",
        to: ["User Name <user@example.com>"],
      }),
      headers: {
        Authorization: "Bearer resend-secret",
        "Content-Type": "application/json",
        "Idempotency-Key": "atlas-00000000-0000-4000-8000-000000000001",
      },
      method: "POST",
    });
  });

  it("surfaces Resend API errors without exposing the API key", async () => {
    const fetchEmail = vi.fn().mockResolvedValue(jsonResponse({ message: "Missing API key.", name: "missing_api_key" }, 401));
    const provider = createResendEmailProvider({ apiKey: "resend-secret", fetch: fetchEmail });

    await expect(provider.send({ subject: "Hello", text: "World", to: [{ email: "user@example.com" }] })).rejects.toThrow(
      "Resend 401 missing_api_key: Missing API key.",
    );
    await expect(provider.send({ subject: "Hello", text: "World", to: [{ email: "user@example.com" }] })).rejects.not.toThrow(
      "resend-secret",
    );
  });

  it("requires a Resend API key when selected from provider config", () => {
    expect(() => createEmailProvider({ from: "no-reply@example.com", provider: "resend" })).toThrow(
      "RESEND_API_KEY is required when EMAIL_PROVIDER=resend.",
    );
  });
});

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
