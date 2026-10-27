import { ErroRegra } from "@/server/_shared";

export const MSG_FINANCEIRO_EXIGE_MATRICULA = "Atendimento financeiro exige matrícula e aluno.";
export const MSG_MATRICULA_EXIGE_ALUNO = "Atendimento com matrícula exige aluno.";
export const MSG_MATRICULA_DE_OUTRO_ALUNO = "Matrícula não pertence ao aluno do atendimento.";
export const MENSAGENS_REGRA_GARANTIR_ATENDIMENTO: ReadonlySet<string> = new Set([
  MSG_FINANCEIRO_EXIGE_MATRICULA, MSG_MATRICULA_EXIGE_ALUNO, MSG_MATRICULA_DE_OUTRO_ALUNO,
]);

export function comoErroRegra(e: unknown): never {
  if (e instanceof ErroRegra) throw e;
  if (!(e instanceof Error)) throw e;
  const doBanco = /code: "P0001", message: "((?:[^"\\]|\\.)*)"/.exec(e.message)?.[1];
  if (doBanco) throw new ErroRegra(doBanco);
  if (Object.getPrototypeOf(e) === Error.prototype && MENSAGENS_REGRA_GARANTIR_ATENDIMENTO.has(e.message)) throw new ErroRegra(e.message);
  throw e;
}
