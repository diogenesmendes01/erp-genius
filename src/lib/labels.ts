import {
  EtapaLead,
  Temperatura,
  Segmento,
  MotivoPerda,
  StatusMatricula,
  StatusCobranca,
  StatusComissao,
  StatusAluno,
  TipoCobranca,
  FormaPagamento,
  Genero,
  Escolaridade,
  SituacaoRelatoMaterialReposicao,
  StatusEncontroAgenda,
  StatusTurma,
  StatusMudancaAcademica,
  StatusReservaSegundaChamada,
  SituacaoPropostaQuantidadeAulas,
  AlcanceImpactoQuantidadeAulas,
  ParticipacaoAula,
  FinalidadeTokenPortalAluno,
  SituacaoEnvioPortalAluno,
  SituacaoTrocaEmailPortalAluno,
  CanalAvisoAlteracaoAgenda,
  SituacaoAvisoAlteracaoAgenda,
  MotivoPendenciaAvisoAgenda,
  StatusReservaVaga,
  StatusCorrecaoCadastro,
  StatusSolicitacaoEncerramento,
  EstadoDiaCompensacao,
  EstadoEnvioAssinatura,
  TipoMovimentacao,
  CategoriaDocumento,
  StatusFaturaB2B,
  TipoSugestaoIA,
  ResultadoEnsaioVinculoMigracao,
  StatusTemplate,
  TipoMensagem,
  StatusIntencao,
  TipoAprovacao,
  Vigencia,
  TipoAjuste,
  TipoDestinacaoRecebimento,
  StatusPagamentoInformado,
  ReferenciaCoberturaMensal,
  FinalidadeNumero,
  FormaAgendaOferta,
  StatusPropostaAcertoTaxaAditivo,
  StatusConjuntoImpactosTaxaAditivo,
  StatusConjuntoImpactosCoberturaAditivo,
  DecisaoImpactoTaxaAditivo,
  ClassificacaoImpactoCoberturaAditivo,
  StatusPropostaConciliacaoFinanceiraMigracao,
  StatusPropostaEntradaFinanceiraHistoricaMigracao,
  ModalidadeConciliacaoFinanceiraMigracao,
  EstadoReservaDevolucaoCredito,
  EstadoReconferenciaDeltaDesistencia,
  UnidadePermutaServico,
  EstadoLinhaPreparacaoMigracao,
  SituacaoAplicacaoCadastroMigracao,
  StatusPropostaPresencaHistoricaMigracao,
  Papel,
} from "@prisma/client";
import type { HABILIDADES } from "@/server/avaliacoes/calculo";

// Rótulos legíveis (pt-BR) dos enums do domínio. Fonte única para a UI.

/**
 * Rótulo de um valor de enum pelo mapa do domínio (E5, docs/42-auditoria-frontend-ux.md). Valor sem
 * rótulo devolve o PRÓPRIO valor — nunca uma frase de negócio inventada (o antigo `?? "Em
 * conferência"` mostrava um estado que ninguém registrou). Em desenvolvimento, avisa no console.
 * Mapas tipados como Record<Enum, string> já fazem o build falhar quando falta um valor; este
 * helper cobre dados que chegam como texto (snapshots, JSON) e podem trazer um valor antigo.
 */
export function rotular<K extends string>(mapa: Record<K, string>, valor: K | string | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const rotulo = (mapa as Record<string, string>)[valor];
  if (rotulo !== undefined) return rotulo;
  if (process.env.NODE_ENV === "development") console.warn(`rotular: valor sem rótulo "${valor}"`);
  return valor;
}

export const ETAPA_LABEL: Record<EtapaLead, string> = {
  NOVO: "Novo",
  EM_ATENDIMENTO: "1º Contato",
  QUALIFICADO: "Qualificado",
  EXPERIMENTAL_AGENDADA: "Exp. Agendada",
  EXPERIMENTAL_REALIZADA: "Exp. Realizada",
  PROPOSTA: "Proposta",
  AGUARDANDO_MATRICULA: "Aguardando Matrícula",
  MATRICULADO: "Matriculado",
  NO_SHOW: "No-show",
  PERDIDO: "Perdido",
};

