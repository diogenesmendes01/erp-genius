/**
 * Regras puras para Q116. Elas não enviam, cancelam ou armazenam nada no
 * fornecedor: a orquestração deve persistir cada fato antes da chamada externa.
 */

export type PapelSubstituicao = "SECRETARIA_ACADEMICA" | "ADMINISTRADOR" | string;
export type AtorSubstituicao = { id: string; ativo: boolean; papeis: readonly PapelSubstituicao[] };
export type EstadoProcessoFonte = "PREPARADO" | "ENVIANDO" | "ENVIO_INCERTO" | "ENVIADO" | "CANCELADO";
export type ProcessoFonteSubstituicao = {
  id: string;
  matriculaId: string;
  artefatoId: string;
  estado: EstadoProcessoFonte;
  revisaoHash: string;
  referenciaExterna: string;
};
/** A existência desta conclusão é a única prova de assinatura total nesta regra.
 * Assinaturas ou evidências parciais não entram nesta API como conclusão. */
export type ConclusaoAssinaturaFonte = { processoId: string; matriculaId: string; artefatoId: string };

export type PropostaSubstituicao = {
  id: string;
  processoFonteId: string;
  matriculaFonteId: string;
  matriculaSubstitutoId: string;
  artefatoFonteId: string;
  artefatoSubstitutoId: string;
  revisaoFonteHash: string;
  revisaoSubstitutoHash: string;
  preparadaPorId: string;
  estado: "PREPARADA" | "APROVADA";
  aprovadaPorId?: string;
};

export type LiberacaoSubstituto = {
  liberada: true;
  processoFonteId: string;
  artefatoSubstitutoId: string;
  revisaoSubstitutoHash: string;
  assinaturasHerdadas: [];
};
export type AutorizacaoInicioCancelamento = {
  propostaId: string;
  processoFonteId: string;
  matriculaId: string;
  artefatoFonteId: string;
  artefatoSubstitutoId: string;
  revisaoFonteHash: string;
  revisaoSubstitutoHash: string;
  executorId: string;
  tentativaId: string;
  referenciaExterna: string;
};
export type ProvaCancelamentoExterno =
  | { resultado: "CONFIRMADO"; propostaId: string; processoFonteId: string; tentativaId: string; referenciaExterna: string; evidenciaHash: string }
  | { resultado: "INCERTO"; propostaId: string; processoFonteId: string; tentativaId: string };

function falhar(mensagem: string): never { throw new Error(mensagem); }
function administradorAtivo(ator: AtorSubstituicao) {
  return ator.ativo && ator.papeis.includes("ADMINISTRADOR");
}
function preparadorPermitido(ator: AtorSubstituicao) {
  return ator.ativo && (ator.papeis.includes("SECRETARIA_ACADEMICA") || ator.papeis.includes("ADMINISTRADOR"));
}
function conferirFonte(processo: ProcessoFonteSubstituicao, conclusao: ConclusaoAssinaturaFonte | null, proposta: Pick<PropostaSubstituicao, "processoFonteId" | "matriculaFonteId" | "artefatoFonteId" | "revisaoFonteHash">, revisaoFonteAtual: string) {
  if (processo.id !== proposta.processoFonteId || processo.matriculaId !== proposta.matriculaFonteId || processo.artefatoId !== proposta.artefatoFonteId || processo.revisaoHash !== proposta.revisaoFonteHash || processo.revisaoHash !== revisaoFonteAtual) {
    falhar("A proposta não corresponde ao processo ou à revisão atual da fonte.");
  }
  if (conclusao && (conclusao.processoId !== processo.id || conclusao.matriculaId !== processo.matriculaId || conclusao.artefatoId !== processo.artefatoId)) {
    falhar("A conclusão não corresponde ao processo, matrícula ou original da fonte.");
  }
  if (conclusao) falhar("Contrato totalmente assinado exige o fluxo de aditivo Q117.");
  if (processo.estado !== "ENVIADO") falhar("Substituição exige processo externo enviado e sem resultado incerto.");
}

