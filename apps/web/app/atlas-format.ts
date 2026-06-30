export function formatEventType(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

export function formatBytes(value: number) {
  if (value < 1024) return value + " B";
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return size.toFixed(size >= 10 ? 0 : 1) + " " + units[unitIndex];
}

export function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
}

export function taskStatusLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

export function workspaceRoleLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

export function projectRoleLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

export function invitationStatus(invitation: {
  acceptedAt?: string | null;
  canceledAt?: string | null;
  declinedAt?: string | null;
  expiresAt: string;
}) {
  if (invitation.acceptedAt) return "accepted";
  if (invitation.canceledAt) return "canceled";
  if (invitation.declinedAt) return "declined";
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) return "expired";
  return "pending";
}
