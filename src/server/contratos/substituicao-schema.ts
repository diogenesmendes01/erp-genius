import { z } from "zod";

const identificador = z.string().trim().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const motivo = z.string().trim().min(5).max(4000);

/** Entrada humana. Autoria, diferenças, snapshot e versão são derivados pelo
 * serviço, que deve recarregar as conferências e validar a revisão atual. */
export const PrepararSubstituicaoContratualSchema = z.object({
  processoFonteId: identificador,
  conferenciaSubstitutoId: identificador,
  revisaoFonteEsperada: hash,
  revisaoSubstitutoEsperada: hash,
  motivo,
  chaveIdempotencia: z.string().trim().min(8).max(200),
}).strict();

/** O hash identifica a proposta que a pessoa revisou; não comprova permissão.
 * A identidade do decisor deve vir da sessão, nunca deste formulário. */
export const DecidirSubstituicaoContratualSchema = z.object({
  propostaId: identificador,
  propostaHashEsperado: hash,
  aprovada: z.boolean(),
  motivo,
}).strict();
