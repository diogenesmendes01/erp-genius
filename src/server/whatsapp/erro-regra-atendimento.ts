import { ErroRegra } from "@/server/_shared";

/** Mensagens de domínio de garantirAtendimento (Error comum): quem chama pode exibi-las como regra. */
export const MSG_FINANCEIRO_EXIGE_MATRICULA = "Atendimento financeiro exige matrícula e aluno.";
export const MSG_MATRICULA_EXIGE_ALUNO = "Atendimento com matrícula exige aluno.";
export const MSG_MATRICULA_DE_OUTRO_ALUNO = "Matrícula não pertence ao aluno do atendimento.";
export const MENSAGENS_REGRA_GARANTIR_ATENDIMENTO: ReadonlySet<string> = new Set([
  MSG_FINANCEIRO_EXIGE_MATRICULA, MSG_MATRICULA_EXIGE_ALUNO, MSG_MATRICULA_DE_OUTRO_ALUNO,
]);

/**
 * Só vira ErroRegra o que é regra: o RAISE EXCEPTION de trigger (264/265 etc., SQLSTATE P0001) e as mensagens de
 * domínio conhecidas de garantirAtendimento. Qualquer outro erro (TypeError, falha de registrarEvento, erro do
 * Prisma sem P0001...) é relançado sem mudança, para executarAcao logar e responder com a mensagem genérica.
 */
export function comoErroRegra(e: unknown): never {
  if (e instanceof ErroRegra) throw e;
  if (!(e instanceof Error)) throw e;
  // Trigger com RAISE EXCEPTION (SQLSTATE P0001): o Prisma embute a mensagem do banco no texto do erro.
  const doBanco = /code: "P0001", message: "((?:[^"\\]|\\.)*)"/.exec(e.message)?.[1];
  if (doBanco) throw new ErroRegra(doBanco);
  if (e.constructor === Error && MENSAGENS_REGRA_GARANTIR_ATENDIMENTO.has(e.message)) throw new ErroRegra(e.message);
  throw e;
}
