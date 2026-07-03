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

export type EmailProvider = {
  readonly from: string;
  readonly name: string;
  send(draft: EmailDraft): Promise<EmailSendResult>;
};

export type EmailProviderName = "noop";

type EmailProviderConfig = {
  from: string;
  provider: EmailProviderName;
};

export function createEmailProvider(config: EmailProviderConfig): EmailProvider {
  switch (config.provider) {
    case "noop":
      return createNoopEmailProvider({ from: config.from });
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
