export function prazoDoToken(exp: unknown): number | null {
  return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
}
