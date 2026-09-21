import { conferirDisponibilidadeOfertaTx } from "./disponibilidade-oferta-tx";
import { carregarComprovacaoOfertaContinuidadeAgendaTx } from "./oferta-continuidade-agenda-tx";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { selecionarCondicaoContinuidadeVigente } from "./continuidade-condicao-vigente";
import { planejarContinuidadeMensal, planejarContinuidadeMensalAposRetomada, planejarContinuidadeMensalAposRetomadaComRegra, planejarContinuidadeMensalAposRecomposicao, planejarContinuidadeMensalAposAditivo } from "./continuidade-mensal";
import { carregarReferenciaRetomadaAplicadaTx } from "./continuidade-retomada-tx";
import { resolverPrecoContinuidadeMensalTx } from "./continuidade-preco-tx";
import { conferirIndisponibilidadeOfertaTx } from "./indisponibilidade-oferta-estado";
import { carregarReferenciaRecomposicaoAplicadaTx, conferirCompensacaoProgramadaContinuidadeTx, conferirOrigensConcorrentesAposRecomposicaoTx } from "./continuidade-recomposicao-tx";
import { carregarUltimaCoberturaContinuidadeTx } from "./continuidade-cadeia-tx";
import { carregarReferenciaAditivoCoberturaAplicadaTx } from "./continuidade-aditivo-cobertura-tx";
import { selecionarFonteContinuidade } from "./continuidade-precedencia";

const Entrada = z.object({ matriculaId: z.string().min(1), agora: z.date() }).strict();
const civil = (data: Date) => data.toISOString().slice(0, 10);