// Rótulos legíveis dos papéis (ver docs/07; ALUNO = portal — Fase 3). Vieram de lib/roles.ts, que os reexporta.
export const PAPEL_LABEL: Readonly<Record<Papel, string>> = Object.freeze({
  ADMINISTRADOR: "Administrador",
  GERENTE_COMERCIAL: "Gerente comercial",
  VENDEDOR: "Vendedor",
  GERENTE_PEDAGOGICO: "Gerente pedagógico",
  PROFESSOR: "Professor",
  FINANCEIRO: "Financeiro",
  SECRETARIA_ACADEMICA: "Secretaria acadêmica",
  ALUNO: "Aluno (portal)",
});

/** Etapa do lead por extenso, para mensagens (a gestão recebe no WhatsApp); o kanban usa a forma curta de ETAPA_LABEL. */
export const ETAPA_EXTENSO_LABEL: Readonly<Record<EtapaLead, string>> = Object.freeze({
  NOVO: "Novo",
  EM_ATENDIMENTO: "Em atendimento",
  QUALIFICADO: "Qualificado",
  EXPERIMENTAL_AGENDADA: "Experimental agendada",
  EXPERIMENTAL_REALIZADA: "Experimental realizada",
  PROPOSTA: "Proposta",
  AGUARDANDO_MATRICULA: "Aguardando matrícula",
  MATRICULADO: "Matriculado",
  NO_SHOW: "No-show",
  PERDIDO: "Perdido",
});

export const TEMPERATURA_LABEL: Record<Temperatura, string> = {
  QUENTE: "Quente",
  MORNO: "Morno",
  FRIO: "Frio",
};

export const TEMPERATURA_CLS: Record<Temperatura, string> = {
  QUENTE: "bg-red-100 text-red-700",
  MORNO: "bg-amber-100 text-amber-700",
  FRIO: "bg-blue-100 text-blue-700",
};

export const SEGMENTO_LABEL: Record<Segmento, string> = {
  ADULTO: "Adulto",
  KIDS: "Kids",
  TEENS: "Teens",
  EMPRESA: "Empresa",
};

export const MOTIVO_PERDA_LABEL: Record<MotivoPerda, string> = {
  NAO_RESPONDEU: "Não respondeu",
  PRECO: "Preço",
  TEMPO: "Tempo/Horário",
  CONCORRENCIA: "Concorrência",
  INTERESSE: "Sem interesse",
  LOCALIZACAO: "Localização",
  EMPRESA: "Empresa (B2B)",
  QUALIFICACAO: "Qualificação",
  OUTRO: "Outro",
};

export const STATUS_MATRICULA_LABEL: Record<StatusMatricula, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO: "Aguardando",
  ATIVA: "Ativa",
  PAUSADA: "Pausada",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
};

export const STATUS_COBRANCA_LABEL: Record<StatusCobranca, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  CANCELADA: "Cancelada",
};

export const STATUS_COMISSAO_LABEL: Record<StatusComissao, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  PAGA: "Paga",
  ESTORNADA: "Estornada",
};

export const STATUS_ALUNO_LABEL: Record<StatusAluno, string> = {
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  ENCERRADO: "Encerrado",
};

export const TIPO_COBRANCA_LABEL: Record<TipoCobranca, string> = {
  MATRICULA: "Taxa de matrícula",
  MENSALIDADE: "Mensalidade",
  HORA_PARTICULAR: "Hora particular",
  MATERIAL: "Material",
  CERTIFICADO: "Certificado",
  MULTA_ENCERRAMENTO: "Multa de encerramento",
};

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  TRANSFERENCIA: "Transferência",
  GREENPAY: "GreenPay",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  PIX: "PIX",
  BOLETO: "Boleto",
};

// Gênero (doc 09 §Identificação) — lista curta. NAO_INFORMADO = "Prefiro não informar".
export const GENERO_LABEL: Record<Genero, string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  NAO_INFORMADO: "Prefiro não informar",
};

