export type AuthQueryTokens = {
  resetToken: string;
  verifyToken: string;
};

export function readAuthQueryTokens(search: string): AuthQueryTokens {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    resetToken: params.get("resetToken")?.trim() || "",
    verifyToken: params.get("verifyToken")?.trim() || "",
  };
}

export function authModeFromQuery(tokens: AuthQueryTokens): "login" | "reset" {
  return tokens.resetToken ? "reset" : "login";
}
