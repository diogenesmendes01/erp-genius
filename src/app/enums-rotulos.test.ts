import { MOTIVOS_HANDOFF } from "@/server/aria/turno/tipos";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EstadoGeracaoInsightInbox, AlcanceImpactoQuantidadeAulas, CanalAvisoAlteracaoAgenda, CategoriaDocumento,
  ClassificacaoImpactoCoberturaAditivo, DecisaoImpactoTaxaAditivo, EstadoDiaCompensacao, EstadoEnvioAssinatura,
  EstadoLinhaPreparacaoMigracao, EstadoReconferenciaDeltaDesistencia, EstadoReservaDevolucaoCredito, FinalidadeTokenPortalAluno,
  ModalidadeConciliacaoFinanceiraMigracao, MotivoPendenciaAvisoAgenda, ParticipacaoAula, ResultadoEnsaioVinculoMigracao,
  SituacaoAplicacaoCadastroMigracao, SituacaoAvisoAlteracaoAgenda, SituacaoEnvioPortalAluno, SituacaoPropostaQuantidadeAulas,
  SituacaoTrocaEmailPortalAluno, StatusConjuntoImpactosCoberturaAditivo, StatusConjuntoImpactosTaxaAditivo, StatusCorrecaoCadastro,
  StatusFaturaB2B, StatusIntencao, StatusMudancaAcademica, StatusPropostaAcertoTaxaAditivo, StatusPropostaConciliacaoFinanceiraMigracao,
  StatusPropostaEntradaFinanceiraHistoricaMigracao, StatusPropostaPresencaHistoricaMigracao, StatusReservaSegundaChamada,
  StatusReservaVaga, StatusSolicitacaoEncerramento, StatusTemplate, StatusTurma, TipoAjuste, TipoAprovacao, TipoDestinacaoRecebimento,
  TipoMensagem, TipoMovimentacao, AcaoAgenteIATipo, StatusAcaoAgenteIA, MotivoPausaAtendimentoIA, EstadoPolitica, StatusFonteConhecimento,
  StatusVersaoAgenteIA, MetricaMeta, OrigemChamadaIA, AcaoOrcamentoIA, UnidadePermutaServico, Vigencia, StatusEncontroAgenda,
  StatusPagamentoInformado, ReferenciaCoberturaMensal, FinalidadeNumero, FinalidadeAtendimentoWhatsApp, StatusAtendimentoWhatsApp,
  FormaAgendaOferta, EtapaLead, Papel, OrigemEnvio, OrigemCanal, PapelParticipante, DriverWhatsApp, CorTag, TipoCampoPersonalizado,
  AlvoCampoPersonalizado, TelaFiltroSalvo, TipoTarefa, StatusTarefa, PrioridadeTarefa, OrigemTarefa, TipoNotificacao, RecorrenciaTarefa,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as L from "@/lib/labels";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { PagadorEntradaFinanceiraHistoricaSchema } from "@/server/migracao/entrada-financeira-historica-schema";
import { OcorrenciaHorasSchema } from "@/server/matricula/ocorrencia-horas";
import { SaldoCompraHorasSchema } from "@/server/matricula/saldo-horas";

