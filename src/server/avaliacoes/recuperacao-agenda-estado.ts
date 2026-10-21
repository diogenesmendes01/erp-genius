import { createHash } from "node:crypto";
import type { conferirAgendaRecuperacaoTx } from "./recuperacao-agenda-tx";
export function baseAgendaRecuperacao(c: Awaited<ReturnType<typeof conferirAgendaRecuperacaoTx>>) {
  const { conferidoEm, ...base } = c;
  void conferidoEm;
  return base;
}
/** Canonicaliza objetos persistidos como JSONB, cuja ordem de chaves não é contratual. */
export function hashAgendaRecuperacao(valor: unknown): string {
  function canon(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,x]) => [k,canon(x)]));
    return v;
  }
  return createHash("sha256").update(JSON.stringify(canon(valor))).digest("hex");
}
