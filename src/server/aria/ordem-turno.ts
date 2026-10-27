import type { AcaoAgenteIATipo } from "@prisma/client";

export const ORDEM_APLICACAO_TURNO: readonly AcaoAgenteIATipo[] = [
  "MOVER_ETAPA", "TAG", "ATUALIZAR_CAMPO", "CRIAR_TAREFA", "NOTA_INTERNA", "MARCAR_PERDIDO",
  "CONDICAO_COMERCIAL", "AGENDAR_MENSAGEM", "RESPONDER", "ENVIAR_DOCUMENTO",
];

const posicao = (acao: AcaoAgenteIATipo) => {
  const i = ORDEM_APLICACAO_TURNO.indexOf(acao);
  return i < 0 ? ORDEM_APLICACAO_TURNO.length : i;
};

export function ordenarPorAplicacao<T extends { acao: AcaoAgenteIATipo }>(acoes: readonly T[]): T[] {
  return acoes.map((a, i) => ({ a, i })).sort((x, y) => posicao(x.a.acao) - posicao(y.a.acao) || x.i - y.i).map((x) => x.a);
}

export const VERBO_ACAO_TURNO: Record<AcaoAgenteIATipo, string> = {
  MOVER_ETAPA: "mover de etapa",
  TAG: "aplicar a tag",
  ATUALIZAR_CAMPO: "atualizar o campo",
  CRIAR_TAREFA: "criar a tarefa",
  NOTA_INTERNA: "registrar a nota interna",
  MARCAR_PERDIDO: "marcar como perdido",
  CONDICAO_COMERCIAL: "registrar a condição comercial",
  AGENDAR_MENSAGEM: "agendar a mensagem",
  RESPONDER: "enviar a resposta",
  ENVIAR_DOCUMENTO: "enviar o documento",
  HANDOFF: "transferir o atendimento",
  CLASSIFICAR_SETOR: "classificar o setor",
};