const mocks = vi.hoisted(() => ({
  avisos: vi.fn(), envios: vi.fn(), preferencia: vi.fn(), cancelamento: vi.fn(), quantidade: vi.fn(), segundas: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn(async () => ({ id: "u" })) }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/comunicacoes-agenda/consultas", () => ({ consultarAvisosAlteracaoAgenda: mocks.avisos }));
vi.mock("@/app/(app)/secretaria/avisos-agenda/ReconferirPendencia", () => ({ ReconferirPendencia: () => null }));
vi.mock("@/server/portal-aluno/fila-envios", () => ({ consultarFilaEnviosPortalAluno: mocks.envios }));
vi.mock("@/app/(app)/secretaria/envios-portal/ConciliacaoEnvio", () => ({ ConciliacaoEnvio: () => null }));
vi.mock("@/server/avaliacoes/recuperacao-agenda-cancelamento", () => ({ consultarCancelamentoAgendaRecuperacao: mocks.cancelamento }));
vi.mock("@/app/(app)/academico/avaliacoes/Identificacao", () => ({ IdentificacaoAvaliacao: () => null }));
vi.mock("@/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/Formularios", () => ({ Propor: () => null, Decidir: () => null }));
vi.mock("@/server/agenda/modalidade-quantidade-consulta", () => ({ consultarPropostaQuantidadeAulasModalidade: mocks.quantidade }));
vi.mock("@/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/DecidirQuantidadeAulas", () => ({ DecidirQuantidadeAulas: () => null }));
vi.mock("@/server/avaliacoes/segunda-chamada-docente", () => ({ listarSegundasChamadasDocente: mocks.segundas }));

import AvisosAgendaPage from "@/app/(app)/secretaria/avisos-agenda/page";
import EnviosPortalPage from "@/app/(app)/secretaria/envios-portal/page";
import CancelamentoRecuperacaoPage from "@/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/page";
import PropostaQuantidadePage from "@/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/page";
import MinhasSegundasChamadasPage from "@/app/(app)/academico/segundas-chamadas/minhas/page";

const instante = new Date("2026-10-01T03:30:00.000Z");
type Campos = Record<string, string>;
type Tela = { renderizar: (c: Campos) => Promise<string>; enums: { campo: string; valores: readonly string[]; mapa: Readonly<Record<string, string>>; fixo: string }[] };

const TELAS: Record<string, Tela> = {
  "/secretaria/avisos-agenda": {
    renderizar: async (c) => {
      mocks.avisos.mockResolvedValue({ ok: true, dado: {
        itens: [{ id: "a", alunoNome: "Ana", canal: c.canal, situacao: c.situacao, atualizadoEm: instante }],
        pendencias: [{ id: "p", matriculaId: "m", matriculaCodigo: "M-1", alunoNome: "Ana", motivo: c.motivo, situacao: "PENDENTE", criadoEm: instante }],
        temAnterior: false, temProxima: false, anterior: null, proxima: null,
        temAnteriorPendencia: false, temProximaPendencia: false, anteriorPendencia: null, proximaPendencia: null,
      } });
      return renderToStaticMarkup(await AvisosAgendaPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "canal", valores: Object.values(CanalAvisoAlteracaoAgenda), mapa: L.CANAL_AVISO_ALTERACAO_AGENDA_LABEL, fixo: "EMAIL" },
      { campo: "situacao", valores: Object.values(SituacaoAvisoAlteracaoAgenda), mapa: L.SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, fixo: "PREPARADO" },
      { campo: "motivo", valores: Object.values(MotivoPendenciaAvisoAgenda), mapa: L.MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, fixo: "CONTATO_INDISPONIVEL" },
    ],
  },
  "/secretaria/envios-portal": {
    renderizar: async (c) => {
      mocks.envios.mockResolvedValue({ ok: true, dado: { temAnterior: false, temProxima: false, anterior: null, proxima: null, itens: [
        { id: "e", alunoNome: "Ana", finalidade: c.finalidade, situacao: c.situacao, criadoEm: instante, atualizadoEm: instante, conciliacao: null },
      ] } });
      return renderToStaticMarkup(await EnviosPortalPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "finalidade", valores: Object.values(FinalidadeTokenPortalAluno), mapa: L.FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, fixo: "CONVITE" },
      { campo: "situacao", valores: Object.values(SituacaoEnvioPortalAluno), mapa: L.SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, fixo: "PREPARADO" },
    ],
  },
  "cancelamento da recuperação pela escola": {
    renderizar: async (c) => {
      mocks.cancelamento.mockResolvedValue({ ok: true, dado: {
        identificacao: {}, estadoConferido: "a".repeat(64), podePropor: false, proximoAntesId: null, propostas: [],
        atual: { reservaId: "r", matriculaId: "m", cancelamentoId: null, itens: [{ id: "i", habilidade: c.habilidade, realizacaoId: null, inicio: "2026-01-01T02:30:00Z", fim: "2026-01-01T03:30:00Z", status: c.status, fusoOrigem: "UTC" }] },
      } });
      return renderToStaticMarkup(await CancelamentoRecuperacaoPage({ params: Promise.resolve({ reservaId: "r" }), searchParams: Promise.resolve({}) }));
    },
    enums: [
      { campo: "habilidade", valores: HABILIDADES, mapa: L.HABILIDADE_LABEL, fixo: "LEITURA" },
      { campo: "status", valores: Object.values(StatusEncontroAgenda), mapa: L.STATUS_ENCONTRO_LABEL, fixo: "PREVISTO" },
    ],
  },
  "revisão da quantidade de aulas": {
    renderizar: async (c) => {
      mocks.quantidade.mockResolvedValue({ ok: true, dado: {
        id: "p", modalidadeId: "m", modalidade: { nome: "Inglês" }, versao: 2, quantidadeAnterior: 2, quantidadeNova: 3, situacao: c.situacao,
        motivo: "Revisão", preparador: { nome: "Secretaria" }, decisao: null, aplicadaEm: null,
        impactos: [{ id: "i", turmaId: "t", turma: { codigo: "T-01" }, quantidadeAnterior: 2, quantidadeNova: 3, alcance: c.alcance, excecoesQ37: [], snapshot: {} }],
      } });
      return renderToStaticMarkup(await PropostaQuantidadePage({ params: Promise.resolve({ id: "m", propostaId: "p" }) }));
    },
    enums: [
      { campo: "situacao", valores: Object.values(SituacaoPropostaQuantidadeAulas), mapa: L.SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL, fixo: "APLICADA" },
      { campo: "alcance", valores: Object.values(AlcanceImpactoQuantidadeAulas), mapa: L.ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL, fixo: "AUMENTO_NAO_INICIADA" },
    ],
  },
  "/academico/segundas-chamadas/minhas": {
    renderizar: async (c) => {
      mocks.segundas.mockResolvedValue({ ok: true, dado: { pagina: 1, temProxima: false, itens: [{
        reservaId: "r", codigoAvaliacao: "AV", inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", fusoOrigem: "UTC",
        status: c.status, aluno: "Ana", matriculaCodigo: "M", turma: "T", realizacao: null, podeRealizar: false,
      }] } });
      return renderToStaticMarkup(await MinhasSegundasChamadasPage({ searchParams: Promise.resolve({}) }));
    },
    enums: [{ campo: "status", valores: Object.values(StatusReservaSegundaChamada), mapa: L.STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, fixo: "RESERVADA" }],
  },
};

const texto = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&");
const ocorrencias = (t: string, trecho: string) => t.split(trecho).length - 1;
const codigoCru = (t: string, valor: string) => new RegExp(`(^|[^A-Za-z0-9_])${valor}([^A-Za-z0-9_]|$)`).test(t);

describe("(i) enum cru na tela — renderização com cada valor", () => {
  beforeEach(() => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
  });

  for (const [tela, { renderizar, enums }] of Object.entries(TELAS)) {
    for (const { campo, valores, mapa } of enums) {
      it(`${tela} · ${campo}: cada valor aparece pelo rótulo do mapa central, nunca pelo código`, async () => {
        const fixos = Object.fromEntries(enums.map((e) => [e.campo, e.fixo]));
        const base = texto(await renderizar({ ...fixos, [campo]: "VALOR_DESCONHECIDO" }));
        for (const valor of valores) {
          const t = texto(await renderizar({ ...fixos, [campo]: valor }));
          expect(codigoCru(t, valor), `${tela} · ${campo}=${valor} imprimiu o código`).toBe(false);
          expect(ocorrencias(t, mapa[valor]) - ocorrencias(base, mapa[valor]), `${tela} · ${campo}=${valor} → "${mapa[valor]}"`).toBeGreaterThanOrEqual(1);
        }
      });
    }
  }
});

const SIGLAS = new Set(["PIX", "B2B", "CPF", "CNPJ", "PDF", "IA", "UTC", "ID", "API", "ERP"]);
const NOMES_PROPRIOS = new Set(["WhatsApp", "Meta", "Q10"]);
export const palavrasEmCaixaAlta = (rotulo: string) => rotulo.split(/[^A-Za-zÀ-ÿ0-9]+/).filter((p) => /^[A-ZÀ-Þ]{2,}$/.test(p) && !SIGLAS.has(p));
export const foraDeSentenceCase = (rotulo: string) => rotulo.split(/[^A-Za-zÀ-ÿ0-9]+/).filter(Boolean).filter((p, i) => !SIGLAS.has(p) && !NOMES_PROPRIOS.has(p)
  && ((i > 0 && /^[A-ZÀ-Þ]/.test(p)) || /[a-zà-ÿ][A-ZÀ-Þ]/.test(p) || /^[A-ZÀ-Þ]{2,}[a-zà-ÿ]/.test(p)));
const PONTUACAO_FINAL = /\p{P}$/u;
const parentesesFechados = (r: string) => {
  let abertos = 0;
  for (const ch of r) { if (ch === "(" || ch === "[") abertos++; if (ch === ")" || ch === "]") abertos--; if (abertos < 0) return false; }
  return abertos === 0;
};
const BORDA_EM_BRANCO = /^[\s\p{Z}]|[\s\p{Z}]$/u;
const INVISIVEL = /\p{C}/u;

export function problemasDeFormato(rotulo: unknown, codigo?: string): string[] {
  if (typeof rotulo !== "string") return ["não é texto"];
  if (!rotulo.trim()) return ["vazio"];
  const p: string[] = [];
  if (rotulo === codigo) p.push("repete o código");
  if (!/[a-zà-ÿ]/.test(rotulo)) p.push("sem minúscula");
  if (palavrasEmCaixaAlta(rotulo).length) p.push("palavra em CAIXA ALTA");
  if (PONTUACAO_FINAL.test(rotulo) && !(/[)\]]$/.test(rotulo) && parentesesFechados(rotulo))) p.push("pontuação final");
  if (BORDA_EM_BRANCO.test(rotulo)) p.push("espaço nas pontas");
  if (INVISIVEL.test(rotulo)) p.push("caractere invisível");
  if (foraDeSentenceCase(rotulo).length) p.push("fora de sentence case");
  if (rotulo.includes("_")) p.push('com "_"');
  if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(rotulo)) p.push("sem maiúscula inicial");
  return p;
}
export function problemasDoMapa(mapa: unknown, valores: readonly string[]): string[] {
  if (!mapa || typeof mapa !== "object") return ["não é mapa"];
  const p: string[] = [];
  const chaves = Object.keys(mapa).sort(), esperadas = [...valores].sort();
  if (chaves.join("|") !== esperadas.join("|")) p.push(`chaves [${chaves.join(", ")}] ≠ valores [${esperadas.join(", ")}]`);
  for (const [valor, rotulo] of Object.entries(mapa)) for (const f of problemasDeFormato(rotulo, valor)) p.push(`${valor}: ${f}`);
  if (!Object.isFrozen(mapa)) p.push("não congelado");
  return p;
}