// Escolaridade (doc 09 §Acadêmico) — lista fechada, ordem crescente.
export const ESCOLARIDADE_LABEL: Record<Escolaridade, string> = {
  FUNDAMENTAL_INCOMPLETO: "Ensino fundamental incompleto",
  FUNDAMENTAL_COMPLETO: "Ensino fundamental completo",
  MEDIO_INCOMPLETO: "Ensino médio incompleto",
  MEDIO_COMPLETO: "Ensino médio completo",
  TECNICO: "Técnico",
  SUPERIOR_INCOMPLETO: "Superior incompleto",
  SUPERIOR_COMPLETO: "Superior completo",
  POS_GRADUACAO: "Pós-graduação",
  MESTRADO: "Mestrado",
  DOUTORADO: "Doutorado",
};

// Relato de indisponibilidade do material de reposição (Q57/Q58) — exibido ao ALUNO no portal.
// ABERTO: aguarda a conferência da escola; CONFIRMADO: a escola confirmou a indisponibilidade
// (server/portal-aluno/entregas-reposicao.ts); DESCARTADO: a gestão não confirmou o relato
// (server/diario/reposicao-operacoes-relatos.ts), sem pausa de prazo.
export const SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL: Record<SituacaoRelatoMaterialReposicao, string> = {
  ABERTO: "Aguardando conferência da escola",
  CONFIRMADO: "Confirmado pela escola",
  DESCARTADO: "Não confirmado pela escola",
};

/**
 * Status do encontro da agenda. Concorda com "encontro" (masculino) em todas as telas — o diário
 * dizia "Prevista/Ministrada/Cancelada" (aula) e o acadêmico "Previsto/…"; decisão do responsável
 * em 25/09/2026: masculino.
 */
export const STATUS_ENCONTRO_LABEL: Readonly<Record<StatusEncontroAgenda, string>> = Object.freeze({
  RASCUNHO: "Rascunho",
  PREVISTO: "Previsto",
  MINISTRADO: "Ministrado",
  CANCELADO: "Cancelado",
  NAO_REALIZADO: "Não realizado",
  IMPEDIDO_ESCOLA: "Impedido pela escola",
});

// ---------------------------------------------------------------------------------------------------
// E5 (docs/42-auditoria-frontend-ux.md §5.7): mapas que viviam soltos nas telas, ou que faltavam e
// deixavam o enum cru na tela ("Estado: PREVISTO", "COMPREENSAO ORAL", "PENDENTE_DECISAO"). Todos
// tipados por Record<Enum, string> — falta de valor quebra o build — e congelados. Texto em sentence
// case; quando a tela já usava um texto, ele foi mantido (src/app/enums-rotulos.test.ts trava).
// ---------------------------------------------------------------------------------------------------

/** Habilidade avaliada (server/avaliacoes/calculo.ts#HABILIDADES) — não é enum do schema, mas é o enum
 * de domínio mais repetido nas telas (13 cópias locais e 20 `replaceAll("_", " ")`). */
export type Habilidade = (typeof HABILIDADES)[number];
export const HABILIDADE_LABEL: Readonly<Record<Habilidade, string>> = Object.freeze({
  FALA: "Fala",
  COMPREENSAO_ORAL: "Compreensão oral",
  LEITURA: "Leitura",
  ESCRITA: "Escrita",
});

export const STATUS_TURMA_LABEL: Readonly<Record<StatusTurma, string>> = Object.freeze({
  PLANEJADA: "Planejada",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
});

export const STATUS_MUDANCA_ACADEMICA_LABEL: Readonly<Record<StatusMudancaAcademica, string>> = Object.freeze({
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  EXECUTADA: "Executada",
  CANCELADA: "Cancelada",
});

