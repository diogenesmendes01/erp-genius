import { instanteDoCampoLocal } from "@/server/operacao/fuso-entrada";
import { ErroRegra } from "./sessao";

/**
 * Conversão explícita, NO SERVIDOR, do texto de um `<input type="datetime-local">` no fuso que a tela escreveu ao lado
 * do campo (ver src/server/operacao/fuso-entrada.ts). Nada depende do fuso do processo: formato inválido, fuso inválido
 * ou horário pulado/repetido no horário de verão viram ErroRegra (mensagem legível para a tela), nunca um fallback.
 */
export function exigirInstanteDoCampoLocal(local: unknown, fuso: unknown): Date {
  const r = instanteDoCampoLocal(typeof local === "string" ? local : "", typeof fuso === "string" ? fuso : "");
  if (!r.ok) throw new ErroRegra(r.erro);
  return r.instante;
}
