/** Regras puras de Q117. A liberação é uma autorização; a aplicação é futura e transacional. */
export type PapelAditivo = "SECRETARIA_ACADEMICA" | "ADMINISTRADOR" | string;
export type AtorAditivo = { id: string; ativo: boolean; papeis: readonly PapelAditivo[] };
export type ConclusaoOriginalAditivo = { id: string; matriculaId: string; artefatoId: string };
export type BaseAditivo = { matriculaId: string; originalId: string; conclusaoOriginalId: string; aditivosAnterioresIds: readonly string[]; versao: string; hash: string };
export type AprovacaoAplicavelAditivo = { id: string; propostaId: string; versaoProposta: string; estado: "PENDENTE" | "APROVADA" | "REJEITADA" };
/** Deve ser montado pelo serviço a partir das alçadas persistidas, nunca de campos do cliente. */
export type ContextoAlcadasAditivo = { aprovacoesNecessariasIds: readonly string[] };
export type PropostaAditivo = { id: string; matriculaId: string; originalId: string; conclusaoOriginalId: string; aditivosAnterioresIds: readonly string[]; baseVersao: string; baseHash: string; versao: string; modeloVersaoId: string; alteracoesHash: string; motivo: string; vigencia: string; preparadaPorId: string; estado: "PREPARADA" | "APROVADA"; aprovadaPorId?: string };
export type FormalizacaoAditivo = { propostaId: string; versaoProposta: string; matriculaId: string; originalId: string; conclusaoOriginalId: string; aditivoId: string; modeloVersaoId: string; alteracoesHash: string; vigencia: string; modeloAprovado: boolean; pdfHash: string; assinaturasCompletas: boolean };
export type ConferenciaSecretariaAditivo = { propostaId: string; versaoProposta: string; aditivoId: string; conclusaoOriginalId: string; pdfHash: string; conferente: AtorAditivo; conferida: boolean };
export type LiberacaoAplicacaoAditivo = { liberada: true; propostaId: string; aditivoId: string; matriculaId: string; alteracoesHash: string; vigencia: string; criaMatricula: false; emiteTaxa: false };

