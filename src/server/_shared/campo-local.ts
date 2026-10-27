import { instanteDoCampoLocal } from "@/server/operacao/fuso-entrada";
import { ErroRegra } from "./sessao";

export function exigirInstanteDoCampoLocal(local: unknown, fuso: unknown): Date {
  const r = instanteDoCampoLocal(typeof local === "string" ? local : "", typeof fuso === "string" ? fuso : "");
  if (!r.ok) throw new ErroRegra(r.erro);
  return r.instante;
}
