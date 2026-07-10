/**
 * Extract @mentions from comment bodies.
 * Supports @user@example.com and @FirstLast (case-insensitive name match later).
 */
export function extractMentionTokens(body: string): string[] {
  const matches = body.match(/@([^\s@]+(?:@[^\s@]+)?)/g) ?? [];
  const tokens = matches.map((match) => match.slice(1).trim()).filter(Boolean);
  return [...new Set(tokens.map((token) => token.toLowerCase()))];
}

export function resolveMentionedUserIds(
  tokens: string[],
  members: Array<{ email: string; id: string; name: string }>,
  actorUserId: string,
): string[] {
  if (!tokens.length) return [];
  const byEmail = new Map(members.map((member) => [member.email.toLowerCase(), member.id]));
  const byName = new Map(members.map((member) => [member.name.trim().toLowerCase().replace(/\s+/g, ""), member.id]));
  const ids = new Set<string>();
  for (const token of tokens) {
    const compact = token.replace(/\s+/g, "");
    const byEmailId = byEmail.get(token);
    const byNameId = byName.get(compact);
    const id = byEmailId ?? byNameId;
    if (id && id !== actorUserId) ids.add(id);
  }
  return [...ids];
}