export const STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL: Readonly<Record<StatusReservaSegundaChamada, string>> = Object.freeze({
  RESERVADA: "Reservada",
  CONSUMIDA_REALIZACAO: "Realizada",
  CONSUMIDA_FALTA: "Falta",
  LIBERADA_CANCELAMENTO_ESCOLA: "Cancelada pela escola",
  LIBERADA_CANCELAMENTO_TEMPESTIVO: "Cancelada dentro do prazo",
  CONSUMIDA_CANCELAMENTO_TARDIO: "Cancelada fora do prazo",
  PENDENCIA_ESCOLA: "Pendência da escola",
});

/** Situação da nota original da segunda chamada (server/avaliacoes/segunda-chamada-docente.ts) — os
 * mesmos textos da nota de recuperação (server/avaliacoes/recuperacao-consulta.ts). */
export type SituacaoNotaSegundaChamada = "OFICIALIZADA" | "REJEITADA" | "SUBMETIDA" | "RASCUNHO";
export const SITUACAO_NOTA_SEGUNDA_CHAMADA_LABEL: Readonly<Record<SituacaoNotaSegundaChamada, string>> = Object.freeze({
  OFICIALIZADA: "Oficializada",
  REJEITADA: "Rejeitada",
  SUBMETIDA: "Aguardando conferência",
  RASCUNHO: "Rascunho",
});

export const SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL: Readonly<Record<SituacaoPropostaQuantidadeAulas, string>> = Object.freeze({
  PREPARADA: "Aguardando decisão",
  REJEITADA: "Rejeitada",
  APROVADA: "Aprovada",
  APLICADA: "Aplicada",
});

/** Alcance da nova quantidade de aulas sobre cada turma (server/agenda/modalidade-quantidade-preview.ts). */
export const ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL: Readonly<Record<AlcanceImpactoQuantidadeAulas, string>> = Object.freeze({
  FINALIZADA_PRESERVADA: "Turma concluída: meta preservada",
  REDUCAO_INICIADA_PRESERVADA: "Redução não alcança turma iniciada",
  REDUCAO_NAO_INICIADA: "Redução em turma não iniciada",
  REDUCAO_RASCUNHO: "Redução em turma em rascunho",
  AUMENTO_INICIADA: "Aumento em turma iniciada",
  AUMENTO_NAO_INICIADA: "Aumento em turma não iniciada",
  AUMENTO_RASCUNHO: "Aumento em turma em rascunho",
});

export const PARTICIPACAO_AULA_LABEL: Readonly<Record<ParticipacaoAula, string>> = Object.freeze({
  PRESENTE: "Presente",
  FALTA: "Falta",
  IMPEDIDO_POR_RESTRICAO: "Impedido por restrição",
});

// Portal do aluno e avisos (Secretaria).
export const FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL: Readonly<Record<FinalidadeTokenPortalAluno, string>> = Object.freeze({
  CONVITE: "Convite de acesso",
  RECUPERACAO: "Recuperação de senha",
  VALIDAR_TROCA_EMAIL: "Validação de troca de e-mail",
});

export const SITUACAO_ENVIO_PORTAL_ALUNO_LABEL: Readonly<Record<SituacaoEnvioPortalAluno, string>> = Object.freeze({
  PREPARADO: "Preparado",
  ENVIADO: "Aceito pelo provedor",
  INCERTO: "Resultado incerto",
  CANCELADO: "Cancelado",
  FALHOU: "Falhou",
});

export const SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL: Readonly<Record<SituacaoTrocaEmailPortalAluno, string>> = Object.freeze({
  PENDENTE_VALIDACAO: "Aguardando validação do novo endereço",
  PENDENTE_DECISAO: "Aguardando decisão",
  APROVADA_APLICADA: "Aprovada e aplicada",
  REJEITADA: "Rejeitada",
  CANCELADA: "Cancelada",
});

export const CANAL_AVISO_ALTERACAO_AGENDA_LABEL: Readonly<Record<CanalAvisoAlteracaoAgenda, string>> = Object.freeze({
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
});

export const SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL: Readonly<Record<SituacaoAvisoAlteracaoAgenda, string>> = Object.freeze({
  PREPARADO: "Preparado",
  ENVIADO: "Aceito pelo provedor",
  INCERTO: "Resultado incerto",
  FALHOU: "Falhou",
});