/** Fonte transacional: não autentica, não emite e não presume oferta por ausência de relato. */
export async function carregarContinuidadeMensalTx(tx: Prisma.TransactionClient, input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input);
  const m = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: {
    id: true, alunoId: true, leadId: true, status: true, contratoOk: true, confirmacaoContratoEm: true,
    contratoDocumentoId: true, moeda: true, preparacaoComercial: { select: { id: true, regime: true } },
  } });
  if (!m) throw new ErroRegra("Matrícula não encontrada.");
  if (m.status === "PAUSADA") throw new ErroRegra("A matrícula está pausada; confira a retomada antes de planejar continuidade.");
  if (["ENCERRADA", "CANCELADA"].includes(m.status)) throw new ErroRegra("A matrícula está encerrada e não possui continuidade mensal.");
  if (m.status !== "ATIVA") throw new ErroRegra("A matrícula precisa estar ativa para consultar a continuidade mensal.");
  if (!m.contratoOk || !m.confirmacaoContratoEm || !m.contratoDocumentoId) throw new ErroRegra("Confirme o contrato vigente da matrícula antes de consultar a continuidade.");
  if (m.preparacaoComercial?.regime !== "MENSALIDADE") throw new ErroRegra("A continuidade consultada exige uma preparação mensal autorizada.");
  const documento = await tx.documento.findFirst({ where: { id: m.contratoDocumentoId, categoria: "CONTRATO", arquivado: false,
    OR: [{ matriculaId: m.id }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] }, select: { id: true } });
  if (!documento) throw new ErroRegra("O documento contratual confirmado não está disponível.");
  const ultima = await carregarUltimaCoberturaContinuidadeTx(tx, m.id);
  const inicioSeguinte = new Date(ultima.coberturaFim); inicioSeguinte.setUTCDate(inicioSeguinte.getUTCDate() + 1);
  const condicoesAprovadas = await tx.condicoesContinuidadeMensalMatricula.findMany({ where: { matriculaId: m.id, status: "APROVADA" }, select: { id: true, versao: true, documentoId: true, regras: true } });
  const { condicoes, regras } = selecionarCondicaoContinuidadeVigente(condicoesAprovadas, civil(inicioSeguinte));
  if (condicoes.documentoId !== documento.id) throw new ErroRegra("As condições aprovadas não pertencem ao contrato confirmado atual.");
  if (regras.moeda !== m.moeda) throw new ErroRegra("A moeda das condições de continuidade diverge da matrícula.");
  const fuso = await carregarFusoInstitucionalTx(tx);
  if (!fuso) throw new ErroRegra("Configure o fuso institucional antes de planejar a continuidade.");
  const base = { ...regras, ultimaCobertura: { inicio: civil(ultima.coberturaInicio), fim: civil(ultima.coberturaFim) }, ultimoVencimento: dataCivilInstitucional(ultima.vencimento, fuso), dataPlanejamento: dataCivilInstitucional(d.agora, fuso) };
  const aditivo = await carregarReferenciaAditivoCoberturaAplicadaTx(tx, { matriculaId: m.id, inicioCobertura: inicioSeguinte, regraContratada: regras.regraCobertura });
  const recomposicao = await carregarReferenciaRecomposicaoAplicadaTx(tx, m.id);
  const retomada = await carregarReferenciaRetomadaAplicadaTx(tx, {
    matriculaId: m.id, cobrancaId: ultima.id, inicio: ultima.coberturaInicio, fim: ultima.coberturaFim,
  });
  const periodoIntegral = await tx.aplicacaoPeriodoIntegral.findFirst({
    where: { matriculaId: m.id, cobrancaId: ultima.id }, select: { id: true },
  });
  if (recomposicao && periodoIntegral) {
    throw new ErroRegra("A cobertura possui origens aplicadas concorrentes; confira a cadeia antes de planejar a continuidade.");
  }
  const referenciaPlanejamentoRecomposicao = recomposicao && {
    aplicacaoId: recomposicao.aplicacaoId,
    decisaoId: recomposicao.decisaoId,
    cobrancaId: recomposicao.cobrancaId,
    dataReferencia: recomposicao.dataReferencia,
  };
  const eventos = [
    ...(aditivo?.historico.map(item => ({ tipo: "ADITIVO" as const, aplicadaEm: item.aplicadaEm, politica: item.politica, referencia: item.referencia })) ?? []),
    ...(referenciaPlanejamentoRecomposicao ? [{ tipo: "RECOMPOSICAO" as const, aplicadaEm: recomposicao!.aplicadaEm, regra: { referencia: "CICLO_MATRICULA" as const, dataReferencia: referenciaPlanejamentoRecomposicao.dataReferencia } }] : []),
    ...(retomada ? [{ tipo: "RETOMADA" as const, aplicadaEm: retomada.aplicadaEm }] : []),
  ].sort((a, b) => a.aplicadaEm.localeCompare(b.aplicadaEm));
  const fonte = selecionarFonteContinuidade(eventos);
  let regraVigente = regras.regraCobertura;
  for (const evento of eventos) {
    if (evento.tipo === "RECOMPOSICAO") regraVigente = evento.regra;
    if (evento.tipo === "ADITIVO" && evento.politica.escolha === "MUDAR_REFERENCIA") regraVigente = evento.politica.referencia === "MES_CIVIL" ? { referencia: "MES_CIVIL" } : { referencia: "CICLO_MATRICULA", dataReferencia: evento.politica.dataReferencia };
  }
  const referenciaAditivoVigente = aditivo && { ...aditivo.referencia, regraAplicada: regraVigente };
  const planejar = fonte === "ADITIVO"
    ? (dados: typeof base) => planejarContinuidadeMensalAposAditivo(dados, referenciaAditivoVigente!)
    : fonte === "RECOMPOSICAO"
      ? (dados: typeof base) => planejarContinuidadeMensalAposRecomposicao(dados, referenciaPlanejamentoRecomposicao!)
      : fonte === "RETOMADA" ? (eventos.length
        ? (dados: typeof base) => planejarContinuidadeMensalAposRetomadaComRegra(dados, regraVigente)
        : planejarContinuidadeMensalAposRetomada)
        : planejarContinuidadeMensal;
  const cobertura = planejar(base).cobertura;
  await conferirCompensacaoProgramadaContinuidadeTx(tx, {
    matriculaId: m.id,
    inicio: new Date(`${cobertura.inicio}T00:00:00Z`),
    fim: new Date(`${cobertura.fim}T00:00:00Z`),
  });
  const memoriaPreco = await resolverPrecoContinuidadeMensalTx(tx, { matriculaId: m.id, inicioCobertura: new Date(`${cobertura.inicio}T00:00:00.000Z`), fimCobertura: new Date(`${cobertura.fim}T00:00:00.000Z`) });
  const { valorOriginal, valorNegociado, moeda } = memoriaPreco.preco;
  if (memoriaPreco.referencia.condicoesId !== condicoes.id) throw new ErroRegra("A regra de cobertura e a condição de preço pertencem a versões diferentes. Confira a vigência antes de planejar.");
  const plano = planejar({ ...base, valorOriginal, valorNegociado, moeda });
  const oferta = await conferirIndisponibilidadeOfertaTx(tx, { matriculaId: m.id, inicio: new Date(`${cobertura.inicio}T00:00:00Z`), fim: new Date(`${cobertura.fim}T00:00:00Z`) });
  const comprovacaoAgenda = oferta.estado === "SEM_RELATO"
    ? await carregarComprovacaoOfertaContinuidadeAgendaTx(tx, { matriculaId: m.id, inicio: new Date(`${cobertura.inicio}T00:00:00Z`), fim: new Date(`${cobertura.fim}T00:00:00Z`) })
    : { estado: "BLOQUEADA_POR_INDISPONIBILIDADE" as const, memoria: null };
  const confirmacaoGestao = comprovacaoAgenda.estado === "EXIGE_CONFIRMACAO_GESTAO"
    ? await conferirDisponibilidadeOfertaTx(tx, { matriculaId: m.id, inicio: cobertura.inicio, fim: cobertura.fim }) : null;
  const comprovacaoOferta = confirmacaoGestao?.consumivel
    ? { estado: "CONFIRMADA_PELA_GESTAO" as const, memoria: { aprovacao: confirmacaoGestao.aprovacao } }
    : comprovacaoAgenda;
  return { matriculaId: m.id, fusoInstitucional: fuso, plano, memoriaPreco, oferta, comprovacaoOferta,
    condicoes: { id: condicoes.id, versao: condicoes.versao, documentoId: condicoes.documentoId }, documentoId: documento.id, ultimaCobrancaId: ultima.id, referenciaRecomposicao: recomposicao, referenciaAditivo: aditivo, referenciaRetomada: retomada,
    disponivel: false as const, podeEmitir: false as const,
    motivo: oferta.estado === "INDISPONIVEL" ? "Há falta de oferta confirmada para este período. A prévia não autoriza emitir mensalidade."
      : oferta.estado === "PENDENTE_CONFERENCIA" ? "Há relato de falta de oferta aguardando conferência para este período."
        : "Prévia informativa; a rotina de emissão revalida contrato, prazo e oferta antes de criar cobrança." };
}