const MAPAS_NOVOS: [nome: string, mapa: Readonly<Record<string, string>>, valores: readonly string[]][] = [
  ["ESTADO_GERACAO_INSIGHT_LABEL",L.ESTADO_GERACAO_INSIGHT_LABEL,Object.values(EstadoGeracaoInsightInbox)],
  ["SENTIMENTO_INSIGHT_LABEL", L.SENTIMENTO_INSIGHT_LABEL, ["POSITIVO", "NEUTRO", "NEGATIVO"]],
  ["ALTERACAO_ARIA_LABEL", L.ALTERACAO_ARIA_LABEL, Object.values(AcaoAgenteIATipo)],
  ["SITUACAO_CLIENTE_VOLTOU_LABEL", L.SITUACAO_CLIENTE_VOLTOU_LABEL, ["ganha", "perdida"]],
  ["SITUACAO_OUTRA_OPORTUNIDADE_LABEL", L.SITUACAO_OUTRA_OPORTUNIDADE_LABEL, Object.values(EtapaLead)],
  ["ORIGEM_ENVIO_LABEL", L.ORIGEM_ENVIO_LABEL, Object.values(OrigemEnvio)],
  ["HABILIDADE_LABEL", L.HABILIDADE_LABEL, HABILIDADES],
  ["STATUS_TURMA_LABEL", L.STATUS_TURMA_LABEL, Object.values(StatusTurma)],
  ["STATUS_MUDANCA_ACADEMICA_LABEL", L.STATUS_MUDANCA_ACADEMICA_LABEL, Object.values(StatusMudancaAcademica)],
  ["STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL", L.STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL, Object.values(StatusReservaSegundaChamada)],
  ["SITUACAO_NOTA_SEGUNDA_CHAMADA_LABEL", L.SITUACAO_NOTA_SEGUNDA_CHAMADA_LABEL, ["OFICIALIZADA", "REJEITADA", "SUBMETIDA", "RASCUNHO"]],
  ["SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL", L.SITUACAO_PROPOSTA_QUANTIDADE_AULAS_LABEL, Object.values(SituacaoPropostaQuantidadeAulas)],
  ["ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL", L.ALCANCE_IMPACTO_QUANTIDADE_AULAS_LABEL, Object.values(AlcanceImpactoQuantidadeAulas)],
  ["PARTICIPACAO_AULA_LABEL", L.PARTICIPACAO_AULA_LABEL, Object.values(ParticipacaoAula)],
  ["FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL", L.FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL, Object.values(FinalidadeTokenPortalAluno)],
  ["SITUACAO_ENVIO_PORTAL_ALUNO_LABEL", L.SITUACAO_ENVIO_PORTAL_ALUNO_LABEL, Object.values(SituacaoEnvioPortalAluno)],
  ["SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL", L.SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL, Object.values(SituacaoTrocaEmailPortalAluno)],
  ["CANAL_AVISO_ALTERACAO_AGENDA_LABEL", L.CANAL_AVISO_ALTERACAO_AGENDA_LABEL, Object.values(CanalAvisoAlteracaoAgenda)],
  ["SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL", L.SITUACAO_AVISO_ALTERACAO_AGENDA_LABEL, Object.values(SituacaoAvisoAlteracaoAgenda)],
  ["MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL", L.MOTIVO_PENDENCIA_AVISO_AGENDA_LABEL, Object.values(MotivoPendenciaAvisoAgenda)],
  ["STATUS_RESERVA_VAGA_LABEL", L.STATUS_RESERVA_VAGA_LABEL, Object.values(StatusReservaVaga)],
  ["STATUS_CORRECAO_CADASTRO_LABEL", L.STATUS_CORRECAO_CADASTRO_LABEL, Object.values(StatusCorrecaoCadastro)],
  ["TIPO_PAGADOR_LABEL", L.TIPO_PAGADOR_LABEL, PagadorEntradaFinanceiraHistoricaSchema.shape.tipo.options],
  ["STATUS_SOLICITACAO_ENCERRAMENTO_LABEL", L.STATUS_SOLICITACAO_ENCERRAMENTO_LABEL, Object.values(StatusSolicitacaoEncerramento)],
  ["ESTADO_DIA_COMPENSACAO_LABEL", L.ESTADO_DIA_COMPENSACAO_LABEL, Object.values(EstadoDiaCompensacao)],
  ["ESTADO_ENVIO_ASSINATURA_LABEL", L.ESTADO_ENVIO_ASSINATURA_LABEL, Object.values(EstadoEnvioAssinatura)],
  ["TIPO_MOVIMENTACAO_LABEL", L.TIPO_MOVIMENTACAO_LABEL, Object.values(TipoMovimentacao)],
  ["RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL", L.RESULTADO_ENSAIO_VINCULO_MIGRACAO_LABEL, Object.values(ResultadoEnsaioVinculoMigracao)],
  ["ESTADO_LINHA_PREPARACAO_MIGRACAO_LABEL", L.ESTADO_LINHA_PREPARACAO_MIGRACAO_LABEL, Object.values(EstadoLinhaPreparacaoMigracao)],
  ["SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL", L.SITUACAO_APLICACAO_CADASTRO_MIGRACAO_LABEL, Object.values(SituacaoAplicacaoCadastroMigracao)],
  ["CATEGORIA_DOCUMENTO_LABEL", L.CATEGORIA_DOCUMENTO_LABEL, Object.values(CategoriaDocumento)],
  ["STATUS_FATURA_B2B_LABEL", L.STATUS_FATURA_B2B_LABEL, Object.values(StatusFaturaB2B)],
  ["ACAO_AGENTE_IA_LABEL", L.ACAO_AGENTE_IA_LABEL, Object.values(AcaoAgenteIATipo)],
  ["MOTIVO_HANDOFF_LABEL", L.MOTIVO_HANDOFF_LABEL, [...MOTIVOS_HANDOFF, "TURNO_INTERROMPIDO"]],
  ["STATUS_ACAO_AGENTE_IA_LABEL", L.STATUS_ACAO_AGENTE_IA_LABEL, Object.values(StatusAcaoAgenteIA)],
  ["MOTIVO_PAUSA_IA_LABEL", L.MOTIVO_PAUSA_IA_LABEL, Object.values(MotivoPausaAtendimentoIA)],
  ["STATUS_VERSAO_AGENTE_IA_LABEL", L.STATUS_VERSAO_AGENTE_IA_LABEL, Object.values(StatusVersaoAgenteIA)],
  ["ESTADO_POLITICA_LABEL", L.ESTADO_POLITICA_LABEL, Object.values(EstadoPolitica)],
  ["STATUS_FONTE_CONHECIMENTO_LABEL", L.STATUS_FONTE_CONHECIMENTO_LABEL, Object.values(StatusFonteConhecimento)],
  ["METRICA_META_LABEL", L.METRICA_META_LABEL, Object.values(MetricaMeta)],
  ["ORIGEM_CHAMADA_IA_LABEL", L.ORIGEM_CHAMADA_IA_LABEL, Object.values(OrigemChamadaIA)],
  ["ACAO_ORCAMENTO_IA_LABEL", L.ACAO_ORCAMENTO_IA_LABEL, Object.values(AcaoOrcamentoIA)],
  ["STATUS_TEMPLATE_LABEL", L.STATUS_TEMPLATE_LABEL, Object.values(StatusTemplate)],
  ["TIPO_MENSAGEM_LABEL", L.TIPO_MENSAGEM_LABEL, Object.values(TipoMensagem)],
  ["DRIVER_WHATSAPP_LABEL", L.DRIVER_WHATSAPP_LABEL, Object.values(DriverWhatsApp)],
  ["STATUS_INTENCAO_LABEL", L.STATUS_INTENCAO_LABEL, Object.values(StatusIntencao)],
  ["STATUS_MENSAGEM_AGENDADA_LABEL", L.STATUS_MENSAGEM_AGENDADA_LABEL, Object.values(StatusIntencao)],
  ["TIPO_APROVACAO_LABEL", L.TIPO_APROVACAO_LABEL, Object.values(TipoAprovacao)],
  ["VIGENCIA_LABEL", L.VIGENCIA_LABEL, Object.values(Vigencia)],
  ["TIPO_AJUSTE_LABEL", L.TIPO_AJUSTE_LABEL, Object.values(TipoAjuste)],
  ["TIPO_DESTINACAO_RECEBIMENTO_LABEL", L.TIPO_DESTINACAO_RECEBIMENTO_LABEL, Object.values(TipoDestinacaoRecebimento)],
  ["ESTADO_PROPOSTA_DECIDIDA_LABEL", L.ESTADO_PROPOSTA_DECIDIDA_LABEL, ["PENDENTE", "APROVADA", "REJEITADA", "APLICADA"]],
  ["STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL", L.STATUS_PROPOSTA_ACERTO_TAXA_ADITIVO_LABEL, Object.values(StatusPropostaAcertoTaxaAditivo)],
  ["STATUS_PROPOSTA_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL, Object.values(StatusPropostaConciliacaoFinanceiraMigracao)],
  ["STATUS_PROPOSTA_ENTRADA_FINANCEIRA_HISTORICA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_ENTRADA_FINANCEIRA_HISTORICA_MIGRACAO_LABEL, Object.values(StatusPropostaEntradaFinanceiraHistoricaMigracao)],
  ["STATUS_PROPOSTA_PRESENCA_HISTORICA_MIGRACAO_LABEL", L.STATUS_PROPOSTA_PRESENCA_HISTORICA_MIGRACAO_LABEL, Object.values(StatusPropostaPresencaHistoricaMigracao)],
  ["STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL", L.STATUS_CONJUNTO_IMPACTOS_TAXA_ADITIVO_LABEL, Object.values(StatusConjuntoImpactosTaxaAditivo)],
  ["STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL", L.STATUS_CONJUNTO_IMPACTOS_COBERTURA_ADITIVO_LABEL, Object.values(StatusConjuntoImpactosCoberturaAditivo)],
  ["DECISAO_IMPACTO_TAXA_ADITIVO_LABEL", L.DECISAO_IMPACTO_TAXA_ADITIVO_LABEL, Object.values(DecisaoImpactoTaxaAditivo)],
  ["CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL", L.CLASSIFICACAO_IMPACTO_COBERTURA_ADITIVO_LABEL, Object.values(ClassificacaoImpactoCoberturaAditivo)],
  ["MODALIDADE_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL", L.MODALIDADE_CONCILIACAO_FINANCEIRA_MIGRACAO_LABEL, Object.values(ModalidadeConciliacaoFinanceiraMigracao)],
  ["ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL", L.ESTADO_RESERVA_DEVOLUCAO_CREDITO_LABEL, Object.values(EstadoReservaDevolucaoCredito)],
  ["ESTADO_RECONFERENCIA_DELTA_DESISTENCIA_LABEL", L.ESTADO_RECONFERENCIA_DELTA_DESISTENCIA_LABEL, Object.values(EstadoReconferenciaDeltaDesistencia)],
  ["UNIDADE_PERMUTA_SERVICO_LABEL", L.UNIDADE_PERMUTA_SERVICO_LABEL, Object.values(UnidadePermutaServico)],
  ["STATUS_PAGAMENTO_INFORMADO_LABEL", L.STATUS_PAGAMENTO_INFORMADO_LABEL, Object.values(StatusPagamentoInformado)],
  ["AMBIENTE_ASSINATURA_LABEL", L.AMBIENTE_ASSINATURA_LABEL, ["SANDBOX", "PRODUCAO"]],
  ["TIPO_OCORRENCIA_HORAS_LABEL", L.TIPO_OCORRENCIA_HORAS_LABEL, OcorrenciaHorasSchema.innerType().shape.ocorrencia.options.map((o) => o.shape.tipo.value)],
  ["DESFECHO_OCORRENCIA_HORAS_LABEL", L.DESFECHO_OCORRENCIA_HORAS_LABEL, SaldoCompraHorasSchema.innerType().shape.reservas.element.shape.desfecho.options.filter((d) => d !== "PENDENTE")],
  ["TIPO_COBRANCA_ENTRADA_LABEL", L.TIPO_COBRANCA_ENTRADA_LABEL, ["MATRICULA", "MENSALIDADE", "HORA_PARTICULAR"]],
  ["REFERENCIA_COBERTURA_MENSAL_LABEL", L.REFERENCIA_COBERTURA_MENSAL_LABEL, Object.values(ReferenciaCoberturaMensal)],
  ["FINALIDADE_NUMERO_LABEL", L.FINALIDADE_NUMERO_LABEL, Object.values(FinalidadeNumero)],
  ["SETOR_ATENDIMENTO_LABEL", L.SETOR_ATENDIMENTO_LABEL, Object.values(FinalidadeAtendimentoWhatsApp)],
  ["STATUS_ATENDIMENTO_LABEL", L.STATUS_ATENDIMENTO_LABEL, Object.values(StatusAtendimentoWhatsApp)],
  ["FORMA_AGENDA_OFERTA_LABEL", L.FORMA_AGENDA_OFERTA_LABEL, Object.values(FormaAgendaOferta)],
  ["ETAPA_EXTENSO_LABEL", L.ETAPA_EXTENSO_LABEL, Object.values(EtapaLead)],
  ["PAPEL_LABEL", L.PAPEL_LABEL, Object.values(Papel)],
  ["ORIGEM_CANAL_LABEL", L.ORIGEM_CANAL_LABEL, Object.values(OrigemCanal)],
  ["PAPEL_PARTICIPANTE_LABEL", L.PAPEL_PARTICIPANTE_LABEL, Object.values(PapelParticipante)],
  ["COR_TAG_LABEL", L.COR_TAG_LABEL, Object.values(CorTag)],
  ["TIPO_CAMPO_PERSONALIZADO_LABEL", L.TIPO_CAMPO_PERSONALIZADO_LABEL, Object.values(TipoCampoPersonalizado)],
  ["ALVO_CAMPO_PERSONALIZADO_LABEL", L.ALVO_CAMPO_PERSONALIZADO_LABEL, Object.values(AlvoCampoPersonalizado)],
  ["TELA_FILTRO_SALVO_LABEL", L.TELA_FILTRO_SALVO_LABEL, Object.values(TelaFiltroSalvo)],
  ["TIPO_TAREFA_LABEL", L.TIPO_TAREFA_LABEL, Object.values(TipoTarefa)],
  ["STATUS_TAREFA_LABEL", L.STATUS_TAREFA_LABEL, Object.values(StatusTarefa)],
  ["PRIORIDADE_TAREFA_LABEL", L.PRIORIDADE_TAREFA_LABEL, Object.values(PrioridadeTarefa)],
  ["RECORRENCIA_TAREFA_LABEL", L.RECORRENCIA_TAREFA_LABEL, Object.values(RecorrenciaTarefa)],
  ["ORIGEM_TAREFA_LABEL", L.ORIGEM_TAREFA_LABEL, Object.values(OrigemTarefa)],
  ["TIPO_NOTIFICACAO_LABEL", L.TIPO_NOTIFICACAO_LABEL, Object.values(TipoNotificacao)],
];

describe("(iii) labels.ts: exports e mapas novos", () => {
  for (const [nome, mapa, valores] of MAPAS_NOVOS) {
    it(`${nome}: chaves = valores do enum; rótulo em texto de gente; congelado`, () => {
      expect(problemasDoMapa(mapa, valores), nome).toEqual([]);
    });
  }

  it("rotular devolve o rótulo e, para valor sem rótulo, o próprio valor (nunca frase inventada)", () => {
    expect(L.rotular(L.HABILIDADE_LABEL, "COMPREENSAO_ORAL")).toBe("Compreensão oral");
    const valorAntigo: string = "VALOR_ANTIGO";
    expect(L.rotular(L.STATUS_RESERVA_VAGA_LABEL, valorAntigo)).toBe("VALOR_ANTIGO");
  });
});