export const MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL: Readonly<Record<MotivoPendenciaAvisoAgenda, string>> = Object.freeze({
  SEM_DESTINATARIO_AUTORIZADO: "Sem destinatário acadêmico autorizado",
  CONFIGURACAO_INDISPONIVEL: "Configuração institucional indisponível",
  CONTATO_SEM_OPT_IN: "Contato sem aceite de comunicações",
  CONTATO_INDISPONIVEL: "Contato acadêmico indisponível",
});

// Matrícula e Secretaria.
/** Reserva de vaga (turma) ou de horários (particular). As telas tinham quatro redações ("Reserva
 * ativa", "Vaga liberada", "Horários liberados"…); vale a curta, que serve aos dois casos. */
export const STATUS_RESERVA_VAGA_LABEL: Readonly<Record<StatusReservaVaga, string>> = Object.freeze({
  ATIVA: "Ativa",
  MANTIDA_PENDENCIA: "Mantida por pendência",
  EXPIRADA: "Expirada",
  UTILIZADA: "Utilizada",
  LIBERADA: "Liberada",
});

export const STATUS_CORRECAO_CADASTRO_LABEL: Readonly<Record<StatusCorrecaoCadastro, string>> = Object.freeze({
  PENDENTE: "Pendente",
  CONCLUIDA: "Concluída",
  REJEITADA: "Rejeitada",
});

/** Tipo do pagador da contratação (server/matricula/schema.ts — z.enum, não é enum do schema). */
export type TipoPagador = "ALUNO" | "RESPONSAVEL" | "EMPRESA";
export const TIPO_PAGADOR_LABEL: Readonly<Record<TipoPagador, string>> = Object.freeze({
  ALUNO: "Próprio aluno",
  RESPONSAVEL: "Responsável",
  EMPRESA: "Empresa",
});

export const STATUS_SOLICITACAO_ENCERRAMENTO_LABEL: Readonly<Record<StatusSolicitacaoEncerramento, string>> = Object.freeze({
  ABERTA: "Aguardando acerto",
  EM_ACERTO: "Acerto em preparação",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
});

export const ESTADO_DIA_COMPENSACAO_LABEL: Readonly<Record<EstadoDiaCompensacao, string>> = Object.freeze({
  PENDENTE: "Cumprimento pendente",
  RECOMPOSTO: "Cobertura cumprida",
  LIQUIDADO_FINANCEIRAMENTE: "Direito acertado financeiramente",
});

export const ESTADO_ENVIO_ASSINATURA_LABEL: Readonly<Record<EstadoEnvioAssinatura, string>> = Object.freeze({
  PREPARADO: "Preparado para envio",
  ENVIANDO: "Envio em andamento",
  ENVIO_INCERTO: "Resultado do envio incerto",
  ENVIADO: "Enviado",
  CANCELADO: "Cancelamento registrado",
});

export const TIPO_MOVIMENTACAO_LABEL: Readonly<Record<TipoMovimentacao, string>> = Object.freeze({
  MATRICULA: "Matrícula",
  TROCA_TURMA: "Troca de turma",
  PAUSA: "Pausa",
  REATIVACAO: "Reativação",
  ENCERRAMENTO: "Encerramento",
});

export const RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL: Readonly<Record<ResultadoEnsaioVinculoMigracao, string>> = Object.freeze({
  REQUISITO_AUSENTE: "Requisitos pendentes",
  PRONTO_PARA_REVISAO: "Pronto para revisão",
  DIVERGENTE: "Divergência encontrada",
});

export const ESTADO_LINHA_PREPARACAO_MIGRACAO_LABEL: Readonly<Record<EstadoLinhaPreparacaoMigracao, string>> = Object.freeze({
  PRONTA_PARA_REVISAO: "Pronta para revisão",
  COM_PENDENCIAS: "Com pendências",
  COLISAO_ORIGEM: "Colisão na origem",
});