export function prepararSubstituicao(input: {
  propostaId: string;
  preparador: AtorSubstituicao;
  processoFonte: ProcessoFonteSubstituicao;
  conclusaoFonte: ConclusaoAssinaturaFonte | null;
  matriculaSubstitutoId: string;
  artefatoSubstitutoId: string;
  revisaoFonteAtual: string;
  revisaoSubstitutoAtual: string;
}): PropostaSubstituicao {
  if (!preparadorPermitido(input.preparador)) falhar("Preparação exige Secretaria ou Administração ativa.");
  if (!input.propostaId || !input.matriculaSubstitutoId || !input.artefatoSubstitutoId || !input.revisaoSubstitutoAtual) falhar("A proposta de substituição está incompleta.");
  if (input.matriculaSubstitutoId !== input.processoFonte.matriculaId) falhar("O substituto deve pertencer à mesma matrícula da fonte.");
  if (input.artefatoSubstitutoId === input.processoFonte.artefatoId) falhar("O substituto exige original diferente da fonte.");
  conferirFonte(input.processoFonte, input.conclusaoFonte, { processoFonteId: input.processoFonte.id, matriculaFonteId: input.processoFonte.matriculaId, artefatoFonteId: input.processoFonte.artefatoId, revisaoFonteHash: input.processoFonte.revisaoHash }, input.revisaoFonteAtual);
  return {
    id: input.propostaId,
    processoFonteId: input.processoFonte.id,
    matriculaFonteId: input.processoFonte.matriculaId,
    matriculaSubstitutoId: input.matriculaSubstitutoId,
    artefatoFonteId: input.processoFonte.artefatoId,
    artefatoSubstitutoId: input.artefatoSubstitutoId,
    revisaoFonteHash: input.revisaoFonteAtual,
    revisaoSubstitutoHash: input.revisaoSubstitutoAtual,
    preparadaPorId: input.preparador.id,
    estado: "PREPARADA",
  };
}

function conferirIdentidadeSubstituto(proposta: PropostaSubstituicao) {
  if (proposta.matriculaSubstitutoId !== proposta.matriculaFonteId) falhar("O substituto deve pertencer à mesma matrícula da fonte.");
  if (!proposta.artefatoSubstitutoId || proposta.artefatoSubstitutoId === proposta.artefatoFonteId) falhar("O substituto exige original diferente da fonte.");
}

export function aprovarSubstituicao(input: {
  proposta: PropostaSubstituicao;
  aprovador: AtorSubstituicao;
  processoFonte: ProcessoFonteSubstituicao;
  conclusaoFonte: ConclusaoAssinaturaFonte | null;
  revisaoFonteAtual: string;
  revisaoSubstitutoAtual: string;
}): PropostaSubstituicao {
  const { proposta } = input;
  conferirIdentidadeSubstituto(proposta);
  if (proposta.estado !== "PREPARADA") falhar("A proposta já foi decidida.");
  if (!administradorAtivo(input.aprovador) || input.aprovador.id === proposta.preparadaPorId) {
    falhar("Aprovação exige outro administrador ativo.");
  }
  conferirFonte(input.processoFonte, input.conclusaoFonte, proposta, input.revisaoFonteAtual);
  if (proposta.revisaoSubstitutoHash !== input.revisaoSubstitutoAtual) falhar("A revisão do substituto mudou; prepare nova proposta.");
  return { ...proposta, estado: "APROVADA", aprovadaPorId: input.aprovador.id };
}

/** Autoriza somente o início da chamada externa; a orquestração persiste esta
 * identidade antes de chamar o fornecedor e usa-a na confirmação posterior. */
