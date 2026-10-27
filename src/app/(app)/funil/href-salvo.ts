export function hrefSalvo(f: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/funil?${s}` : "/funil";
}
