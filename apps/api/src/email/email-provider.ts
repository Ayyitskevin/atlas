export type EmailRecipient = {
  email: string;
  name?: string | null;
};

export type EmailDraft = {
  metadata?: Record<string, string>;
  subject: string;
  text: string;
  to: EmailRecipient[];
};

export type EmailSendResult = {
  acceptedRecipientCount: number;
  provider: string;
  providerMessageId?: string;
  stubbed: boolean;
};

export type EmailDeliveryOutcome = {
  provider: string;
  providerMessageId?: string;
  reason?: string;
  recipientCount: number;
  status: "delivered" | "failed" | "stubbed";
};

export type EmailProvider = {
  readonly from: string;
  readonly name: string;
  send(draft: EmailDraft): Promise<EmailSendResult>;
};

export type EmailProviderName = "noop" | "resend";

type EmailProviderConfig = {
  from: string;
  provider: EmailProviderName;
  resendApiKey?: string;
  resendApiUrl?: string;
};

export function createEmailProvider(config: EmailProviderConfig): EmailProvider {
  switch (config.provider) {
    case "noop":
      return createNoopEmailProvider({ from: config.from });
    case "resend":
      return createResendEmailProvider({
        apiKey: requiredConfig(config.resendApiKey, "RESEND_API_KEY is required when EMAIL_PROVIDER=resend."),
        apiUrl: config.resendApiUrl,
        from: config.from,
      });
  }
}

export function createNoopEmailProvider(input: { from?: string } = {}): EmailProvider {
  return {
    from: input.from ?? "no-reply@atlas.local",
    name: "noop",
    async send(draft) {
      return {
        acceptedRecipientCount: draft.to.length,
        provider: "noop",
        stubbed: true,
      };
    },
  };
}

type EmailFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export function createResendEmailProvider(input: {
  apiKey: string;
  apiUrl?: string;
  fetch?: EmailFetch;
  from?: string;
}): EmailProvider {
  const apiUrl = input.apiUrl ?? "https://api.resend.com";
  const fetchEmail = input.fetch ?? globalThis.fetch;
  if (!fetchEmail) throw new Error("Global fetch is required for EMAIL_PROVIDER=resend.");

  return {
    from: input.from ?? "no-reply@atlas.local",
    name: "resend",
    async send(draft) {
      const idempotencyKey = draft.metadata?.eventId ? "atlas-" + draft.metadata.eventId : undefined;
      const headers: Record<string, string> = {
        Authorization: "Bearer " + input.apiKey,
        "Content-Type": "application/json",
      };
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

      const response = await fetchEmail(emailEndpoint(apiUrl), {
        body: JSON.stringify({
          from: input.from ?? "no-reply@atlas.local",
          subject: draft.subject,
          text: draft.text,
          to: draft.to.map(recipientAddress),
        }),
        headers,
        method: "POST",
      });
      const payload = await safeJson(response);
      if (!response.ok) throw new Error(resendErrorMessage(response.status, payload));

      return {
        acceptedRecipientCount: draft.to.length,
        provider: "resend",
        providerMessageId: stringField(payload, "id"),
        stubbed: false,
      };
    },
  };
}

function emailEndpoint(apiUrl: string) {
  return apiUrl.replace(/\/+$/, "") + "/emails";
}

function recipientAddress(recipient: EmailRecipient) {
  const email = recipient.email.trim();
  const name = recipient.name?.replace(/[\r\n<>]/g, " ").trim();
  return name ? name + " <" + email + ">" : email;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function resendErrorMessage(status: number, payload: unknown) {
  const message = stringField(payload, "message") ?? "Resend email request failed.";
  const name = stringField(payload, "name");
  return "Resend " + status + (name ? " " + name : "") + ": " + message;
}

function stringField(payload: unknown, key: string) {
  if (!isRecord(payload)) return undefined;
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredConfig(value: string | undefined, message: string) {
  if (!value?.trim()) throw new Error(message);
  return value;
}