export const SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL: Readonly<Record<SituacaoAplicacaoCadastroMigracao, string>> = Object.freeze({
  ENSAIO_VALIDO: "Ensaio válido",
  APLICADO: "Aplicado",
  BLOQUEADO: "Bloqueado",
  DIVERGENCIA_DESTINO: "Divergência no destino",
});

// Comercial e atendimento.
/** Finalidade de um número de WhatsApp da escola. */
export const FINALIDADE_NUMERO_LABEL: Readonly<Record<FinalidadeNumero, string>> = Object.freeze({
  COBRANCA: "Cobrança",
  VENDAS: "Vendas",
  AGENDA: "Agenda",
});

export const CATEGORIA_DOCUMENTO_LABEL: Readonly<Record<CategoriaDocumento, string>> = Object.freeze({
  PROPOSTA: "Proposta",
  CONTRATO: "Contrato",
  COMPROVANTE: "Comprovante",
  TESTE_NIVEL: "Teste de nível",
  OUTRO: "Outro",
});

export const STATUS_FATURA_B2B_LABEL: Readonly<Record<StatusFaturaB2B, string>> = Object.freeze({
  ABERTA: "Aberta",
  FECHADA: "Fechada — a pagar",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
});

export const TIPO_SUGESTAO_IA_LABEL: Readonly<Record<TipoSugestaoIA, string>> = Object.freeze({
  RESUMO: "Resumo executivo",
  TEMPERATURA: "Temperatura",
  SEGMENTO: "Segmento",
  ETAPA: "Etapa do funil",
});

export const STATUS_TEMPLATE_LABEL: Readonly<Record<StatusTemplate, string>> = Object.freeze({
  RASCUNHO: "Rascunho",
  EM_REVISAO: "Em revisão",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
});

export const TIPO_MENSAGEM_LABEL: Readonly<Record<TipoMensagem, string>> = Object.freeze({
  TEXTO: "Texto",
  IMAGEM: "Imagem",
  AUDIO: "Áudio",
  VIDEO: "Vídeo",
  DOCUMENTO: "Documento",
  OUTRO: "Outro",
});

/** Envio pela API do WhatsApp (intenção da régua). Era "na fila de envio"… em minúscula na fila de
 * cobrança e o código cru ("Estado: ADIADA.") na inbox. */
export const STATUS_INTENCAO_LABEL: Readonly<Record<StatusIntencao, string>> = Object.freeze({
  PENDENTE: "Na fila de envio",
  ENVIANDO: "Enviando",
  DESPACHADA: "Enviada via API",
  CANCELADA: "Cancelada",
  FALHOU: "Falhou",
  ADIADA: "Na fila (aguardando janela)",
  SIMULADA: "Simulada (ensaio)",
});

// Financeiro.
export const TIPO_APROVACAO_LABEL: Readonly<Record<TipoAprovacao, string>> = Object.freeze({
  DESCONTO: "Desconto",
  BOLSA: "Bolsa",
  ALTERACAO_VALOR: "Alteração de valor",
  PERDAO_DIVIDA: "Perdão de dívida",
  COMISSAO_EXCEPCIONAL: "Comissão excepcional",
});

export const VIGENCIA_LABEL: Readonly<Record<Vigencia, string>> = Object.freeze({
  ESTA_COBRANCA: "Esta cobrança",
  PROXIMOS_MESES: "Próximos meses",
  CONTRATO_INTEIRO: "Contrato inteiro",
});

export const TIPO_AJUSTE_LABEL: Readonly<Record<TipoAjuste, string>> = Object.freeze({
  DESCONTO: "Desconto",
  BOLSA: "Bolsa",
  ALTERACAO_VALOR: "Alteração de valor",
  PERDAO: "Perdão de dívida",
  RENEGOCIACAO: "Renegociação",
});

export const TIPO_DESTINACAO_RECEBIMENTO_LABEL: Readonly<Record<TipoDestinacaoRecebimento, string>> = Object.freeze({
  COBRANCA: "Cobrança",
  CREDITO_SEM_DESTINO: "Crédito sem destino",
});