export function autorizarInicioCancelamentoSubstituicao(input: {
  proposta: PropostaSubstituicao;
  executor: AtorSubstituicao;
  tentativaId: string;
  processoFonte: ProcessoFonteSubstituicao;
  conclusaoFonte: ConclusaoAssinaturaFonte | null;
  revisaoFonteAtual: string;
  revisaoSubstitutoAtual: string;
}): AutorizacaoInicioCancelamento {
  const { proposta } = input;
  conferirIdentidadeSubstituto(proposta);
  if (proposta.estado !== "APROVADA" || !proposta.aprovadaPorId || proposta.aprovadaPorId === proposta.preparadaPorId) falhar("Cancelamento exige aprovação independente da proposta exata.");
  if (!preparadorPermitido(input.executor)) falhar("Cancelamento exige Secretaria ou Administração ativa.");
  if (!input.tentativaId) falhar("Cancelamento exige a intenção identificada da tentativa.");
  conferirFonte(input.processoFonte, input.conclusaoFonte, proposta, input.revisaoFonteAtual);
  if (proposta.matriculaSubstitutoId !== proposta.matriculaFonteId || proposta.revisaoSubstitutoHash !== input.revisaoSubstitutoAtual) falhar("A revisão do substituto mudou; não inicie o cancelamento.");
  return { propostaId: proposta.id, processoFonteId: proposta.processoFonteId, matriculaId: proposta.matriculaFonteId,
    artefatoFonteId: proposta.artefatoFonteId, artefatoSubstitutoId: proposta.artefatoSubstitutoId,
    revisaoFonteHash: proposta.revisaoFonteHash, revisaoSubstitutoHash: proposta.revisaoSubstitutoHash, executorId: input.executor.id,
    tentativaId: input.tentativaId, referenciaExterna: input.processoFonte.referenciaExterna };
}

/** Resultado da chamada externa já autenticada. Resultado incerto permanece
 * identificável para conciliação e nunca libera o substituto. */
export function confirmarCancelamentoParaSubstituicao(input: {
  proposta: PropostaSubstituicao;
  autorizacao: AutorizacaoInicioCancelamento;
  processoFonte: ProcessoFonteSubstituicao;
  conclusaoFonte: ConclusaoAssinaturaFonte | null;
  revisaoFonteAtual: string;
  revisaoSubstitutoAtual: string;
  prova: ProvaCancelamentoExterno;
}): LiberacaoSubstituto | { liberada: false; motivo: "CANCELAMENTO_INCERTO"; tentativaId: string } {
  const { proposta } = input;
  conferirIdentidadeSubstituto(proposta);
  if (proposta.estado !== "APROVADA" || !proposta.aprovadaPorId || proposta.aprovadaPorId === proposta.preparadaPorId) falhar("Cancelamento exige aprovação independente da proposta exata.");
  if (input.autorizacao.propostaId !== proposta.id || input.autorizacao.processoFonteId !== proposta.processoFonteId
    || input.autorizacao.matriculaId !== proposta.matriculaFonteId || input.autorizacao.artefatoFonteId !== proposta.artefatoFonteId
    || input.autorizacao.artefatoSubstitutoId !== proposta.artefatoSubstitutoId || input.autorizacao.revisaoFonteHash !== proposta.revisaoFonteHash
    || input.autorizacao.revisaoSubstitutoHash !== proposta.revisaoSubstitutoHash || input.autorizacao.referenciaExterna !== input.processoFonte.referenciaExterna) falhar("A confirmação não corresponde à autorização de cancelamento.");
  if (input.prova.propostaId !== proposta.id || input.prova.processoFonteId !== proposta.processoFonteId || input.prova.tentativaId !== input.autorizacao.tentativaId) falhar("A prova externa não corresponde à proposta, processo ou tentativa.");
  conferirFonte(input.processoFonte, input.conclusaoFonte, proposta, input.revisaoFonteAtual);
  if (proposta.revisaoSubstitutoHash !== input.revisaoSubstitutoAtual) falhar("A revisão do substituto mudou; não libere o novo processo.");
  if (input.prova.resultado === "INCERTO") return { liberada: false, motivo: "CANCELAMENTO_INCERTO", tentativaId: input.prova.tentativaId };
  if (input.prova.referenciaExterna !== input.autorizacao.referenciaExterna || !input.prova.evidenciaHash) falhar("Cancelamento confirmado exige referência e evidência externa exatas.");
  return {
    liberada: true,
    processoFonteId: proposta.processoFonteId,
    artefatoSubstitutoId: proposta.artefatoSubstitutoId,
    revisaoSubstitutoHash: proposta.revisaoSubstitutoHash,
    assinaturasHerdadas: [],
  };
}