function falhar(mensagem: string): never { throw new Error(mensagem); }
function texto(valor: string, nome: string) { if (!valor.trim()) falhar(`${nome} é obrigatório.`); }
function hashSha256(valor: string, nome: string) { if (!/^[a-f0-9]{64}$/.test(valor)) falhar(`${nome} exige hash SHA-256 hexadecimal.`); }
function vigenciaIsoComOffset(valor: string) { const m = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(valor); if (!m || Number.isNaN(Date.parse(valor)) || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1 || Number(m[3]) > new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate()) falhar("Vigência exige data ISO com offset."); }
function secretariaOuAdmin(ator: AtorAditivo) { return !!ator.id.trim() && ator.ativo && (ator.papeis.includes("SECRETARIA_ACADEMICA") || ator.papeis.includes("ADMINISTRADOR")); }
function adminAtivo(ator: AtorAditivo) { return !!ator.id.trim() && ator.ativo && ator.papeis.includes("ADMINISTRADOR"); }
function listaValida(ids: readonly string[], nome: string) { const vistos = new Set<string>(); for (const id of ids) { texto(id, nome); if (vistos.has(id)) falhar(`${nome} contém identidade duplicada.`); vistos.add(id); } }
function mesmaLista(a: readonly string[], b: readonly string[]) { return a.length === b.length && a.every((id, i) => id === b[i]); }
function conferirBase(base: BaseAditivo, conclusao: ConclusaoOriginalAditivo, proposta: Pick<PropostaAditivo, "matriculaId" | "originalId" | "conclusaoOriginalId" | "aditivosAnterioresIds" | "baseVersao" | "baseHash">) {
  for (const [valor, nome] of [[base.matriculaId, "Matrícula"], [base.originalId, "Original"], [base.conclusaoOriginalId, "Conclusão"], [base.versao, "Versão da base"], [conclusao.id, "Conclusão"], [conclusao.matriculaId, "Matrícula"], [conclusao.artefatoId, "Original"]] as const) texto(valor, nome);
  hashSha256(base.hash, "Hash da base"); listaValida(base.aditivosAnterioresIds, "Cadeia de aditivos");
  if (base.aditivosAnterioresIds.includes(base.originalId)) falhar("O original não pode reaparecer como aditivo anterior.");
  if (base.matriculaId !== proposta.matriculaId || base.originalId !== proposta.originalId || base.conclusaoOriginalId !== proposta.conclusaoOriginalId || !mesmaLista(base.aditivosAnterioresIds, proposta.aditivosAnterioresIds) || base.versao !== proposta.baseVersao || base.hash !== proposta.baseHash) falhar("A base atual não corresponde à proposta de aditivo.");
  if (conclusao.id !== proposta.conclusaoOriginalId || conclusao.matriculaId !== proposta.matriculaId || conclusao.artefatoId !== proposta.originalId) falhar("A conclusão não corresponde à matrícula ou ao original do aditivo.");
}
function conferirAprovacoes(proposta: PropostaAditivo, contexto: ContextoAlcadasAditivo, aprovacoes: readonly AprovacaoAplicavelAditivo[]) {
  listaValida(contexto.aprovacoesNecessariasIds, "Alçadas necessárias"); const recebidas = new Set<string>();
  for (const aprovacao of aprovacoes) { texto(aprovacao.id, "Aprovação aplicável"); if (recebidas.has(aprovacao.id)) falhar("Aprovações aplicáveis contêm identidade duplicada."); recebidas.add(aprovacao.id); if (aprovacao.propostaId !== proposta.id || aprovacao.versaoProposta !== proposta.versao) falhar("A aprovação aplicável não corresponde à proposta exata."); if (aprovacao.estado !== "APROVADA") falhar("Há aprovação aplicável pendente ou rejeitada."); }
  if (recebidas.size !== contexto.aprovacoesNecessariasIds.length || contexto.aprovacoesNecessariasIds.some(id => !recebidas.has(id))) falhar("Falta aprovação de alçada aplicável.");
}