/** Referência da cobertura de uma mensalidade (o que conta como "um mês"). */
export const REFERENCIA_COBERTURA_MENSAL_LABEL: Readonly<Record<ReferenciaCoberturaMensal, string>> = Object.freeze({
  MES_CIVIL: "Mês civil",
  CICLO_MATRICULA: "Ciclo mensal da matrícula",
});

/** Forma de agenda da oferta registrada na preparação da matrícula. */
export const FORMA_AGENDA_OFERTA_LABEL: Readonly<Record<FormaAgendaOferta, string>> = Object.freeze({
  TURMA: "Turma",
  PARTICULAR_GRADE_FIXA: "Particular com grade fixa",
  PARTICULAR_FLEXIVEL: "Particular com agenda flexível",
});

/** Parcela da cobrança de entrada da matrícula (prévia das condições, emissão e entrada particular). */
export type TipoCobrancaEntrada = Extract<TipoCobranca, "MATRICULA" | "MENSALIDADE" | "HORA_PARTICULAR">;
export const TIPO_COBRANCA_ENTRADA_LABEL: Readonly<Record<TipoCobrancaEntrada, string>> = Object.freeze({
  MATRICULA: "Taxa de matrícula",
  MENSALIDADE: "Primeira mensalidade",
  HORA_PARTICULAR: "Adiantamento por hora",
});

export const STATUS_PAGAMENTO_INFORMADO_LABEL: Readonly<Record<StatusPagamentoInformado, string>> = Object.freeze({
  A_CONFERIR: "A conferir",
  CONFIRMADO: "Confirmado",
  REJEITADO: "Rejeitado",
});

/** Ambiente do serviço de assinatura do processo (o de teste não comprova assinatura em produção). */
export type AmbienteAssinatura = "SANDBOX" | "PRODUCAO";
export const AMBIENTE_ASSINATURA_LABEL: Readonly<Record<AmbienteAssinatura, string>> = Object.freeze({
  SANDBOX: "Teste",
  PRODUCAO: "Produção",
});

/** Ocorrência de aula particular informada pelo professor (server/matricula/ocorrencia-horas.ts). */
export type TipoOcorrenciaHoras = "REALIZADA" | "FALTA_ALUNO" | "CANCELAMENTO_ALUNO" | "CANCELAMENTO_ESCOLA";
export const TIPO_OCORRENCIA_HORAS_LABEL: Readonly<Record<TipoOcorrenciaHoras, string>> = Object.freeze({
  REALIZADA: "Aula realizada",
  FALTA_ALUNO: "Falta do aluno",
  CANCELAMENTO_ALUNO: "Cancelamento do aluno",
  CANCELAMENTO_ESCOLA: "Cancelamento da escola",
});

/** Desfecho financeiro da conferência dessa ocorrência (classificarOcorrenciaHoras). */
export type DesfechoOcorrenciaHoras = "REALIZADA" | "FALTA_COBRAVEL" | "CANCELAMENTO_ESCOLA" | "CANCELAMENTO_NO_PRAZO" | "CANCELAMENTO_TARDIO";
export const DESFECHO_OCORRENCIA_HORAS_LABEL: Readonly<Record<DesfechoOcorrenciaHoras, string>> = Object.freeze({
  REALIZADA: "Aula realizada",
  FALTA_COBRAVEL: "Falta cobrável",
  CANCELAMENTO_ESCOLA: "Cancelamento da escola",
  CANCELAMENTO_NO_PRAZO: "Cancelamento do aluno dentro do prazo",
  CANCELAMENTO_TARDIO: "Cancelamento do aluno fora do prazo",
});

/** Situação de uma proposta que outra pessoa decide e depois se aplica — a mesma redação para os
 * fluxos que compartilham PENDENTE/APROVADA/REJEITADA/APLICADA. */
