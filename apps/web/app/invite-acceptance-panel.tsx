"use client";

import type { FormEvent } from "react";

type InviteAcceptancePanelProps = {
  onAcceptInvitation: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onTokenChange: (token: string) => void;
  statusMessage: string;
  token: string;
};

export function InviteAcceptancePanel({ onAcceptInvitation, onTokenChange, statusMessage, token }: InviteAcceptancePanelProps) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase text-slate-500">Workspace invitation</h2>
        <p className="text-sm text-slate-600">Accept a pending workspace invite for the signed-in account.</p>
      </div>
      <form className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => void onAcceptInvitation(event)}>
        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          name="token"
          onChange={(event) => onTokenChange(event.target.value)}
          placeholder="Invitation token"
          value={token}
        />
        <button
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!token.trim()}
          type="submit"
        >
          Accept invite
        </button>
      </form>
      {statusMessage ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusMessage}</p> : null}
    </section>
  );
}