export function prepararAditivo(input: { propostaId: string; versaoProposta: string; preparador: AtorAditivo; conclusaoOriginal: ConclusaoOriginalAditivo; base: BaseAditivo; modeloVersaoId: string; alteracoesHash: string; motivo: string; vigencia: string }): PropostaAditivo {
  if (!secretariaOuAdmin(input.preparador)) falhar("Preparação exige Secretaria ou Administração ativa.");
  for (const [valor, nome] of [[input.propostaId, "Proposta"], [input.versaoProposta, "Versão da proposta"], [input.modeloVersaoId, "Versão do modelo"], [input.motivo, "Motivo"]] as const) texto(valor, nome);
  hashSha256(input.alteracoesHash, "Hash das alterações"); vigenciaIsoComOffset(input.vigencia); const { base, conclusaoOriginal } = input;
  if (base.matriculaId !== conclusaoOriginal.matriculaId || base.originalId !== conclusaoOriginal.artefatoId || base.conclusaoOriginalId !== conclusaoOriginal.id) falhar("A base não corresponde ao contrato original concluído.");
  conferirBase(base, conclusaoOriginal, { matriculaId: base.matriculaId, originalId: base.originalId, conclusaoOriginalId: base.conclusaoOriginalId, aditivosAnterioresIds: base.aditivosAnterioresIds, baseVersao: base.versao, baseHash: base.hash });
  return { id: input.propostaId, versao: input.versaoProposta, matriculaId: base.matriculaId, originalId: base.originalId, conclusaoOriginalId: base.conclusaoOriginalId, aditivosAnterioresIds: [...base.aditivosAnterioresIds], baseVersao: base.versao, baseHash: base.hash, modeloVersaoId: input.modeloVersaoId, alteracoesHash: input.alteracoesHash, motivo: input.motivo, vigencia: input.vigencia, preparadaPorId: input.preparador.id, estado: "PREPARADA" };
}
export function aprovarAditivo(input: { proposta: PropostaAditivo; aprovador: AtorAditivo; conclusaoOriginal: ConclusaoOriginalAditivo; baseAtual: BaseAditivo }): PropostaAditivo {
  const { proposta } = input; if (proposta.estado !== "PREPARADA") falhar("A proposta já foi decidida."); if (!adminAtivo(input.aprovador) || input.aprovador.id === proposta.preparadaPorId) falhar("Aprovação exige outro administrador ativo."); conferirBase(input.baseAtual, input.conclusaoOriginal, proposta); hashSha256(proposta.alteracoesHash, "Hash das alterações"); vigenciaIsoComOffset(proposta.vigencia); return { ...proposta, estado: "APROVADA", aprovadaPorId: input.aprovador.id };
}
export function liberarAplicacaoAditivo(input: { proposta: PropostaAditivo; conclusaoOriginal: ConclusaoOriginalAditivo; baseAtual: BaseAditivo; contextoAlcadasServidor: ContextoAlcadasAditivo; aprovacoesAplicaveis: readonly AprovacaoAplicavelAditivo[]; formalizacao: FormalizacaoAditivo; conferenciaSecretaria: ConferenciaSecretariaAditivo; jaAplicada: boolean }): LiberacaoAplicacaoAditivo {
  const { proposta, formalizacao, conferenciaSecretaria } = input; if (input.jaAplicada) falhar("O aditivo já foi aplicado."); if (proposta.estado !== "APROVADA" || !proposta.aprovadaPorId || proposta.aprovadaPorId === proposta.preparadaPorId) falhar("Aplicação exige aprovação interna independente.");
  conferirBase(input.baseAtual, input.conclusaoOriginal, proposta); conferirAprovacoes(proposta, input.contextoAlcadasServidor, input.aprovacoesAplicaveis);
  if (formalizacao.propostaId !== proposta.id || formalizacao.versaoProposta !== proposta.versao || formalizacao.matriculaId !== proposta.matriculaId || formalizacao.originalId !== proposta.originalId || formalizacao.conclusaoOriginalId !== proposta.conclusaoOriginalId || formalizacao.modeloVersaoId !== proposta.modeloVersaoId || formalizacao.alteracoesHash !== proposta.alteracoesHash || formalizacao.vigencia !== proposta.vigencia) falhar("A formalização não corresponde à proposta exata.");
  if (!formalizacao.aditivoId || !formalizacao.modeloAprovado || !formalizacao.assinaturasCompletas) falhar("Aplicação exige formalização completa do aditivo."); hashSha256(formalizacao.pdfHash, "Hash do PDF"); hashSha256(formalizacao.alteracoesHash, "Hash das alterações"); vigenciaIsoComOffset(formalizacao.vigencia);
  if (conferenciaSecretaria.propostaId !== proposta.id || conferenciaSecretaria.versaoProposta !== proposta.versao || conferenciaSecretaria.aditivoId !== formalizacao.aditivoId || conferenciaSecretaria.conclusaoOriginalId !== formalizacao.conclusaoOriginalId || conferenciaSecretaria.pdfHash !== formalizacao.pdfHash || !secretariaOuAdmin(conferenciaSecretaria.conferente) || !conferenciaSecretaria.conferida) falhar("Aplicação exige conferência da Secretaria do PDF formalizado.");
  return { liberada: true, propostaId: proposta.id, aditivoId: formalizacao.aditivoId, matriculaId: proposta.matriculaId, alteracoesHash: proposta.alteracoesHash, vigencia: proposta.vigencia, criaMatricula: false, emiteTaxa: false };
}
