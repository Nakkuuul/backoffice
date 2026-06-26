/**
 * Client-side permission engine mirroring the backend (src/shared/rbac.js).
 * /auth/me returns the user's EXPANDED concrete permissions, but we still honor
 * `*` and `domain:*` wildcards so the two can never diverge.
 */
export function can(permissions: readonly string[], need?: string | null): boolean {
  if (!need) return true;
  if (permissions.includes("*")) return true;
  if (permissions.includes(need)) return true;
  const domain = need.split(":")[0];
  return permissions.includes(`${domain}:*`);
}

export function canAny(permissions: readonly string[], needs?: readonly string[]): boolean {
  if (!needs || needs.length === 0) return true;
  return needs.some((n) => can(permissions, n));
}