const PROPOSTA_DECIDIDA = { PENDENTE: "Aguardando decisão", APROVADA: "Aprovada", REJEITADA: "Rejeitada", APLICADA: "Aplicada" } as const;
/** A mesma situação quando o servidor a calcula sem enum próprio (ex.: acerto de vencimento do aditivo). */
export type EstadoPropostaDecidida = keyof typeof PROPOSTA_DECIDIDA;
export const ESTADO_PROPOSTA_DECIDIDA_LABEL: Readonly<Record<EstadoPropostaDecidida, string>> = Object.freeze({ ...PROPOSTA_DECIDIDA });

export const STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL: Readonly<Record<StatusPropostaAcertoTaxaAditivo, string>> = Object.freeze({
  ...PROPOSTA_DECIDIDA,
  OBSOLETA: "Substituída",
});

export const STATUS_PROPOSTA_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL: Readonly<Record<StatusPropostaConciliacaoFinanceiraMigracao, string>> = Object.freeze({ ...PROPOSTA_DECIDIDA });

export const STATUS_PROPOSTA_ENTRADA_FINANCEIRA_HISTORICA_MIGRACAO_LABEL: Readonly<Record<StatusPropostaEntradaFinanceiraHistoricaMigracao, string>> = Object.freeze({ ...PROPOSTA_DECIDIDA });

export const STATUS_PROPOSTA_PRESENCA_HISTORICA_MIGRACAO_LABEL: Readonly<Record<StatusPropostaPresencaHistoricaMigracao, string>> = Object.freeze({
  ...PROPOSTA_DECIDIDA,
  PENDENCIA_CORRECAO: "Pendência de correção",
});

/** Conjunto de impactos do aditivo (taxa e cobertura têm enums distintos com os mesmos valores). */
const CONJUNTO_IMPACTOS = { PENDENTE: "Aguardando decisão", APROVADO: "Aprovado", REJEITADO: "Rejeitado", COMPLETO: "Aplicado", OBSOLETO: "Substituído" } as const;
export const STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL: Readonly<Record<StatusConjuntoImpactosTaxaAditivo, string>> = Object.freeze({ ...CONJUNTO_IMPACTOS });
export const STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL: Readonly<Record<StatusConjuntoImpactosCoberturaAditivo, string>> = Object.freeze({ ...CONJUNTO_IMPACTOS });

export const DECISAO_IMPACTO_TAXA_ADITIVO_LABEL: Readonly<Record<DecisaoImpactoTaxaAditivo, string>> = Object.freeze({
  AFETADA: "Afetada",
  PRESERVADA: "Preservada",
});
export const CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL: Readonly<Record<ClassificacaoImpactoCoberturaAditivo, string>> = Object.freeze({
  AFETADA: "Afetada",
  PRESERVADA: "Preservada",
});

/** Tratamento da linha financeira migrada — os textos das opções do formulário de conciliação. */
export const MODALIDADE_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL: Readonly<Record<ModalidadeConciliacaoFinanceiraMigracao, string>> = Object.freeze({
  PENDENCIA: "Registrar pendência",
  VINCULAR_RECEBIMENTO: "Vincular recebimento ERP existente",
  BAIXAR: "Baixar recebimento histórico",
});

export const ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL: Readonly<Record<EstadoReservaDevolucaoCredito, string>> = Object.freeze({
  AGUARDANDO_EXECUCAO: "Aguardando execução",
  INCERTO: "Resultado incerto",
  CONFIRMADA: "Confirmada",
  LIBERADA: "Liberada",
});

export const ESTADO_RECONFERENCIA_DELTA_DESISTENCIA_LABEL: Readonly<Record<EstadoReconferenciaDeltaDesistencia, string>> = Object.freeze({
  PENDENTE: "Aguardando decisão",
  PENDENCIA_FINANCEIRA: "Pendência financeira",
  APLICADA: "Aplicada",
});

/** Unidade da permuta, no singular (a tela imprime "quantidade · unidade"). */
export const UNIDADE_PERMUTA_SERVICO_LABEL: Readonly<Record<UnidadePermutaServico, string>> = Object.freeze({
  HORA: "Hora",
  AULA: "Aula",
  UNIDADE: "Unidade",
});
