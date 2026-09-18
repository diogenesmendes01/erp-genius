import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { preservarConclusaoAssinaturaTx } from "./conclusao-assinatura-tx";
import { IdentidadeSignatarioSchema } from "./participantes-schema";
import { hashPrevia } from "./previa-estado";
import { prepararModeloTx } from "./modelos-tx";
import { decidirModeloContratual } from "./modelos";
import { prepararAditivoContratualTx, decidirAditivoContratualTx } from "./aditivo-tx";
import { consultarAditivosContratuais, consultarPropostaAditivo, prepararAditivoContratual, decidirAditivoContratual } from "./aditivos";
import { GET as abrirPreviaPdf } from "@/app/api/matriculas/[id]/aditivos/[propostaId]/previa-pdf/route";
import { conferirParticipantesAditivoTx } from "./aditivo-participantes-tx";
import { conferirParticipantesAditivo, consultarFormularioParticipantesAditivo, consultarConferenciasParticipantesAditivo } from "./aditivo-participantes";
import { ConteudoModeloSchema } from "./modelo-schema";
import { preservarOriginalAditivo, consultarOriginaisAditivo } from "./aditivo-originais";
import { preservarOriginalAditivoTx } from "./aditivo-original-tx";
import { consultarAssinaturaAditivo, registrarConferenciaAssinaturaAditivo } from "./aditivo-assinatura";
import { registrarConferenciaAssinaturaAditivoTx } from "./aditivo-assinatura-tx";
import { GET as abrirOriginalAditivo } from "@/app/api/matriculas/[id]/aditivos/[propostaId]/originais/[artefatoId]/pdf/route";
import { decidirAlcadaAditivo, consultarAlcadasAditivo } from "./aditivo-alcadas";
import { carregarContextoParticipantesAditivoTx } from "./aditivo-participantes-contexto";
import { prepararProcessoAssinaturaAditivo, consultarProcessoAssinaturaAditivo } from "./aditivo-envio";
import { iniciarTentativaAditivoTx, registrarResultadoEnvioAditivoTx } from "./aditivo-envio-tx";
import { preservarConclusaoAssinaturaAditivoTx } from "./aditivo-conclusao-tx";
import { consultarConferenciaFinalAditivo, registrarConferenciaFinalAditivo } from "./aditivo-conferencia-final";
import { consultarEfeitosAditivo } from "./aditivo-efeitos-consulta";
import { aplicarCondicoesFormalizadasAditivo, formalizarEAplicarCondicoesAditivo, registrarCondicoesFormalizadasAditivo, consultarAplicacaoCondicoesAditivo, consultarCondicoesAditivo } from "./aditivo-condicoes";
import { resolverHoraVigenteTx } from "./aditivo-hora-vigente";
import { resolverMensalVigenteTx } from "./aditivo-mensal-vigente";
import { GET as abrirConclusaoAditivo } from "@/app/api/matriculas/[id]/aditivos/[propostaId]/assinaturas/[conclusaoId]/[tipo]/route";

let fixture: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>;
let conclusaoId: string, conclusaoHash: string, modeloId: string, modeloHash: string;
const entrada = () => ({ matriculaId: fixture.matriculaId, conclusaoOriginalId: conclusaoId, conclusaoHashEsperado: conclusaoHash,
  modeloId, modeloHashEsperado: modeloHash, vigenciaInicio: "2026-10-01T00:00:00-03:00",
  alteracoes: [{ origem: "ALUNO_NOME", novo: "Nome contratual atualizado e conferido" }],
  motivo: "Formalizar a alteração acordada", chaveIdempotencia: "aditivo-primeira-proposta" });
const preparar = (extra = {}) => prisma.$transaction(tx => prepararAditivoContratualTx(tx, fixture.secretariaId, { ...entrada(), ...extra }), { timeout: 20000 });

async function verificarEmissaoContinuidade(matriculaId: string, testarQ162 = false) {
  const { emitirContinuidadeMensalTx } = await import("@/server/matricula/continuidade-emissao-tx");
  const { consultarFilaContinuidadeMensal } = await import("@/server/matricula/continuidade-fila");
  const { rodarEmissaoMensalContinuidade } = await import("@/server/matricula/continuidade-emissao-cron");
  const { carregarUltimaCoberturaContinuidadeTx } = await import("@/server/matricula/continuidade-cadeia-tx");
  const { proporDisponibilidadeOferta, decidirDisponibilidadeOferta } = await import("@/server/matricula/disponibilidade-oferta");
  const ancora = await prisma.$transaction(tx => carregarUltimaCoberturaContinuidadeTx(tx, matriculaId));
  const alvo = { matriculaId, ultimaCobrancaIdEsperada: ancora.id };
  const emitir = () => prisma.$transaction(tx => emitirContinuidadeMensalTx(tx, alvo), { timeout: 30_000 });
  const antes = await prisma.cobranca.count();
  // Antes da antecedência contratada, nem mesmo uma matrícula ativa é suficiente.
  await expect(emitir()).rejects.toThrow(/marco de emissão/i);
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2099-10-30T12:00:00Z"));
    await expect(emitir()).rejects.toThrow(/oferta/i);
    authMock.mockResolvedValue({ user: { id: fixture.adminId } });
    expect(await consultarFilaContinuidadeMensal()).toMatchObject({ ok: true, dado: { itens: expect.arrayContaining([expect.objectContaining({ matriculaId, estado: "CONFERENCIA" })]) } });
    expect(await rodarEmissaoMensalContinuidade()).toMatchObject({ emitidas: 0, pendentes: 1, falhas: 0 });
    expect(await prisma.cobranca.count()).toBe(antes);
    authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
    const proposta = await proporDisponibilidadeOferta({ matriculaId, inicio: "2099-11-01", fim: "2099-11-30", motivo: "Oferta mensal conferida para emissão", evidenciaTexto: "Gestão verificou disponibilidade no período contratual", chaveIdempotencia: "oferta-emissao-integrada" });
    if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
    authMock.mockResolvedValue({ user: { id: fixture.adminId } });
    const decisao = await decidirDisponibilidadeOferta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Conferência pedagógica independente", evidenciaTexto: "Disponibilidade conferida para a matrícula e todo o período" });
    if (!decisao.ok) throw new Error(JSON.stringify(decisao));
    expect(await consultarFilaContinuidadeMensal()).toMatchObject({ ok: true, dado: { itens: expect.arrayContaining([expect.objectContaining({ matriculaId, estado: "PRONTA", cobertura: { inicio: "2099-11-01", fim: "2099-11-30" } })]) } });
    expect(await prisma.cobranca.count()).toBe(antes);
    const [a, b] = await Promise.all([emitir(), emitir()]);
    expect(a.cobrancaId).toBe(b.cobrancaId);
    expect([a.repetida, b.repetida].sort()).toEqual([false, true]);
    expect(await prisma.cobranca.count()).toBe(antes + 1);
    expect(await prisma.emissaoContinuidadeMensal.count({ where: { matriculaId } })).toBe(1);
    const nova = await prisma.cobranca.findUniqueOrThrow({ where: { id: a.cobrancaId } });
    expect(nova.coberturaInicio?.toISOString()).toBe("2099-11-01T00:00:00.000Z");
    expect(nova.coberturaFim?.toISOString()).toBe("2099-11-30T00:00:00.000Z");
    expect(nova.valorNegociado.toFixed(2)).toBe("500.00");
    expect(nova.valorRecebido).toBeNull();
    expect(await consultarFilaContinuidadeMensal()).toMatchObject({ ok: true, dado: { itens: expect.arrayContaining([expect.objectContaining({ matriculaId, estado: "CONFERENCIA", cobertura: { inicio: "2099-12-01", fim: "2099-12-31" } })]) } });
    const memoria = await prisma.emissaoContinuidadeMensal.findUniqueOrThrow({ where: { cobrancaId: nova.id } });
    expect(memoria.snapshot).toMatchObject({ comprovacaoOferta: { estado: "CONFIRMADA_PELA_GESTAO" }, plano: { vencimento: "2099-11-09" } });
    await expect(prisma.emissaoContinuidadeMensal.update({ where: { id: memoria.id }, data: { snapshotHash: "f".repeat(64) } })).rejects.toThrow();
    await expect(prisma.emissaoContinuidadeMensal.delete({ where: { id: memoria.id } })).rejects.toThrow();
    if (testarQ162) {
      const { registrarRelatoIndisponibilidadeOferta } = await import("@/server/matricula/indisponibilidade-oferta-relato");
      const { confirmarRelatoIndisponibilidadeOferta } = await import("@/server/matricula/indisponibilidade-oferta-confirmacao");
      const { prepararCompensacaoCobertura, decidirCompensacaoCobertura } = await import("@/server/matricula/compensacao-cobertura");
      const { preverRecomposicaoCobertura } = await import("@/server/matricula/recomposicao-previa");
      const { salvarRascunhoRecomposicao } = await import("@/server/matricula/recomposicao-rascunho");
      const { decidirRecomposicaoCobertura } = await import("@/server/matricula/recomposicao-decisao");
      const { aplicarRecomposicaoCobertura } = await import("@/server/matricula/recomposicao-aplicar");
      const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId }, select: { alunoId: true } });
      authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
      const relato = await registrarRelatoIndisponibilidadeOferta({ matriculaId, inicio: "2099-10-01", fim: "2099-10-02", motivo: "Oferta indisponível em dois dias da cobertura anterior", evidenciaTexto: "Fonte Q156 preservada para os direitos de recomposição", chaveIdempotencia: "q162-origem-oferta" });
      if (!relato.ok || !relato.dado) throw new Error(JSON.stringify(relato));
      authMock.mockResolvedValue({ user: { id: fixture.adminId } });
      const confirmou = await confirmarRelatoIndisponibilidadeOferta({ registroId: relato.dado.id, confirmada: true, motivo: "Indisponibilidade confirmada pela gestão", evidenciaTexto: "A gestão conferiu os dois dias que originam a recomposição" });
      if (!confirmou.ok) throw new Error(JSON.stringify(confirmou));
      const compensador = await criarUsuario(["FINANCEIRO"]);
      await prisma.usuario.update({ where: { id: compensador.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
      authMock.mockResolvedValue({ user: { id: compensador.id } });
      const direitos = await prepararCompensacaoCobertura({ matriculaId, cobrancaId: ancora.id, versaoCobranca: 1, dias: ["2099-10-01", "2099-10-02"], motivo: "Direitos originados pela indisponibilidade confirmada", evidenciaCondicoes: "Contrato e cobertura anterior conferidos", chaveIdempotencia: "q162-direitos" });
      if (!direitos.ok || !direitos.dado) throw new Error(JSON.stringify(direitos));
      authMock.mockResolvedValue({ user: { id: fixture.adminId } });
      const decisaoDireitos = await decidirCompensacaoCobertura({ id: direitos.dado.id, aprovar: true, motivo: "Direitos de recomposição conferidos" });
      if (!decisaoDireitos.ok) throw new Error(JSON.stringify(decisaoDireitos));
      const dias = await prisma.diaCompensacaoCobertura.findMany({ where: { matriculaId }, select: { id: true } });
      const recomposicao = { alunoId: matricula.alunoId, matriculaId, retornoOferta: "2099-11-01", inicioCompensacao: "2099-11-01", motivo: "Retorno da oferta confirmado para recomposição", evidenciaCondicoes: "Condições contratuais e dias de direito conferidos", direitosIds: dias.map((dia) => dia.id), periodosPropostos: [
        { cobrancaId: ancora.id, cobertura: { inicio: "2099-10-01", fim: "2099-10-31" } },
        { cobrancaId: nova.id, cobertura: { inicio: "2099-11-03", fim: "2099-12-02" } },
      ] };
      const previaRecomposicao = await preverRecomposicaoCobertura(recomposicao);
      if (!previaRecomposicao.ok) throw new Error(JSON.stringify(previaRecomposicao));
      authMock.mockResolvedValue({ user: { id: compensador.id } });
      const rascunho = await salvarRascunhoRecomposicao({ ...recomposicao, versaoAnterior: 0, chaveIdempotencia: "q162-rascunho" });
      if (!rascunho.ok || !rascunho.dado) throw new Error(JSON.stringify(rascunho));
      authMock.mockResolvedValue({ user: { id: fixture.adminId } });
      const decisao = await decidirRecomposicaoCobertura({ alunoId: matricula.alunoId, matriculaId, rascunhoId: rascunho.dado.id, aprovar: true, motivo: "Recomposição Q162 conferida independentemente" });
      if (!decisao.ok || !decisao.dado) throw new Error(JSON.stringify(decisao));
      const aplicada = await aplicarRecomposicaoCobertura({ alunoId: matricula.alunoId, matriculaId, decisaoId: decisao.dado.id });
      if (!aplicada.ok) throw new Error(JSON.stringify(aplicada));
      expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: nova.id } })).toMatchObject({ coberturaInicio: new Date("2099-11-03T00:00:00.000Z"), coberturaFim: new Date("2099-12-02T00:00:00.000Z") });
      expect(await prisma.diaProgramadoRecomposicao.count({ where: { aplicacaoId: aplicada.dado?.id } })).toBe(2);
      authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
      const ofertaSeguinte = await proporDisponibilidadeOferta({ matriculaId, inicio: "2099-12-03", fim: "2100-01-02", motivo: "Oferta conferida para o ciclo posterior à recomposição", evidenciaTexto: "Gestão conferiu toda a cobertura seguinte sem somar períodos", chaveIdempotencia: "q162-oferta-seguinte" });
      if (!ofertaSeguinte.ok || !ofertaSeguinte.dado) throw new Error(JSON.stringify(ofertaSeguinte));
      authMock.mockResolvedValue({ user: { id: fixture.adminId } });
      expect(await decidirDisponibilidadeOferta({ propostaId: ofertaSeguinte.dado.id, aprovada: true, motivo: "Oferta seguinte aprovada independentemente", evidenciaTexto: "Cobertura completa posterior à recomposição conferida" })).toMatchObject({ ok: true });
      vi.setSystemTime(new Date("2099-12-30T12:00:00Z"));
      const seguinte = await prisma.$transaction(tx => emitirContinuidadeMensalTx(tx, { matriculaId, ultimaCobrancaIdEsperada: nova.id }));
      const cobrancaSeguinte = await prisma.cobranca.findUniqueOrThrow({ where: { id: seguinte.cobrancaId } });
      expect(cobrancaSeguinte.coberturaInicio).toEqual(new Date("2099-12-03T00:00:00.000Z"));
      expect(cobrancaSeguinte.coberturaFim).toEqual(new Date("2100-01-02T00:00:00.000Z"));
      expect(await prisma.cobranca.count({ where: { matriculaId, tipo: "MENSALIDADE" } })).toBe(3);
      authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
      const ofertaPosterior = await proporDisponibilidadeOferta({ matriculaId, inicio: "2100-01-03", fim: "2100-02-02", motivo: "Oferta conferida para o segundo ciclo após a recomposição", evidenciaTexto: "Gestão conferiu a cobertura própria posterior sem reutilizar a confirmação anterior", chaveIdempotencia: "q162-oferta-posterior" });
      if (!ofertaPosterior.ok || !ofertaPosterior.dado) throw new Error(JSON.stringify(ofertaPosterior));
      authMock.mockResolvedValue({ user: { id: fixture.adminId } });
      expect(await decidirDisponibilidadeOferta({ propostaId: ofertaPosterior.dado.id, aprovada: true, motivo: "Oferta posterior aprovada independentemente", evidenciaTexto: "A nova cobertura completa foi conferida pela gestão" })).toMatchObject({ ok: true });
      vi.setSystemTime(new Date("2100-01-30T12:00:00Z"));
      const posterior = await prisma.$transaction(tx => emitirContinuidadeMensalTx(tx, { matriculaId, ultimaCobrancaIdEsperada: cobrancaSeguinte.id }));
      const cobrancaPosterior = await prisma.cobranca.findUniqueOrThrow({ where: { id: posterior.cobrancaId } });
      expect(cobrancaPosterior.coberturaInicio).toEqual(new Date("2100-01-03T00:00:00.000Z"));
      expect(cobrancaPosterior.coberturaFim).toEqual(new Date("2100-02-02T00:00:00.000Z"));
      expect(await prisma.cobranca.count({ where: { matriculaId, tipo: "MENSALIDADE" } })).toBe(4);
      for (const id of [seguinte.cobrancaId, posterior.cobrancaId]) {
        const registro = await prisma.emissaoContinuidadeMensal.findUniqueOrThrow({ where: { cobrancaId: id } });
        expect(registro.snapshot).toMatchObject({ plano: { memoriaCobertura: { regraAplicada: { referencia: "CICLO_MATRICULA", dataReferencia: "2099-12-03" }, origemRecomposicao: { aplicacaoId: aplicada.dado?.id } } } });
      }
      const periodos = await prisma.cobranca.findMany({ where: { matriculaId, tipo: "MENSALIDADE" }, orderBy: { coberturaInicio: "asc" } });
      for (let i = 1; i < periodos.length; i++) expect(periodos[i].coberturaInicio!.getTime()).toBeGreaterThan(periodos[i - 1].coberturaFim!.getTime());
      expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: nova.id } })).vencimento).toEqual(nova.vencimento);
      return;
    }
    // Repetir a mesma âncora continua retornando novembro, mesmo em uma rodada futura.
    vi.setSystemTime(new Date("2099-11-30T12:00:00Z"));
    expect((await emitir()).cobrancaId).toBe(nova.id);
    await expect(prisma.$transaction(tx => emitirContinuidadeMensalTx(tx, { matriculaId, ultimaCobrancaIdEsperada: nova.id }))).rejects.toThrow(/oferta/i);
    expect(await prisma.cobranca.count()).toBe(antes + 1);
  } finally { vi.useRealTimers(); authMock.mockResolvedValue({ user: { id: fixture.secretariaId } }); }
}

async function verificarPrecoContinuidadeMensal(versaoId: string, testarEmissao = false, testarQ162 = false) {
  const { consultarAceiteOriginal, confirmarAceiteOriginal } = await import("./aceite");
  const alvo = { matriculaId: fixture.matriculaId, conclusaoId };
  const revisao = await consultarAceiteOriginal(alvo);
  if (!revisao.ok || !revisao.dado?.revisao) throw new Error(JSON.stringify(revisao));
  const aceite = await confirmarAceiteOriginal({ ...alvo, revisaoHash: revisao.dado.revisao.hash, evidenciasConferidas: true, motivo: "Conferência da contratação mensal", chaveIdempotencia: "aceite-continuidade" });
  if (!aceite.ok || !aceite.dado) throw new Error(JSON.stringify(aceite));
  const { prepararCondicoesContinuidadeMensal, decidirCondicoesContinuidadeMensal } = await import("@/server/matricula/condicoes-continuidade-mensal");
  const condicoes = await prepararCondicoesContinuidadeMensal({ matriculaId: fixture.matriculaId, documentoId: aceite.dado.documentoId, motivo: "Transcrição de continuidade contratada", regras: {
    continuidadeContratada: { contratada: true, clausula: "Continuidade mensal conforme contrato e aditivo", evidenciaId: aceite.dado.documentoId },
    regraCobertura: { referencia: "MES_CIVIL" }, diaVencimento: 5, antecedenciaDias: 10, referenciaVencimento: "MES_COBERTURA" as const,
    valorOriginal: "85000", valorNegociado: "500", moeda: "CRC", vigenteDesde: "2026-11-01", ajusteVencimento: {
      regra: "PROXIMO_DIA_UTIL", calendario: { id: "calendario-financeiro-contratual", versao: 1, referencia: "Referência financeira sintética",
        inicioVigencia: "2026-01-01", fimVigencia: "2100-12-31", diasSemanaUteis: [1, 2, 3, 4, 5], feriados: ["2099-11-05", "2099-11-06"] },
    },
  } });
  if (!condicoes.ok || !condicoes.dado) throw new Error(JSON.stringify(condicoes));
  authMock.mockResolvedValue({ user: { id: fixture.adminId } });
  expect(await decidirCondicoesContinuidadeMensal({ id: condicoes.dado.id, aprovar: true, motivo: "Transcrição conferida independentemente" })).toMatchObject({ ok: true });
  const { resolverPrecoContinuidadeMensalTx } = await import("@/server/matricula/continuidade-preco-tx");
  const consulta = { matriculaId: fixture.matriculaId, inicioCobertura: new Date("2026-11-01T00:00:00Z"), fimCobertura: new Date("2026-11-30T00:00:00Z") };
  const conferir = () => prisma.$transaction(tx => resolverPrecoContinuidadeMensalTx(tx, consulta));
  const validado = await conferir();
  expect(validado).toMatchObject({ preco: { valorOriginal: "85000", valorNegociado: "500", moeda: "CRC", versaoAditivo: { id: versaoId } }, referencia: { condicoesId: condicoes.dado.id, documentoId: aceite.dado.documentoId } });
  const cobrancasAntes = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  await prisma.precoReferencia.updateMany({ where: { tipoCobranca: "MENSALIDADE" }, data: { valor: "100000" } });
  expect(await conferir()).toEqual(validado);
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancasAntes);
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId } });
  await prisma.politicaComissao.create({ data: { paisId: matricula.paisId, produtoId: matricula.produtoId, versao: 1, tipo: "PERCENTUAL", percentual: 10, moeda: "CRC", vigenteEm: new Date("2020-01-01"), criadaPorId: fixture.adminId } });
  const taxa = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: matricula.id, tipo: "MATRICULA" } });
  const { registrarPagamento } = await import("@/server/financeiro/acoes");
  expect(await registrarPagamento(taxa.id, { chaveIdempotencia: "taxa-continuidade-ativacao", valorRecebido: taxa.valorNegociado.toNumber(), forma: "DINHEIRO", comentario: "Recebimento da taxa conferido para ativação contratual" })).toMatchObject({ ok: true });
  const { concluirMatricula } = await import("@/server/matricula/acoes");
  const ativacao = await concluirMatricula(matricula.id);
  if (!ativacao.ok) throw new Error(JSON.stringify(ativacao));
  const { consultarPreviaContinuidadeMensal } = await import("@/server/matricula/continuidade-previa");
  const previa = await consultarPreviaContinuidadeMensal(matricula.id);
  expect(previa).toMatchObject({ ok: true, dado: { plano: { vencimento: "2099-11-09", emissaoEm: "2099-10-30",
    memoriaVencimento: { dataCalculada: "2099-11-05", dataAjustada: "2099-11-09", referenciaCalendarioAplicada: { id: "calendario-financeiro-contratual", versao: 1 } } } } });
  expect(previa).toMatchObject({ ok: true, dado: { podeEmitir: false, plano: { cobertura: { inicio: "2099-11-01", fim: "2099-11-30" }, valorOriginal: "85000", valorNegociado: "500" } } });
  expect(await prisma.matricula.findUnique({ where: { id: matricula.id } })).toMatchObject({ status: "ATIVA" });
  const cobrancasAposAtivacao = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  expect(await consultarPreviaContinuidadeMensal(matricula.id)).toEqual(previa);
  const { carregarContinuidadeMensalTx } = await import("@/server/matricula/continuidade-estado-tx");
  for (const caso of [
    { inicio: "2099-11-01", fim: "2099-11-30", bloqueia: true },
    { inicio: "2099-10-31", fim: "2099-11-02", bloqueia: true },
    { inicio: "2000-01-01", fim: "2000-01-31", bloqueia: false },
  ]) {
    const rollback = new Error("Desfazer somente a fixture adicional de cadeia");
    await expect(prisma.$transaction(async tx => {
      await tx.cobranca.create({ data: { matriculaId: matricula.id, tipo: "MENSALIDADE", status: "CANCELADA",
        moeda: "CRC", valorOriginal: "500", valorNegociado: "500", vencimento: new Date(caso.inicio),
        coberturaInicio: new Date(caso.inicio), coberturaFim: new Date(caso.fim) } });
      const consultaCadeia = carregarContinuidadeMensalTx(tx, { matriculaId: matricula.id, agora: new Date() });
      if (caso.bloqueia) await expect(consultaCadeia).rejects.toThrow(/cancelada|crédito/i);
      else expect(await consultaCadeia).toMatchObject({ plano: { cobertura: { inicio: "2099-11-01", fim: "2099-11-30" } } });
      throw rollback;
    })).rejects.toBe(rollback);
  }
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancasAposAtivacao);
  if (testarEmissao) { await verificarEmissaoContinuidade(matricula.id, testarQ162); return; }
  const { registrarRelatoIndisponibilidadeOferta } = await import("@/server/matricula/indisponibilidade-oferta-relato");
  const { confirmarRelatoIndisponibilidadeOferta } = await import("@/server/matricula/indisponibilidade-oferta-confirmacao");
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  const relato = await registrarRelatoIndisponibilidadeOferta({ matriculaId: matricula.id, inicio: "2099-11-01", fim: null,
    motivo: "Continuidade sem turma disponível", evidenciaTexto: "Escola conferirá a oferta para o próximo período", chaveIdempotencia: "oferta-pendente-continuidade" });
  if (!relato.ok || !relato.dado) throw new Error(JSON.stringify(relato));
  expect(await consultarPreviaContinuidadeMensal(matricula.id)).toMatchObject({ ok: true, dado: { podeEmitir: false, oferta: { estado: "PENDENTE_CONFERENCIA" } } });
  authMock.mockResolvedValue({ user: { id: fixture.adminId } });
  expect(await confirmarRelatoIndisponibilidadeOferta({ registroId: relato.dado.id, confirmada: true,
    motivo: "Indisponibilidade da escola conferida", evidenciaTexto: "Não foi possível garantir continuidade neste intervalo" })).toMatchObject({ ok: true });
  expect(await consultarPreviaContinuidadeMensal(matricula.id)).toMatchObject({ ok: true, dado: { podeEmitir: false, oferta: { estado: "INDISPONIVEL" } } });
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancasAposAtivacao);
  await expect(prisma.$transaction(tx => resolverPrecoContinuidadeMensalTx(tx, { ...consulta, matriculaId: "outra-matricula" }))).rejects.toThrow();
  const { RegrasContinuidadeMensalSchema } = await import("@/server/matricula/continuidade-mensal-schema");
  const preservada = await prisma.condicoesContinuidadeMensalMatricula.findUniqueOrThrow({ where: { id: condicoes.dado.id } });
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  const futura = await prepararCondicoesContinuidadeMensal({ matriculaId: fixture.matriculaId, documentoId: aceite.dado.documentoId,
    regras: { ...RegrasContinuidadeMensalSchema.parse(preservada.regras), vigenteDesde: "2100-01-01", diaVencimento: 20 }, motivo: "Condição contratual para período futuro" });
  if (!futura.ok || !futura.dado) throw new Error(JSON.stringify(futura));
  authMock.mockResolvedValue({ user: { id: fixture.adminId } });
  expect(await decidirCondicoesContinuidadeMensal({ id: futura.dado.id, aprovar: true, motivo: "Condição futura conferida independentemente" })).toMatchObject({ ok: true });
  expect(await consultarPreviaContinuidadeMensal(matricula.id)).toMatchObject({ ok: true, dado: {
    podeEmitir: false, memoriaPreco: { referencia: { condicoesId: condicoes.dado.id } },
    plano: { cobertura: { inicio: "2099-11-01", fim: "2099-11-30" }, vencimento: "2099-11-09" },
  } });
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancasAposAtivacao);
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  const divergente = await prepararCondicoesContinuidadeMensal({ matriculaId: fixture.matriculaId, documentoId: aceite.dado.documentoId,
    regras: { ...RegrasContinuidadeMensalSchema.parse(preservada.regras), valorNegociado: "300" }, motivo: "Transcrição de preço divergente para conferência" });
  if (!divergente.ok || !divergente.dado) throw new Error(JSON.stringify(divergente));
  authMock.mockResolvedValue({ user: { id: fixture.adminId } });
  expect(await decidirCondicoesContinuidadeMensal({ id: divergente.dado.id, aprovar: true, motivo: "Revisão registrada no teste" })).toMatchObject({ ok: true });
  await expect(conferir()).rejects.toThrow();
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancasAposAtivacao);
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
}

async function verificarFechamentoHoraAditivo(versaoId: string) {
  const { consultarAceiteOriginal, confirmarAceiteOriginal } = await import("./aceite");
  const alvo = { matriculaId: fixture.matriculaId, conclusaoId };
  const revisao = await consultarAceiteOriginal(alvo);
  if (!revisao.ok || !revisao.dado?.revisao) throw new Error(`Aceite: ${JSON.stringify(revisao)}`);
  const aceite = await confirmarAceiteOriginal({ ...alvo, revisaoHash: revisao.dado.revisao.hash, evidenciasConferidas: true, motivo: "Conferência do contrato por hora", chaveIdempotencia: "aceite-hora-integrado" });
  if (!aceite.ok || !aceite.dado) throw new Error(JSON.stringify(aceite));
  const documentoId = aceite.dado.documentoId;
  const { prepararCondicoesHoras, decidirCondicoesHoras } = await import("@/server/matricula/condicoes-horas");
  const condicoes = await prepararCondicoesHoras({ matriculaId: fixture.matriculaId, documentoId, regras: { valorHora: "125.00", moeda: "CRC", unidadeMinutos: 60, vigenteDesde: "2026-01-01T00:00:00Z", antecedenciaCancelamentoMinutos: 90, clausulaPreco: "Preço original de 125 por hora", clausulaCancelamento: "Cancelamento conforme antecedência" }, motivo: "Transcrição das condições originais" });
  if (!condicoes.ok || !condicoes.dado) throw new Error(JSON.stringify(condicoes));
  authMock.mockResolvedValue({ user: { id: fixture.adminId } });
  expect(await decidirCondicoesHoras({ id: condicoes.dado.id, aprovar: true, motivo: "Condições originais conferidas" })).toMatchObject({ ok: true });
  const professor = await criarUsuario(["PROFESSOR"]);
  const encontro = await prisma.encontroAgenda.create({ data: { matriculaId: fixture.matriculaId, professorId: professor.id, preparadorId: fixture.adminId, inicio: new Date("2026-09-10T15:00:00Z"), fim: new Date("2026-09-10T16:15:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Encontro histórico para apuração", chaveIdempotencia: "hora-aditivo-encontro", entradaHash: "fixture" } });
  const { registrarOcorrenciaParticular } = await import("@/server/matricula/ocorrencia-particular");
  authMock.mockResolvedValue({ user: { id: professor.id } });
  const ocorrencia = await registrarOcorrenciaParticular({ encontroId: encontro.id, versaoAnterior: 0, tipo: "REALIZADA", evidencia: "Aula realizada de 75 minutos", chaveIdempotencia: "hora-aditivo-ocorrencia" });
  if (!ocorrencia.ok || !ocorrencia.dado) throw new Error(JSON.stringify(ocorrencia));
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId } });
  const d = { alunoId: m.alunoId, matriculaId: m.id, ocorrenciaId: ocorrencia.dado.id, condicoesId: condicoes.dado.id };
  authMock.mockResolvedValue({ user: { id: fixture.adminId } });
  const { preverConferenciaOcorrenciaHoras } = await import("@/server/matricula/ocorrencia-financeira-previa");
  const { conferirOcorrenciaHoras } = await import("@/server/matricula/ocorrencia-financeira-conferir");
  const previa = await preverConferenciaOcorrenciaHoras(d);
  expect(previa).toMatchObject({ ok: true, dado: { minutos: 75, valorApurado: "250.00", precoHoraAplicado: "200", aditivo: { id: versaoId } } });
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  expect(await conferirOcorrenciaHoras({ ...d, estadoPrevia: previa.dado.estadoPrevia, motivo: "Valor e aditivo conferidos", chaveIdempotencia: "hora-aditivo-conferencia" })).toMatchObject({ ok: true });
  const { prepararFechamentoHoras } = await import("@/server/matricula/fechamento-horas-rascunho");
  const { decidirFechamentoHoras } = await import("@/server/matricula/fechamento-horas-decisao");
  const { emitirFechamentoHoras } = await import("@/server/matricula/fechamento-horas-emissao");
  const r = await prepararFechamentoHoras({ alunoId: m.alunoId, matriculaId: m.id, documentoId, versaoAnterior: 0, periodo: { referencia: { referencia: "MES_CIVIL" }, dataNoPeriodo: "2026-09-10", fuso: "UTC", vencimento: "2026-10-10", clausula: "Fechamento mensal de horas contratadas" }, escolha: "AGUARDAR", motivo: "Apuração do mês com aditivo", chaveIdempotencia: "hora-aditivo-fechamento" });
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  const aprovador = await criarUsuario(["ADMINISTRADOR"]);
  authMock.mockResolvedValue({ user: { id: aprovador.id } });
  const decisao = await decidirFechamentoHoras({ alunoId: m.alunoId, matriculaId: m.id, rascunhoId: r.dado.id, aprovar: true, confirmaReferenciaContratual: true, motivo: "Aprovação independente do fechamento" });
  if (!decisao.ok || !decisao.dado) throw new Error(JSON.stringify(decisao));
  const executar = { alunoId: m.alunoId, matriculaId: m.id, decisaoId: decisao.dado.id };
  const emitida = await emitirFechamentoHoras(executar);
  if (!emitida.ok || !emitida.dado) throw new Error(JSON.stringify(emitida));
  expect(await emitirFechamentoHoras(executar)).toEqual(emitida);
  const cobranca = await prisma.cobranca.findUniqueOrThrow({ where: { id: emitida.dado.cobrancaId } });
  expect(cobranca.valorNegociado.toFixed(2)).toBe("250.00");
  expect(cobranca.moeda).toBe("CRC");
  expect(await prisma.itemFechamentoHoras.count()).toBe(1);
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
}
const decidir = (p: { id: string; propostaHash: string }, aprovada = true, autor = fixture.adminId) => prisma.$transaction(tx => decidirAditivoContratualTx(tx, autor, {
  propostaId: p.id, propostaHashEsperado: p.propostaHash, aprovada, motivo: "Revisão administrativa das condições",
}), { timeout: 20000 });

it("financeira estruturada: revisão dos efeitos usa a matrícula exata e não aplica valores", async () => {
  const antes = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  const p = await preparar({ alteracoes: [{ origem: "MENSALIDADE_VALOR", novo: "500.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "500", moeda: "CRC" } }] });
  const alvo = { matriculaId: fixture.matriculaId, propostaId: p.id };
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  const r = await consultarEfeitosAditivo(alvo);
  expect(r).toMatchObject({ ok: true, dado: { aplicado: false, efeitos: expect.arrayContaining([{ origem: "MENSALIDADE_VALOR", dominio: "COBRANCA_EMITIDA", destino: "cobrancas.MENSALIDADE_VALOR", valor: { tipo: "DINHEIRO", valor: "500", moeda: "CRC" }, exigeAcerto: true }]) } });
  expect(await consultarEfeitosAditivo({ ...alvo, matriculaId: "outra" })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: fixture.secretariaId }, data: { ativo: false } });
  expect(await consultarEfeitosAditivo(alvo)).toMatchObject({ ok: false });
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(antes);
});

beforeEach(async (contexto) => {
  await truncarBanco(); fixture = await prepararFixtureSubstituicaoContratual(authMock, { camposFinanceiros: contexto.task.name.startsWith("financeira estruturada:") || contexto.task.name.includes("PRODUCAO_MENSAL"), ambiente: contexto.task.name.includes("PRODUCAO") ? "PRODUCAO" : "SANDBOX", porHora: contexto.task.name.includes("PRODUCAO_HORA"), semSubstituicao: contexto.task.name.includes("PRODUCAO_MENSAL"), valorServicoMensal: contexto.task.name.includes("PRODUCAO_MENSAL_Q162") ? "85000" : undefined });
  const processo = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: fixture.processoId }, include: { artefato: { include: { conferencia: true } } } });
  const snapshot = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(processo.artefato.conferencia.snapshot);
  const agora = new Date().toISOString();
  const c = await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { processoId: processo.id, referenciaExterna: fixture.referenciaExternaFonte,
    originalHash: processo.artefato.pdfHash, concluidaEm: agora, pdfAssinado: Buffer.from("%PDF-assinatura de teste Q117"), evidencias: Buffer.from("evidências simuladas Q117"),
    assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(snapshot.participantes[0].identidade), referenciaAssinatura: "assinatura-q117", assinadaEm: agora }] }));
  conclusaoId = c.id;
  conclusaoHash = (await prisma.conclusaoAssinaturaContratual.findUniqueOrThrow({ where: { id: c.id } })).entradaHash;
  const campos = [["original", "ADITIVO_CONTRATO_ORIGINAL"], ["anteriores", "ADITIVO_ANTERIORES"], ["alteracoes", "ADITIVO_ALTERACOES"], ["vigencia", "ADITIVO_VIGENCIA"]] as const;
  const m = await prisma.$transaction(tx => prepararModeloTx(tx, fixture.secretariaId, { codigo: "ADITIVO_Q117", versaoEsperada: 0,
    chaveIdempotencia: "modelo-aditivo-q117", motivo: "Modelo institucional de aditivo", conteudo: {
      titulo: "Aditivo ao contrato", finalidade: "ADITIVO", regimes: ["MENSALIDADE", "HORA_PARTICULAR"], aplicacao: "Alterações de condições contratadas",
      campos: campos.map(([chave, origem]) => ({ chave, origem, descricao: chave })),
      secoes: [{ titulo: "Condições e referência", texto: "{{original}}\n{{anteriores}}\n{{alteracoes}}\n{{vigencia}}" }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }],
    } }));
  modeloId = m.id; modeloHash = (await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: m.id } })).conteudoHash;
  authMock.mockResolvedValue({ user: { id: fixture.adminId } });
  const decisao = await decidirModeloContratual({ modeloId, conteudoHash: modeloHash, aprovada: true, motivo: "Modelo conferido independentemente" });
  expect(decisao.ok).toBe(true);
});

it("persiste proposta e decisão sem alterar contrato, cobrança ou processo, com repetição idempotente", async () => {
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId } });
  const cobrancas = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  const processos = await prisma.processoAssinaturaContratual.findMany({ orderBy: { id: "asc" } });
  const [p, repetida] = await Promise.all([preparar(), preparar()]); expect(repetida).toEqual(p);
  const registro = await prisma.propostaAditivoContratual.findUniqueOrThrow({ where: { id: p.id } });
  expect(registro.snapshot).toMatchObject({ base: { ambiente: "SANDBOX" }, alteracoes: [{ campo: "ALUNO_NOME", novo: entrada().alteracoes[0].novo }] });
  expect(JSON.stringify(registro.snapshot)).toContain("Original");
  const decisao = await decidir(p); expect(await decidir(p)).toEqual(decisao);
  expect(await prisma.matricula.findUnique({ where: { id: fixture.matriculaId } })).toEqual(m);
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancas);
  expect(await prisma.processoAssinaturaContratual.findMany({ orderBy: { id: "asc" } })).toEqual(processos);
  expect(await prisma.propostaAditivoContratual.count()).toBe(1);
  await expect(prisma.propostaAditivoContratual.update({ where: { id: p.id }, data: { motivo: "Reescrever proposta anterior" } })).rejects.toThrow("imutável");
  await expect(prisma.decisaoAditivoContratual.delete({ where: { id: decisao.id } })).rejects.toThrow("imutável");
});

it("financeira estruturada: recusa moeda divergente e cobertura parcial invertida sem efeitos", async () => {
  const cobrancas = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  const dinheiro = { origem: "MENSALIDADE_VALOR", novo: "500.00 USD", valorEstruturado: { tipo: "DINHEIRO", valor: "500.00", moeda: "USD" } };
  await expect(preparar({ alteracoes: [dinheiro] })).rejects.toThrow("moeda contratual");
  await expect(preparar({ alteracoes: [{ origem: "COBERTURA_INICIO", novo: "2099-11-01", valorEstruturado: { tipo: "DATA", data: "2099-11-01" } }] })).rejects.toThrow("posterior ao fim");
  await expect(preparar({ alteracoes: [{ origem: "MOEDA", novo: "USD", valorEstruturado: { tipo: "MOEDA", moeda: "USD" } }, dinheiro] })).rejects.toThrow("todas as condições monetárias");
  await expect(preparar({ alteracoes: [{ origem: "COBERTURA_INICIO", novo: "2099-11-01", valorEstruturado: { tipo: "DATA", data: "2099-11-01" } }, { origem: "COBERTURA_FIM", novo: "2099-12-01" }] })).rejects.toThrow("valores estruturados");
  expect(await prisma.propostaAditivoContratual.count()).toBe(0);
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancas);
});

it("financeira estruturada: aprova proposta coerente sem aplicar novos valores ou cobertura", async () => {
  const cobrancas = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  const p = await preparar({ alteracoes: [
    { origem: "MENSALIDADE_VALOR", novo: "500.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "500", moeda: "CRC" } },
    { origem: "COBERTURA_INICIO", novo: "2099-11-01", valorEstruturado: { tipo: "DATA", data: "2099-11-01" } },
    { origem: "COBERTURA_FIM", novo: "2099-11-30", valorEstruturado: { tipo: "DATA", data: "2099-11-30" } },
  ] });
  expect(await decidir(p)).toMatchObject({ aprovada: true });
  const proposta = await prisma.propostaAditivoContratual.findUniqueOrThrow({ where: { id: p.id } });
  expect(proposta.snapshot).toMatchObject({ alteracoes: [
    { campo: "MENSALIDADE_VALOR", anterior: "999999.00 CRC", novo: "500.00 CRC" },
    { campo: "COBERTURA_INICIO", anterior: "2099-10-01", novo: "2099-11-01" },
    { campo: "COBERTURA_FIM", anterior: "2099-10-31", novo: "2099-11-30" },
  ] });
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancas);
});

it("financeira estruturada: exige decisões financeira e comercial independentes antes dos signatários", async () => {
  const p = await preparar({ alteracoes: [{ origem: "MENSALIDADE_VALOR", novo: "500.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "500", moeda: "CRC" } }] });
  await decidir(p);
  const contexto = () => prisma.$transaction(tx => carregarContextoParticipantesAditivoTx(tx, p.id), { timeout: 20000 });
  await expect(contexto()).rejects.toThrow();
  const financeiro = await criarUsuario(["FINANCEIRO"]);
  const comercial = await criarUsuario(["GERENTE_COMERCIAL"]);
  const entradaAlcada = { matriculaId: fixture.matriculaId, propostaId: p.id, propostaHash: p.propostaHash, alcada: "FINANCEIRA" as const, aprovada: true, motivo: "Condições financeiras conferidas na proposta" };
  authMock.mockResolvedValue({ user: { id: financeiro.id } });
  const consultaSemPermissao = await consultarAlcadasAditivo({ matriculaId: fixture.matriculaId, propostaId: p.id });
  expect(consultaSemPermissao).toMatchObject({ ok: true, dado: { podeDecidir: [], alcadas: [{ alcada: "FINANCEIRA" }] } });
  if (!consultaSemPermissao.ok || !consultaSemPermissao.dado) throw new Error("Consulta financeira indisponível");
  expect(consultaSemPermissao.dado.alcadas).toHaveLength(1);
  expect(consultaSemPermissao.dado.alcadas[0].campos.map(c => c.campo)).toEqual(["MENSALIDADE_VALOR"]);
  expect(await decidirAlcadaAditivo(entradaAlcada)).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: financeiro.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  expect(await consultarAlcadasAditivo({ matriculaId: "outra-matricula", propostaId: p.id })).toMatchObject({ ok: false });
  const financeira = await decidirAlcadaAditivo(entradaAlcada);
  expect(financeira).toMatchObject({ ok: true });
  expect(await decidirAlcadaAditivo(entradaAlcada)).toEqual(financeira);
  expect(await decidirAlcadaAditivo({ ...entradaAlcada, motivo: "Alteração da decisão já registrada" })).toMatchObject({ ok: false });
  await expect(contexto()).rejects.toThrow();
  expect(await decidirAlcadaAditivo({ ...entradaAlcada, alcada: "COMERCIAL" })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: comercial.id } });
  expect(await decidirAlcadaAditivo({ ...entradaAlcada, alcada: "COMERCIAL" })).toMatchObject({ ok: true });
  await expect(contexto()).resolves.toHaveProperty("proposta.id", p.id);
  const registro = await prisma.decisaoAlcadaAditivo.findFirstOrThrow({ where: { propostaId: p.id } });
  await expect(prisma.decisaoAlcadaAditivo.delete({ where: { id: registro.id } })).rejects.toThrow();
  expect(await prisma.decisaoAlcadaAditivo.count()).toBe(2);
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
});

it("financeira estruturada: acúmulo de papéis não autoriza autoaprovação de alçada", async () => {
  const p = await preparar({ alteracoes: [{ origem: "MENSALIDADE_VALOR", novo: "500.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "500", moeda: "CRC" } }] });
  await decidir(p);
  await prisma.usuario.update({ where: { id: fixture.secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "ADMINISTRADOR"] } });
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  expect(await consultarAlcadasAditivo({ matriculaId: fixture.matriculaId, propostaId: p.id })).toMatchObject({ ok: true, dado: { podeDecidir: [] } });
  expect(await decidirAlcadaAditivo({ matriculaId: fixture.matriculaId, propostaId: p.id, propostaHash: p.propostaHash, alcada: "FINANCEIRA", aprovada: true, motivo: "Tentativa do próprio preparador" })).toMatchObject({ ok: false });
  await expect(prisma.decisaoAlcadaAditivo.create({ data: { propostaId: p.id, decisorId: fixture.secretariaId, propostaHash: p.propostaHash, alcada: "FINANCEIRA", aprovada: true, motivo: "Tentativa direta do preparador" } })).rejects.toThrow();
  expect(await prisma.decisaoAlcadaAditivo.count()).toBe(0);
});

it("preserva a entrada estruturada da proposta e impede reutilizar a chave com outro valor", async () => {
  const alteracao = { origem: "ALUNO_NOME" as const, novo: "Corrigido", valorEstruturado: { tipo: "TEXT" as const, texto: "Corrigido" } };
  const p = await preparar({ alteracoes: [alteracao], chaveIdempotencia: "aditivo-texto-estruturado" });
  const registro = await prisma.propostaAditivoContratual.findUniqueOrThrow({ where: { id: p.id } });
  expect(registro.snapshot).toMatchObject({ entrada: { alteracoes: [alteracao] } });
  expect(await decidir(p)).toMatchObject({ aprovada: true });
  await expect(preparar({ alteracoes: [{ ...alteracao, novo: "Outro texto", valorEstruturado: { tipo: "TEXT", texto: "Outro texto" } }], chaveIdempotencia: "aditivo-texto-estruturado" })).rejects.toThrow("Chave");
});

it("nega autoaprovação no serviço e no banco mesmo acumulando papéis", async () => {
  await prisma.usuario.update({ where: { id: fixture.secretariaId }, data: { papeis: ["SECRETARIA_ACADEMICA", "ADMINISTRADOR"] } });
  const p = await preparar();
  await expect(decidir(p, true, fixture.secretariaId)).rejects.toThrow("Outra pessoa");
  await expect(prisma.decisaoAditivoContratual.create({ data: { propostaId: p.id, decisorId: fixture.secretariaId, aprovada: true, motivo: "Tentativa direta de autoaprovação", propostaHash: p.propostaHash } })).rejects.toThrow("outro administrador");
});

it("recusa proposta superada e hash errado, permitindo rejeitar a versão antiga", async () => {
  const p = await preparar();
  await expect(decidir({ ...p, propostaHash: "f".repeat(64) })).rejects.toThrow("proposta revisada");
  await expect(preparar({ motivo: "Mudança com mesma chave idempotente" })).rejects.toThrow("Chave");
  const nova = await preparar({ chaveIdempotencia: "aditivo-nova-proposta" }); expect(nova.versao).toBe(2);
  await expect(decidir(p)).rejects.toThrow("mais recente");
  expect(await decidir(p, false)).toMatchObject({ aprovada: false });
});

it("não aceita fonte de outra matrícula, hash alterado, dados internos ou valor anterior inventado", async () => {
  await expect(preparar({ matriculaId: "matricula-inexistente" })).rejects.toThrow();
  await expect(preparar({ conclusaoHashEsperado: "0".repeat(64) })).rejects.toThrow("integridade");
  await expect(preparar({ preparadaPorId: fixture.adminId })).rejects.toThrow();
  await expect(preparar({ alteracoes: [{ origem: "MENSALIDADE_VALOR", novo: "400.00 BRL" }] })).rejects.toThrow("não está estruturada");
  await expect(preparar({ alteracoes: [{ origem: "ALUNO_NOME", anterior: "inventado", novo: "Outro nome" }] })).rejects.toThrow();
});

it("revogação do papel impede preparação e decisão; rollback não deixa aprovação ou proposta parcial", async () => {
  const vendedor = await criarUsuario(["VENDEDOR"]);
  await expect(prisma.$transaction(tx => prepararAditivoContratualTx(tx, vendedor.id, entrada()))).rejects.toThrow();
  await expect(prisma.$transaction(async tx => { await prepararAditivoContratualTx(tx, fixture.secretariaId, entrada()); throw new Error("interromper"); }, { timeout: 20000 })).rejects.toThrow("interromper");
  expect(await prisma.propostaAditivoContratual.count()).toBe(0);
  const p = await preparar();
  await prisma.usuario.update({ where: { id: fixture.adminId }, data: { ativo: false } });
  await expect(decidir(p)).rejects.toThrow();
  expect(await prisma.decisaoAditivoContratual.count()).toBe(0);
});

it("recusa modelo de contrato inicial e snapshot com fonte incompatível também no banco", async () => {
  const original = await prisma.artefatoContratual.findUniqueOrThrow({ where: { id: fixture.artefatoFonteId }, include: { previa: { include: { modelo: true } } } });
  await expect(preparar({ modeloId: original.previa.modeloId, modeloHashEsperado: original.previa.modelo.conteudoHash })).rejects.toThrow("modelo institucional de aditivo");
  await expect(preparar({ modeloHashEsperado: "0".repeat(64) })).rejects.toThrow("versão publicada");
  const p = await preparar();
  const registro = await prisma.propostaAditivoContratual.findUniqueOrThrow({ where: { id: p.id } });
  const snapshot = JSON.parse(JSON.stringify(registro.snapshot));
  snapshot.versao = 2; snapshot.base.originalHash = "0".repeat(64);
  await expect(prisma.propostaAditivoContratual.create({ data: { ...registro, id: "aditivo-adulterado", versao: 2,
    chaveIdempotencia: "aditivo-adulterado-direto", snapshot } })).rejects.toThrow("Base preservada");
  expect(await prisma.propostaAditivoContratual.count()).toBe(1);
});

it("ações autorizadas apresentam a fonte histórica, modelo e proposta, sem expor evidências internas", async () => {
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  const painel = await consultarAditivosContratuais({ matriculaId: fixture.matriculaId });
  expect(painel.ok).toBe(true); if (!painel.ok || !painel.dado) throw new Error("Painel indisponível");
  expect(painel.dado.fonte).toMatchObject({ conclusaoId, ambiente: "SANDBOX" });
  expect(painel.dado.fonte?.campos[0].anterior).toContain("Original");
  expect(painel.dado.modelos.map(m => m.id)).toEqual([modeloId]);
  const criado = await prepararAditivoContratual({ ...entrada(), alteracoes: [{ origem: "ALUNO_NOME", novo: "Nome contratual atualizado e conferido" }] });
  expect(criado.ok).toBe(true); if (!criado.ok || !criado.dado) throw new Error("Proposta indisponível");
  const consulta = { matriculaId: fixture.matriculaId, propostaId: criado.dado.id };
  const detalhe = await consultarPropostaAditivo(consulta);
  expect(detalhe.ok).toBe(true); if (!detalhe.ok || !detalhe.dado) throw new Error("Detalhe indisponível");
  expect(detalhe.dado).toMatchObject({ podeDecidir: false, ambiente: "SANDBOX", superada: false, conclusaoOriginalId: conclusaoId });
  expect(detalhe.dado.impactos).toMatchObject({ grupos: ["CADASTRAL"], impactos: [{ campo: "ALUNO_NOME", grupo: "CADASTRAL", tipo: "TEXT",
    novo: "Nome contratual atualizado e conferido", exigeEstruturacao: true }] });
  expect(detalhe.dado.impactos.impactos[0].anterior).toBe(detalhe.dado.alteracoes[0].anterior);
  expect(detalhe.dado.impactos.impactos[0].rotulo).toBe(detalhe.dado.alteracoes[0].rotulo);
  const publicado = JSON.stringify(detalhe.dado);
  for (const chave of ["referenciaExterna", "evidenciasHash", "chaveIdempotencia", "baseHash", "snapshot"]) expect(publicado).not.toContain(chave);
  expect(await consultarPropostaAditivo({ ...consulta, matriculaId: "outra-matricula" })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: fixture.adminId } });
  expect(await consultarPropostaAditivo(consulta)).toMatchObject({ ok: true, dado: { podeDecidir: true } });
  expect(await decidirAditivoContratual({ propostaId: criado.dado.id, propostaHashEsperado: criado.dado.propostaHash, aprovada: true, motivo: "Revisão independente no fluxo público" })).toMatchObject({ ok: true });
  expect(await consultarPropostaAditivo(consulta)).toMatchObject({ ok: true, dado: { podeDecidir: false, decisao: { aprovada: true } } });
});

it("vendedor, professor, pedagógico, financeiro e conta revogada não acessam ações contratuais", async () => {
  const p = await preparar();
  for (const papel of ["VENDEDOR", "PROFESSOR", "GERENTE_PEDAGOGICO", "FINANCEIRO"] as const) {
    const usuario = await criarUsuario([papel]); authMock.mockResolvedValue({ user: { id: usuario.id } });
    expect(await consultarAditivosContratuais({ matriculaId: fixture.matriculaId })).toMatchObject({ ok: false });
    expect(await consultarPropostaAditivo({ matriculaId: fixture.matriculaId, propostaId: p.id })).toMatchObject({ ok: false });
    expect(await prepararAditivoContratual({ ...entrada(), alteracoes: [{ origem: "ALUNO_NOME", novo: "Tentativa não autorizada" }] })).toMatchObject({ ok: false });
    expect(await decidirAditivoContratual({ propostaId: p.id, propostaHashEsperado: p.propostaHash, aprovada: true, motivo: "Tentativa não autorizada" })).toMatchObject({ ok: false });
  }
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  await prisma.usuario.update({ where: { id: fixture.secretariaId }, data: { ativo: false } });
  expect(await consultarAditivosContratuais({ matriculaId: fixture.matriculaId })).toMatchObject({ ok: false });
  expect(await prisma.propostaAditivoContratual.count()).toBe(1);
  expect(await prisma.decisaoAditivoContratual.count()).toBe(0);
});

it("pagina o histórico sem duplicar propostas e identifica a versão superada", async () => {
  const ids: string[] = [];
  for (let numero = 1; numero <= 21; numero++) ids.push((await preparar({ chaveIdempotencia: `aditivo-paginacao-${numero}` })).id);
  authMock.mockResolvedValue({ user: { id: fixture.adminId } });
  const primeira = await consultarAditivosContratuais({ matriculaId: fixture.matriculaId });
  const segunda = await consultarAditivosContratuais({ matriculaId: fixture.matriculaId, pagina: 2 });
  expect(primeira.ok).toBe(true); expect(segunda.ok).toBe(true);
  if (!primeira.ok || !primeira.dado || !segunda.ok || !segunda.dado) throw new Error("Histórico indisponível");
  expect(primeira.dado.propostas).toHaveLength(20); expect(primeira.dado.maisPropostas).toBe(true);
  expect(segunda.dado.propostas).toHaveLength(1); expect(segunda.dado.maisPropostas).toBe(false);
  expect([...primeira.dado.propostas, ...segunda.dado.propostas].map(p => p.id)).toEqual([...ids].reverse());
  expect(await consultarPropostaAditivo({ matriculaId: fixture.matriculaId, propostaId: ids[0] })).toMatchObject({ ok: true, dado: { superada: true, podeDecidir: true } });
  expect(await consultarPropostaAditivo({ matriculaId: fixture.matriculaId, propostaId: ids[20] })).toMatchObject({ ok: true, dado: { superada: false, podeDecidir: true } });
  expect(await consultarAditivosContratuais({ matriculaId: fixture.matriculaId, pagina: 0 })).toMatchObject({ ok: false });
});

it("rota de PDF exige sessão, papel e matrícula exata e não formaliza o aditivo", async () => {
  const p = await preparar();
  const abrir = (matriculaId = fixture.matriculaId) => abrirPreviaPdf(new Request("http://localhost/previa-pdf"), { params: Promise.resolve({ id: matriculaId, propostaId: p.id }) });
  authMock.mockResolvedValue(null);
  expect((await abrir()).status).toBe(401);
  const vendedor = await criarUsuario(["VENDEDOR"]);
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  const negada = await abrir(); expect(negada.status).toBe(403); expect(negada.headers.get("Cache-Control")).toBe("private, no-store");
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  expect((await abrir("outra-matricula")).status).toBe(404);
  const resposta = await abrir(); expect(resposta.status).toBe(200);
  expect(resposta.headers.get("Content-Type")).toBe("application/pdf");
  expect(resposta.headers.get("Cache-Control")).toBe("private, no-store");
  expect(resposta.headers.get("Content-Disposition")).toContain("previa-aditivo-");
  const bytes = Buffer.from(await resposta.arrayBuffer()); expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(Buffer.from(await (await abrir()).arrayBuffer())).toEqual(bytes);
  expect(await prisma.decisaoAditivoContratual.count()).toBe(0);
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.propostaAditivoContratual.count()).toBe(1);
  await prisma.usuario.update({ where: { id: fixture.secretariaId }, data: { ativo: false } });
  expect((await abrir()).status).toBe(401);
});

async function prepararConferencia(estruturado = false, mensalidade = false, taxa = false) {
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId }, include: { aluno: true } });
  const porHora = (await prisma.preparacaoComercialMatricula.findUniqueOrThrow({ where: { matriculaId: fixture.matriculaId } })).regime === "HORA_PARTICULAR";
  const identidade = { nome: estruturado && !porHora && !mensalidade ? "Nome atualizado no aditivo" : [m.aluno.primeiroNome, m.aluno.sobrenome].filter(Boolean).join(" "), email: m.aluno.email!, documento: m.aluno.documento! };
  const proposta = await preparar({ ...(porHora ? { vigenciaInicio: "2026-09-01T00:00:00Z" } : {}), alteracoes: porHora
    ? [{ origem: "HORA_VALOR", novo: "200.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "200", moeda: "CRC" } }]
    : taxa
      ? [{ origem: "TAXA_VALOR", novo: "500.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "500", moeda: "CRC" } }]
      : mensalidade
      ? [{ origem: "MENSALIDADE_VALOR", novo: "500.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "500", moeda: "CRC" } }]
      : [{ origem: "ALUNO_NOME", novo: identidade.nome, ...(estruturado ? { valorEstruturado: { tipo: "TEXT", texto: identidade.nome } } : {}) }] });
  const dados = { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, versaoEsperada: 0, maioridade: null,
    participantes: [{ papel: "ALUNO" as const, identidade }], identificacoesConferidas: true as const,
    motivo: "Identificação conferida especificamente para o aditivo", chaveIdempotencia: "conferencia-aditivo-primeira" };
  return { proposta, dados };
}
async function prepararOriginalAditivo(estruturado = false, mensalidade = false, taxa = false) {
  const { proposta, dados } = await prepararConferencia(estruturado, mensalidade, taxa); await decidir(proposta);
  if (mensalidade || taxa || (await prisma.preparacaoComercialMatricula.findUniqueOrThrow({ where: { matriculaId: fixture.matriculaId } })).regime === "HORA_PARTICULAR") {
    authMock.mockResolvedValue({ user: { id: fixture.adminId } });
    for (const alcada of ["FINANCEIRA", "COMERCIAL"] as const) expect(await decidirAlcadaAditivo({ matriculaId: fixture.matriculaId, propostaId: proposta.id, propostaHash: proposta.propostaHash, alcada, aprovada: true, motivo: "Preço por hora aprovado independentemente" })).toMatchObject({ ok: true });
  }
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  const conferencia = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, fixture.secretariaId, dados), { timeout: 20000 });
  return { proposta, dados, conferencia, entradaOriginal: { matriculaId: fixture.matriculaId, propostaId: proposta.id, conferenciaId: conferencia.id,
    conferenciaHash: conferencia.revisaoHash, motivo: "Texto e participantes conferidos para preservar original", conteudoConferido: true as const } };
}
async function prepararRevisaoOriginal(estruturado = false, mensalidade = false, taxa = false) {
  const base = await prepararOriginalAditivo(estruturado, mensalidade, taxa), original = await preservarOriginalAditivo(base.entradaOriginal);
  if (!original.ok || !original.dado) throw new Error("Original não gerado");
  const alvo = { matriculaId: fixture.matriculaId, propostaId: base.proposta.id, artefatoId: original.dado.id };
  const revisao = await consultarAssinaturaAditivo(alvo);
  if (!revisao.ok || !revisao.dado?.revisao) throw new Error("Revisão indisponível");
  return { ...base, alvo, revisao: revisao.dado.revisao, confirmar: { ...alvo, revisaoHash: revisao.dado.revisao.hash, dadosConferidos: true as const,
    motivo: "Original e signatários revisados antes da assinatura", chaveIdempotencia: "conferencia-original-aditivo" } };
}

it("prepara processo do aditivo exato e preserva incerteza sem repetir envio", async () => {
  const { confirmar, alvo } = await prepararRevisaoOriginal();
  const conferencia = await registrarConferenciaAssinaturaAditivo(confirmar);
  if (!conferencia.ok || !conferencia.dado) throw new Error("Conferência indisponível");
  const entradaProcesso = { ...alvo, conferenciaId: conferencia.dado.id, fornecedor: "ZAPSIGN" as const, ambiente: "SANDBOX" as const };
  expect(await prepararProcessoAssinaturaAditivo({ ...entradaProcesso, ambiente: "PRODUCAO" })).toMatchObject({ ok: false });
  const criado = await prepararProcessoAssinaturaAditivo(entradaProcesso);
  expect(criado).toMatchObject({ ok: true });
  if (!criado.ok || !criado.dado) throw new Error("Processo não criado");
  expect(await prepararProcessoAssinaturaAditivo(entradaProcesso)).toEqual(criado);
  expect(await prepararProcessoAssinaturaAditivo({ ...entradaProcesso, fornecedor: "CLICKSIGN" })).toMatchObject({ ok: false });
  const processoId = criado.dado.id;
  const iniciar = () => prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, fixture.secretariaId, { processoId }), { timeout: 30000 });
  const tentativa = await iniciar();
  await expect(iniciar()).rejects.toThrow();
  const resultado = { processoId, tentativaId: tentativa.tentativaId, chave: "resultado-aditivo-incerto", resultado: "INCERTO" as const, referenciaExterna: null, evidenciaHash: "a".repeat(64) };
  const registrar = (entrada: Parameters<typeof registrarResultadoEnvioAditivoTx>[1]) => prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, entrada));
  const incerto = await registrar(resultado);
  expect(await registrar(resultado)).toEqual(incerto);
  await expect(registrar({ ...resultado, evidenciaHash: "b".repeat(64) })).rejects.toThrow();
  expect(await prisma.processoAssinaturaAditivo.findUnique({ where: { id: processoId } })).toMatchObject({ estado: "ENVIO_INCERTO", referenciaExterna: null });
  await expect(iniciar()).rejects.toThrow();
  await registrar({ ...resultado, chave: "resultado-aditivo-conciliado", resultado: "REGISTRADO", referenciaExterna: "aditivo-sandbox-simulado" });
  expect(await prisma.processoAssinaturaAditivo.findUnique({ where: { id: processoId } })).toMatchObject({ estado: "ENVIADO", tentativaAtual: 1 });
  await expect(prisma.processoAssinaturaAditivo.update({ where: { id: processoId }, data: { estado: "PREPARADO" } })).rejects.toThrow();
  expect(await consultarProcessoAssinaturaAditivo(alvo)).toMatchObject({ ok: true });
  expect(await consultarProcessoAssinaturaAditivo({ ...alvo, matriculaId: "outra-matricula" })).toMatchObject({ ok: false });
  const vendedor = await criarUsuario(["VENDEDOR"]); authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarProcessoAssinaturaAditivo(alvo)).toMatchObject({ ok: false });
  expect(await prepararProcessoAssinaturaAditivo(entradaProcesso)).toMatchObject({ ok: false });
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.conclusaoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.tentativaEnvioAditivo.count()).toBe(1);
});

it("nova tentativa do aditivo exige confirmação de não criação e recusa retorno antigo", async () => {
  const { confirmar, alvo } = await prepararRevisaoOriginal();
  const conferencia = await registrarConferenciaAssinaturaAditivo(confirmar);
  if (!conferencia.ok || !conferencia.dado) throw new Error("Conferência indisponível");
  const processo = await prepararProcessoAssinaturaAditivo({ ...alvo, conferenciaId: conferencia.dado.id, fornecedor: "ZAPSIGN", ambiente: "SANDBOX" });
  if (!processo.ok || !processo.dado) throw new Error("Processo indisponível");
  const processoId = processo.dado.id;
  const iniciar = () => prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, fixture.secretariaId, { processoId }), { timeout: 30000 });
  const primeira = await iniciar();
  await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId, tentativaId: primeira.tentativaId, chave: "nao-criado-prova-fornecedor", resultado: "NAO_CRIADO", referenciaExterna: null, evidenciaHash: "b".repeat(64) }));
  const segunda = await iniciar();
  expect(segunda.numero).toBe(2);
  await expect(prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId, tentativaId: primeira.tentativaId, chave: "resposta-atrasada-anterior", resultado: "REGISTRADO", referenciaExterna: "referencia-antiga", evidenciaHash: "c".repeat(64) }))).rejects.toThrow();
  expect(await prisma.processoAssinaturaAditivo.findUnique({ where: { id: processoId } })).toMatchObject({ estado: "ENVIANDO", tentativaAtual: 2, referenciaExterna: null });
  expect(await prisma.observacaoEnvioAditivo.count()).toBe(1);
});

it.each(["SANDBOX", "PRODUCAO", "PRODUCAO_HORA", "PRODUCAO_MENSAL", "PRODUCAO_MENSAL_TAXA_SEM_CONSUMIDOR", "PRODUCAO_MENSAL_EMISSAO", "PRODUCAO_MENSAL_Q162"] as const)("preserva a conclusão assinada do aditivo sem herdar assinaturas: %s", async modo => {
  const ambiente = modo === "SANDBOX" ? "SANDBOX" : "PRODUCAO";
  const taxaSemConsumidor = modo === "PRODUCAO_MENSAL_TAXA_SEM_CONSUMIDOR";
  const { confirmar, alvo } = await prepararRevisaoOriginal(true, modo.startsWith("PRODUCAO_MENSAL"), taxaSemConsumidor);
  const conferencia = await registrarConferenciaAssinaturaAditivo(confirmar);
  if (!conferencia.ok || !conferencia.dado) throw new Error("Conferência indisponível");
  const processo = await prepararProcessoAssinaturaAditivo({ ...alvo, conferenciaId: conferencia.dado.id, fornecedor: "ZAPSIGN", ambiente });
  if (!processo.ok || !processo.dado) throw new Error("Processo indisponível");
  const processoId = processo.dado.id;
  const tentativa = await prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, fixture.secretariaId, { processoId }), { timeout: 30000 });
  await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId, tentativaId: tentativa.tentativaId, chave: "envio-conclusao-aditivo", resultado: "REGISTRADO", referenciaExterna: "aditivo-a-concluir", evidenciaHash: "a".repeat(64) }));
  const original = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: alvo.artefatoId }, include: { conferencia: true } });
  const pessoas = z.object({ participantes: z.array(z.object({ papel: z.literal("ALUNO"), identidade: IdentidadeSignatarioSchema })) }).parse(original.conferencia.snapshot).participantes;
  const agora = new Date().toISOString();
  const entradaConclusao = { processoId, referenciaExterna: "aditivo-a-concluir", originalHash: original.pdfHash, concluidaEm: agora,
    pdfAssinado: Buffer.from("%PDF-documento assinado simulado do aditivo"), evidencias: Buffer.from("Evidências simuladas do aditivo"),
    assinaturas: pessoas.map(p => ({ papel: p.papel, identidadeHash: hashPrevia(p.identidade), referenciaAssinatura: "assinatura-do-aditivo", assinadaEm: agora })) };
  const preservar = (d = entradaConclusao) => prisma.$transaction(tx => preservarConclusaoAssinaturaAditivoTx(tx, d), { timeout: 30000 });
  await expect(preservar({ ...entradaConclusao, assinaturas: [] })).rejects.toThrow();
  await expect(preservar({ ...entradaConclusao, originalHash: "0".repeat(64) })).rejects.toThrow();
  await expect(preservar({ ...entradaConclusao, assinaturas: [{ ...entradaConclusao.assinaturas[0], identidadeHash: "0".repeat(64) }] })).rejects.toThrow();
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId } });
  const alunoAntesConclusao = await prisma.aluno.findUniqueOrThrow({ where: { id: m.alunoId } });
  await prisma.aluno.update({ where: { id: m.alunoId }, data: { documento: "documento-alterado-apos-envio" } });
  const c = await preservar();
  expect(await preservar()).toEqual(c);
  await expect(preservar({ ...entradaConclusao, evidencias: Buffer.from("Outra evidência") })).rejects.toThrow();
  const gravada = await prisma.conclusaoAssinaturaAditivo.findUniqueOrThrow({ where: { id: c.id } });
  expect(gravada.pdfAssinado).toEqual(entradaConclusao.pdfAssinado);
  const assinaturasSql = JSON.parse(JSON.stringify(gravada.assinaturas));
  assinaturasSql[0].identidadeHash = "0".repeat(64);
  await expect(prisma.conclusaoAssinaturaAditivo.create({ data: { ...gravada, id: "conclusao-aditivo-identidade-falsa", assinaturas: assinaturasSql } })).rejects.toThrow("identidades");
  await expect(prisma.conclusaoAssinaturaAditivo.create({ data: { ...gravada, id: "conclusao-aditivo-pdf-falso", pdfHash: "0".repeat(64), assinaturas: JSON.parse(JSON.stringify(gravada.assinaturas)) } })).rejects.toThrow("Hashes");
  await expect(prisma.conclusaoAssinaturaAditivo.delete({ where: { id: c.id } })).rejects.toThrow();
  const abrir = (id = fixture.matriculaId, tipo = "pdf") => abrirConclusaoAditivo(new Request("http://localhost/assinatura-aditivo"), { params: Promise.resolve({ id, propostaId: alvo.propostaId, conclusaoId: c.id, tipo }) });
  const resposta = await abrir(); expect(resposta.status).toBe(200); expect(resposta.headers.get("Cache-Control")).toBe("private, no-store");
  expect(Buffer.from(await resposta.arrayBuffer())).toEqual(entradaConclusao.pdfAssinado);
  const evidencias = await abrir(fixture.matriculaId, "evidencias");
  expect(evidencias.status).toBe(200); expect(Buffer.from(await evidencias.arrayBuffer())).toEqual(entradaConclusao.evidencias);
  expect((await abrir("outra-matricula")).status).toBe(404);
  const vendedor = await criarUsuario(["VENDEDOR"]); authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect((await abrir()).status).toBe(403);
  authMock.mockResolvedValue(null); expect((await abrir()).status).toBe(401);
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  const alvoFinal = { matriculaId: fixture.matriculaId, propostaId: alvo.propostaId, conclusaoId: c.id };
  expect(await consultarConferenciaFinalAditivo(alvoFinal)).toMatchObject({ ok: true, dado: { revisao: null } });
  await prisma.aluno.update({ where: { id: m.alunoId }, data: { documento: alunoAntesConclusao.documento } });
  const revisaoFinal = await consultarConferenciaFinalAditivo(alvoFinal);
  if (!revisaoFinal.ok || !revisaoFinal.dado?.revisao) throw new Error("Revisão final indisponível");
  const confirmarFinal = { ...alvoFinal, revisaoHash: revisaoFinal.dado.revisao.hash, documentoConferido: true as const, evidenciasConferidas: true as const, motivo: "Documento e evidências finais conferidos" };
  expect(await registrarConferenciaFinalAditivo({ ...confirmarFinal, revisaoHash: "0".repeat(64) })).toMatchObject({ ok: false });
  const final = await registrarConferenciaFinalAditivo(confirmarFinal);
  expect(final).toMatchObject({ ok: true });
  expect(await registrarConferenciaFinalAditivo(confirmarFinal)).toEqual(final);
  expect(await registrarConferenciaFinalAditivo({ ...confirmarFinal, motivo: "Outra conferência sobre o mesmo documento" })).toMatchObject({ ok: false });
  expect(await prisma.conferenciaFinalAditivo.count()).toBe(1);
  if (!final.ok || !final.dado) throw new Error("Conferência não registrada");
  await expect(prisma.conferenciaFinalAditivo.delete({ where: { id: final.dado.id } })).rejects.toThrow();
  const pedidoCondicoes = { ...alvoFinal, revisaoHash: confirmarFinal.revisaoHash };
  expect(await registrarCondicoesFormalizadasAditivo({ ...pedidoCondicoes, revisaoHash: "0".repeat(64) })).toMatchObject({ ok: false });
  const cobrancasAntesFormalizacao = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  if (taxaSemConsumidor) {
    const campo = "TAXA_VALOR";
    expect(await formalizarEAplicarCondicoesAditivo({ ...pedidoCondicoes, chaveIdempotencia: "condicao-sem-consumidor-q117" })).toMatchObject({ ok: false, erro: `A condição ${campo} exige fluxo próprio antes da aplicação.` });
    expect(await prisma.versaoCondicoesAditivo.count()).toBe(0);
    expect(await prisma.aplicacaoCondicoesAditivo.count()).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: { in: ["CondicoesAditivoFormalizadas", "CondicoesAditivoAplicadas"] } } })).toBe(0);
    return;
  }
  const condicoes = ambiente === "SANDBOX" ? await registrarCondicoesFormalizadasAditivo(pedidoCondicoes) : await formalizarEAplicarCondicoesAditivo({ ...pedidoCondicoes, chaveIdempotencia: "formalizar-aplicar-q117" });
  if (ambiente === "SANDBOX") {
    expect(condicoes).toMatchObject({ ok: false });
    expect(await prisma.versaoCondicoesAditivo.count()).toBe(0);
  } else {
    expect(condicoes).toMatchObject({ ok: true, dado: { versao: 1 } });
    expect(await registrarCondicoesFormalizadasAditivo(pedidoCondicoes)).toMatchObject({ ok: true, dado: { versao: 1 } });
    expect(await consultarCondicoesAditivo({ matriculaId: fixture.matriculaId, em: "2025-09-01T00:00:00Z" })).toMatchObject({ ok: true, dado: null });
    expect(await consultarCondicoesAditivo({ matriculaId: fixture.matriculaId, em: "2026-10-01T03:00:00Z" })).toMatchObject({ ok: true, dado: { versao: 1 } });
    const v = await prisma.versaoCondicoesAditivo.findFirstOrThrow();
    expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancasAntesFormalizacao);
    const aplicacao = await formalizarEAplicarCondicoesAditivo({ ...pedidoCondicoes, chaveIdempotencia: "formalizar-aplicar-q117" });
    expect(aplicacao).toMatchObject({ ok: true, dado: { versao: 1 } });
    if (!aplicacao.ok || !aplicacao.dado) throw new Error(JSON.stringify(aplicacao));
    expect(await formalizarEAplicarCondicoesAditivo({ ...pedidoCondicoes, chaveIdempotencia: "formalizar-aplicar-q117" })).toEqual(aplicacao);
    expect(await aplicarCondicoesFormalizadasAditivo({ ...pedidoCondicoes, chaveIdempotencia: "aplicar-condicoes-divergente" })).toMatchObject({ ok: false });
    expect(await prisma.aplicacaoCondicoesAditivo.count()).toBe(1);
    expect(await consultarAplicacaoCondicoesAditivo({ matriculaId: fixture.matriculaId, propostaId: alvo.propostaId })).toMatchObject({ ok: true, dado: { propostaId: alvo.propostaId, versao: 1, aplicacao: { id: aplicacao.dado.id } } });
    expect(await consultarAplicacaoCondicoesAditivo({ matriculaId: "outra-matricula", propostaId: alvo.propostaId })).toMatchObject({ ok: true, dado: null });
    expect(await prisma.$transaction(tx => resolverHoraVigenteTx(tx, { matriculaId: fixture.matriculaId, inicio: new Date("2026-10-02T15:00:00Z"), fim: new Date("2026-10-02T16:00:00Z"), valorHoraOriginal: "125.00", moedaOriginal: "CRC" }))).toMatchObject({ valorHora: modo === "PRODUCAO_HORA" ? "200" : "125.00", versaoAditivo: { id: v.id } });
    expect(await prisma.$transaction(tx => resolverHoraVigenteTx(tx, { matriculaId: "outra-matricula", inicio: new Date("2026-10-02T15:00:00Z"), fim: new Date("2026-10-02T16:00:00Z"), valorHoraOriginal: "125.00", moedaOriginal: "CRC" }))).toMatchObject({ valorHora: "125.00", versaoAditivo: null });
    await expect(prisma.versaoCondicoesAditivo.delete({ where: { id: v.id } })).rejects.toThrow("imutável");
    if (modo === "PRODUCAO_HORA") {
      await verificarFechamentoHoraAditivo(v.id);
    } else if (modo.startsWith("PRODUCAO_MENSAL")) {
      await verificarPrecoContinuidadeMensal(v.id, modo === "PRODUCAO_MENSAL_EMISSAO" || modo === "PRODUCAO_MENSAL_Q162", modo === "PRODUCAO_MENSAL_Q162");
      expect(await prisma.$transaction(tx => resolverMensalVigenteTx(tx, {
        matriculaId: fixture.matriculaId,
        inicioCobertura: new Date("2026-11-01T00:00:00Z"),
        fimCobertura: new Date("2026-11-30T00:00:00Z"),
        valorOriginal: "999999.00",
        valorNegociadoOriginal: "999999.00",
        moedaOriginal: "CRC",
      }))).toMatchObject({ valorOriginal: "999999.00", valorNegociado: "500", moeda: "CRC", versaoAditivo: { id: v.id, versao: 1 } });
      expect(await prisma.$transaction(tx => resolverMensalVigenteTx(tx, {
        matriculaId: "outra-matricula",
        inicioCobertura: new Date("2026-11-01T00:00:00Z"),
        fimCobertura: new Date("2026-11-30T00:00:00Z"),
        valorOriginal: "999999.00",
        valorNegociadoOriginal: "999999.00",
        moedaOriginal: "CRC",
      }))).toMatchObject({ valorNegociado: "999999.00", versaoAditivo: null });
    } else {
    expect(await prisma.aluno.findUniqueOrThrow({ where: { id: m.alunoId } })).toEqual(alunoAntesConclusao);
    expect(await consultarAplicacaoCondicoesAditivo({ matriculaId: fixture.matriculaId, propostaId: alvo.propostaId })).toMatchObject({ ok: true, dado: { cadastroContratual: { matriculaId: fixture.matriculaId, versao: 1, campos: { ALUNO_NOME: "Nome atualizado no aditivo" } } } });
    const fonteAtual = await consultarAditivosContratuais({ matriculaId: fixture.matriculaId });
    const nomeFormalizado = z.object({ ALUNO_NOME: z.object({ texto: z.string() }) }).parse(v.condicoes).ALUNO_NOME.texto;
    expect(fonteAtual).toMatchObject({ ok: true, dado: { fonte: { campos: expect.arrayContaining([expect.objectContaining({ origem: "ALUNO_NOME", anterior: nomeFormalizado })]) } } });
    const proxima = await preparar({ chaveIdempotencia: "segundo-aditivo-formalizado", vigenciaInicio: "2026-11-01T03:00:00Z", alteracoes: [{ origem: "ALUNO_NOME", novo: "Nome da próxima versão", valorEstruturado: { tipo: "TEXT", texto: "Nome da próxima versão" } }] });
    const detalhe = await consultarPropostaAditivo({ matriculaId: fixture.matriculaId, propostaId: proxima.id });
    expect(detalhe).toMatchObject({ ok: true, dado: { alteracoes: [expect.objectContaining({ campo: "ALUNO_NOME", anterior: nomeFormalizado })] } });
    const segunda = await prisma.propostaAditivoContratual.findUniqueOrThrow({ where: { id: proxima.id } });
    expect(z.object({ base: z.object({ aditivosAnterioresIds: z.array(z.string()) }) }).parse(segunda.snapshot).base.aditivosAnterioresIds).toEqual([v.id]);
    expect(JSON.stringify(segunda.snapshot)).toContain(gravada.pdfHash);
    const semCadeia = JSON.parse(JSON.stringify(segunda.snapshot));
    semCadeia.base.aditivosAnterioresIds = [];
    await expect(prisma.propostaAditivoContratual.create({ data: { ...segunda, id: "segunda-proposta-cadeia-ausente", chaveIdempotencia: "cadeia-ausente-sql", snapshot: semCadeia } })).rejects.toThrow("Cadeia");
    await expect(decidir(proxima)).resolves.toHaveProperty("id");
    }
  }
  await prisma.aluno.update({ where: { id: m.alunoId }, data: { documento: "documento-alterado-apos-conferencia" } });
  expect(await consultarConferenciaFinalAditivo(alvoFinal)).toMatchObject({ ok: true, dado: { revisao: null, historico: { id: final.dado.id } } });
  expect(await consultarConferenciaFinalAditivo({ ...alvoFinal, matriculaId: "outra-matricula" })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: fixture.secretariaId }, data: { ativo: false } });
  expect(await consultarConferenciaFinalAditivo(alvoFinal)).toMatchObject({ ok: false });
  expect(await registrarConferenciaFinalAditivo(confirmarFinal)).toMatchObject({ ok: false });
  expect(await consultarCondicoesAditivo({ matriculaId: fixture.matriculaId, em: "2026-10-01T03:00:00Z" })).toMatchObject({ ok: false });
  expect(await registrarCondicoesFormalizadasAditivo(pedidoCondicoes)).toMatchObject({ ok: false });
  expect(await prisma.conclusaoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.conclusaoAssinaturaAditivo.count()).toBe(1);
  if (modo !== "PRODUCAO_HORA" && !modo.startsWith("PRODUCAO_MENSAL")) expect(await prisma.matricula.findUnique({ where: { id: m.id } })).toEqual(m);
});

it("confere original de aditivo com idempotência e histórico, sem enviar ou aplicar condições", async () => {
  const { confirmar, alvo, revisao } = await prepararRevisaoOriginal();
  const original = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: alvo.artefatoId } });
  const gravar = () => prisma.$transaction(tx => registrarConferenciaAssinaturaAditivoTx(tx, fixture.secretariaId, confirmar), { timeout: 30000 });
  const [a, b] = await Promise.all([gravar(), gravar()]); expect(a).toEqual(b);
  expect(await registrarConferenciaAssinaturaAditivo(confirmar)).toMatchObject({ ok: true, dado: a });
  expect(await registrarConferenciaAssinaturaAditivo({ ...confirmar, motivo: "Outra entrada com mesma chave" })).toMatchObject({ ok: false });
  const consulta = await consultarAssinaturaAditivo(alvo);
  expect(consulta).toMatchObject({ ok: true, dado: { revisao: { hash: revisao.hash }, historico: [{ id: a.id }], pendencia: null } });
  if (!consulta.ok || !consulta.dado) throw new Error("Histórico indisponível");
  expect(consulta.dado.historico[0]).not.toHaveProperty("snapshot");
  expect(consulta.dado.historico[0]).not.toHaveProperty("chaveIdempotencia");
  expect(await prisma.conferenciaAssinaturaAditivo.count()).toBe(1);
  expect(await prisma.artefatoAditivoContratual.findUnique({ where: { id: alvo.artefatoId } })).toEqual(original);
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.conclusaoAssinaturaContratual.count()).toBe(1);
  await expect(prisma.conferenciaAssinaturaAditivo.delete({ where: { id: a.id } })).rejects.toThrow("imutável");
});

it("conferência do original exige escopo e papel atuais e preserva histórico quando a base muda", async () => {
  const { confirmar, alvo, dados } = await prepararRevisaoOriginal();
  expect(await registrarConferenciaAssinaturaAditivo({ ...confirmar, revisaoHash: "0".repeat(64) })).toMatchObject({ ok: false });
  expect(await consultarAssinaturaAditivo({ ...alvo, matriculaId: "outra-matricula" })).toMatchObject({ ok: false });
  expect(await registrarConferenciaAssinaturaAditivo({ ...confirmar, propostaId: "outra-proposta" })).toMatchObject({ ok: false });
  const vendedor = await criarUsuario(["VENDEDOR"]); authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarAssinaturaAditivo(alvo)).toMatchObject({ ok: false });
  expect(await registrarConferenciaAssinaturaAditivo(confirmar)).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  expect(await registrarConferenciaAssinaturaAditivo(confirmar)).toMatchObject({ ok: true });
  await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, fixture.secretariaId, { ...dados, versaoEsperada: 1, chaveIdempotencia: "nova-conferencia-apos-original" }), { timeout: 30000 });
  expect(await consultarAssinaturaAditivo(alvo)).toMatchObject({ ok: true, dado: { revisao: null, pendencia: expect.stringContaining("mais recente"), historico: [{ revisaoHash: confirmar.revisaoHash }] } });
  expect(await registrarConferenciaAssinaturaAditivo({ ...confirmar, chaveIdempotencia: "nao-conferir-original-antigo" })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: fixture.secretariaId }, data: { ativo: false } });
  expect(await consultarAssinaturaAditivo(alvo)).toMatchObject({ ok: false });
  expect(await registrarConferenciaAssinaturaAditivo(confirmar)).toMatchObject({ ok: false });
});

it("banco rejeita conferência com participantes ou metadados diferentes do original revisado", async () => {
  const { confirmar, alvo } = await prepararRevisaoOriginal();
  const gravada = await registrarConferenciaAssinaturaAditivo(confirmar);
  if (!gravada.ok || !gravada.dado) throw new Error("Conferência não gravada");
  const registro = await prisma.conferenciaAssinaturaAditivo.findUniqueOrThrow({ where: { id: gravada.dado.id } });
  const snapshot = JSON.parse(JSON.stringify(registro.snapshot));
  for (const alteracao of [{ participantes: [] }, { modelo: { codigo: "inventado", versao: 99 } }, { versaoProposta: 99 }, { ambiente: "INVENTADO" }]) {
    await expect(prisma.conferenciaAssinaturaAditivo.create({ data: { ...registro, id: `conferencia-falsa-${Object.keys(alteracao)[0]}`, chaveIdempotencia: `falsa-${Object.keys(alteracao)[0]}`, snapshot: { ...snapshot, ...alteracao } } })).rejects.toThrow("Snapshot");
  }
  expect(await prisma.conferenciaAssinaturaAditivo.count({ where: { artefatoId: alvo.artefatoId } })).toBe(1);
});

it("preserva original de aditivo uma única vez, com PDF privado e sem efeitos de assinatura ou cobrança", async () => {
  const { proposta, conferencia, entradaOriginal } = await prepararOriginalAditivo();
  const cobrancas = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
  // Sessão é simulada nesta suite. A disputa real é entre transações no PostgreSQL;
  // validar a fronteira pública separadamente evita concorrência no carregador do mock.
  const { matriculaId, ...entradaTx } = entradaOriginal; expect(matriculaId).toBe(fixture.matriculaId);
  const gerarTx = () => prisma.$transaction(tx => preservarOriginalAditivoTx(tx, fixture.secretariaId, entradaTx), { timeout: 30000 });
  const [primeira, repetida] = await Promise.all([gerarTx(), gerarTx()]); expect(primeira).toEqual(repetida);
  const a = await preservarOriginalAditivo(entradaOriginal); expect(a).toMatchObject({ ok: true, dado: primeira });
  expect(await preservarOriginalAditivo(entradaOriginal)).toEqual(a); if (!a.ok || !a.dado) throw new Error("Original não gerado");
  const registro = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: a.dado.id } });
  expect(registro.pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(registro.conferenciaId).toBe(conferencia.id); expect(registro.gerador).toMatchObject({ versao: "aditivo-original-1" });
  expect(await prisma.artefatoAditivoContratual.count()).toBe(1);
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1); expect(await prisma.conclusaoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(cobrancas);
  const consultar = () => consultarOriginaisAditivo({ matriculaId: fixture.matriculaId, propostaId: proposta.id });
  expect(await consultar()).toMatchObject({ ok: true, dado: { preservada: true, registros: [{ id: registro.id }] } });
  const abrir = (matriculaId = fixture.matriculaId, propostaId = proposta.id) => abrirOriginalAditivo(new Request("http://localhost/original-aditivo"), { params: Promise.resolve({ id: matriculaId, propostaId, artefatoId: registro.id }) });
  const response = await abrir(); expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(registro.pdf);
  expect((await abrir("outra-matricula")).status).toBe(404); expect((await abrir(fixture.matriculaId, "outra-proposta")).status).toBe(404);
  const vendedor = await criarUsuario(["VENDEDOR"]); authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect((await abrir()).status).toBe(403); expect(await consultar()).toMatchObject({ ok: false });
  expect(await preservarOriginalAditivo(entradaOriginal)).toMatchObject({ ok: false });
  authMock.mockResolvedValue(null); expect((await abrir()).status).toBe(401);
  await expect(prisma.artefatoAditivoContratual.delete({ where: { id: registro.id } })).rejects.toThrow("imutável");
});

it("original de aditivo recusa conferência antiga, identidade alterada e proposta de outro escopo", async () => {
  const { dados, entradaOriginal } = await prepararOriginalAditivo();
  expect(await preservarOriginalAditivo({ ...entradaOriginal, matriculaId: "outra-matricula" })).toMatchObject({ ok: false });
  expect(await preservarOriginalAditivo({ ...entradaOriginal, conferenciaHash: "0".repeat(64) })).toMatchObject({ ok: false });
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId } });
  await prisma.aluno.update({ where: { id: m.alunoId }, data: { email: "mudou@example.test" } });
  expect(await preservarOriginalAditivo(entradaOriginal)).toMatchObject({ ok: false });
  await prisma.aluno.update({ where: { id: m.alunoId }, data: { email: dados.participantes[0].identidade.email } });
  await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, fixture.secretariaId, { ...dados, versaoEsperada: 1, chaveIdempotencia: "conferencia-mais-recente-original" }), { timeout: 20000 });
  expect(await preservarOriginalAditivo(entradaOriginal)).toMatchObject({ ok: false, erro: expect.stringContaining("mais recente") });
  expect(await prisma.artefatoAditivoContratual.count()).toBe(0);
});

it("original do aditivo exige evidências exatamente conferidas, e banco verifica hashes e imutabilidade", async () => {
  const { proposta, dados } = await prepararConferencia(); await decidir(proposta);
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  const doc = await prisma.documento.create({ data: { matriculaId: fixture.matriculaId, categoria: "OUTRO", nome: "Identificação para original", url: "/api/files/identidade-original.pdf" } });
  const conferencia = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, fixture.secretariaId, { ...dados,
    maioridade: { classificacao: "MAIOR", criterio: "Documento conferido para maioridade", evidenciaDocumentoId: doc.id } }), { timeout: 20000 });
  const entradaOriginal = { matriculaId: fixture.matriculaId, propostaId: proposta.id, conferenciaId: conferencia.id, conferenciaHash: conferencia.revisaoHash,
    motivo: "Preservação do texto e signatários conferidos", conteudoConferido: true as const };
  await prisma.documento.update({ where: { id: doc.id }, data: { url: "/api/files/arquivo-substituido.pdf" } });
  expect(await preservarOriginalAditivo(entradaOriginal)).toMatchObject({ ok: false });
  await prisma.documento.update({ where: { id: doc.id }, data: { url: doc.url } });
  const a = await preservarOriginalAditivo(entradaOriginal); if (!a.ok || !a.dado) throw new Error("Original não gerado");
  const registro = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: a.dado.id } });
  const clone = { ...registro, id: "original-aditivo-falso", gerador: JSON.parse(JSON.stringify(registro.gerador)) };
  await expect(prisma.artefatoAditivoContratual.create({ data: { ...clone, pdfHash: "0".repeat(64) } })).rejects.toThrow("PDF íntegro");
  await expect(prisma.artefatoAditivoContratual.create({ data: { ...clone, baseHash: "0".repeat(64) } })).rejects.toThrow("Hash de base");
  await expect(prisma.artefatoAditivoContratual.update({ where: { id: registro.id }, data: { motivo: "Tentativa de alteração do original" } })).rejects.toThrow("imutável");
  expect(await prisma.artefatoAditivoContratual.count()).toBe(1);
});

it("guards SQL impedem preservar ou conferir assinatura quando a evidência muda ou é arquivada", async () => {
  const { proposta, dados } = await prepararConferencia(); await decidir(proposta);
  const doc = await prisma.documento.create({ data: { matriculaId: fixture.matriculaId, categoria: "OUTRO", nome: "Evidência preservada", url: "/api/files/evidencia-preservada.pdf" } });
  const conferencia = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, fixture.secretariaId, { ...dados,
    maioridade: { classificacao: "MAIOR", criterio: "Evidência de maioridade conferida", evidenciaDocumentoId: doc.id } }), { timeout: 20000 });
  const entradaOriginal = { matriculaId: fixture.matriculaId, propostaId: proposta.id, conferenciaId: conferencia.id, conferenciaHash: conferencia.revisaoHash,
    motivo: "Preservar original com evidência conferida", conteudoConferido: true as const };
  const criado = await preservarOriginalAditivo(entradaOriginal); if (!criado.ok || !criado.dado) throw new Error("Original não gerado");
  const original = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: criado.dado.id } });

  const consulta = await consultarAssinaturaAditivo({ matriculaId: fixture.matriculaId, propostaId: proposta.id, artefatoId: original.id });
  if (!consulta.ok || !consulta.dado?.revisao) throw new Error("Revisão indisponível");
  const revisaoHash = consulta.dado.revisao.hash;
  const assinatura = await prisma.$transaction(tx => registrarConferenciaAssinaturaAditivoTx(tx, fixture.secretariaId, {
    matriculaId: fixture.matriculaId, propostaId: proposta.id, artefatoId: original.id, revisaoHash, dadosConferidos: true,
    motivo: "Conferência interna antes de alterar evidência", chaveIdempotencia: "assinatura-evidencia-base" }), { timeout: 30000 });
  const assinaturaBase = await prisma.conferenciaAssinaturaAditivo.findUniqueOrThrow({ where: { id: assinatura.id } });

  for (const [sufixo, data, erro] of [
    ["url", { url: "/api/files/evidencia-trocada.pdf" }, "diverge"],
    ["nome", { nome: "Evidência renomeada" }, "diverge"],
    ["categoria", { categoria: "COMPROVANTE" as const }, "diverge"],
    ["arquivada", { arquivado: true }, "não está mais disponível"],
  ] as const) {
    await prisma.documento.update({ where: { id: doc.id }, data });
    await expect(prisma.artefatoAditivoContratual.create({ data: { ...original, id: `original-evidencia-${sufixo}`, gerador: JSON.parse(JSON.stringify(original.gerador)) } })).rejects.toThrow(erro);
    await expect(prisma.conferenciaAssinaturaAditivo.create({ data: { ...assinaturaBase, id: `assinatura-evidencia-${sufixo}`, chaveIdempotencia: `assinatura-evidencia-${sufixo}`,
      snapshot: JSON.parse(JSON.stringify(assinaturaBase.snapshot)) } })).rejects.toThrow(erro);
    expect(await prisma.artefatoAditivoContratual.count()).toBe(1);
    expect(await prisma.conferenciaAssinaturaAditivo.count()).toBe(1);
    await prisma.documento.update({ where: { id: doc.id }, data: { nome: doc.nome, url: doc.url, categoria: doc.categoria, arquivado: false } });
  }
});
it("ações de signatários exigem Secretaria/Admin, matrícula exata e sessão vigente", async () => {
  const { proposta, dados } = await prepararConferencia(); await decidir(proposta);
  const consulta = { matriculaId: fixture.matriculaId, propostaId: proposta.id, maioridade: null };
  const gravar = { matriculaId: fixture.matriculaId, ...dados };
  authMock.mockResolvedValue(null);
  expect(await consultarFormularioParticipantesAditivo(consulta)).toMatchObject({ ok: false });
  expect(await conferirParticipantesAditivo(gravar)).toMatchObject({ ok: false });
  const vendedor = await criarUsuario(["VENDEDOR"]); authMock.mockResolvedValue({ user: { id: vendedor.id } });
  expect(await consultarFormularioParticipantesAditivo(consulta)).toMatchObject({ ok: false });
  expect(await consultarConferenciasParticipantesAditivo({ matriculaId: fixture.matriculaId, propostaId: proposta.id })).toMatchObject({ ok: false });
  expect(await conferirParticipantesAditivo(gravar)).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  expect(await consultarFormularioParticipantesAditivo({ ...consulta, matriculaId: "outra-matricula" })).toMatchObject({ ok: false, erro: expect.stringContaining("nesta matrícula") });
  expect(await conferirParticipantesAditivo({ ...gravar, matriculaId: "outra-matricula" })).toMatchObject({ ok: false });
  expect(await consultarConferenciasParticipantesAditivo({ matriculaId: "outra-matricula", propostaId: proposta.id })).toMatchObject({ ok: false });
  expect(await consultarFormularioParticipantesAditivo(consulta)).toMatchObject({ ok: true, dado: {
    propostaHash: proposta.propostaHash, versaoEsperada: 0,
    participantesSugeridos: [{ papel: "ALUNO", automatico: true, identidade: dados.participantes[0].identidade }],
  } });
  await prisma.usuario.update({ where: { id: fixture.secretariaId }, data: { papeis: ["VENDEDOR"] } });
  expect(await conferirParticipantesAditivo(gravar)).toMatchObject({ ok: false });
  expect(await prisma.conferenciaParticipantesAditivo.count()).toBe(0);
});

it("histórico público preserva versões e projeção, e formulário exige aprovação e base atual", async () => {
  const { proposta, dados } = await prepararConferencia();
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  const consulta = { matriculaId: fixture.matriculaId, propostaId: proposta.id, maioridade: null };
  expect(await consultarFormularioParticipantesAditivo(consulta)).toMatchObject({ ok: false, erro: expect.stringContaining("aprovação administrativa") });
  await decidir(proposta);
  const gravar = { matriculaId: fixture.matriculaId, ...dados };
  const c = await conferirParticipantesAditivo(gravar); expect(c).toMatchObject({ ok: true, dado: { versao: 1 } });
  expect(await conferirParticipantesAditivo(gravar)).toEqual(c);
  expect(await conferirParticipantesAditivo({ ...gravar, motivo: "Outra conferência usando chave antiga" })).toMatchObject({ ok: false });
  expect(await conferirParticipantesAditivo({ ...gravar, chaveIdempotencia: "nova-chave-versao-velha" })).toMatchObject({ ok: false, erro: expect.stringContaining("outra conferência") });
  expect(await conferirParticipantesAditivo({ ...gravar, versaoEsperada: 1, chaveIdempotencia: "conferencia-publica-versao-dois" })).toMatchObject({ ok: true, dado: { versao: 2 } });
  const h = await consultarConferenciasParticipantesAditivo({ matriculaId: fixture.matriculaId, propostaId: proposta.id });
  expect(h).toMatchObject({ ok: true, dado: { registros: [{ versao: 2, participantes: [{ identidade: dados.participantes[0].identidade }] }, { versao: 1 }], maisRegistros: false } });
  if (!h.ok || !h.dado) throw new Error("Histórico não retornou");
  for (const registro of h.dado.registros) {
    expect(registro).not.toHaveProperty("snapshot"); expect(registro).not.toHaveProperty("chaveIdempotencia");
    expect(registro).not.toHaveProperty("referenciaExterna"); expect(registro.revisaoHash).toMatch(/^[a-f0-9]{64}$/);
  }
  expect(await consultarConferenciasParticipantesAditivo({ matriculaId: fixture.matriculaId, propostaId: proposta.id, pagina: 2 })).toMatchObject({ ok: true, dado: { registros: [] } });
  await preparar({ chaveIdempotencia: "proposta-mais-recente-ui" });
  expect(await consultarFormularioParticipantesAditivo(consulta)).toMatchObject({ ok: false, erro: expect.stringContaining("mais recente") });
  expect(await consultarConferenciasParticipantesAditivo({ matriculaId: fixture.matriculaId, propostaId: proposta.id })).toMatchObject({ ok: true, dado: { registros: [{ versao: 2 }, { versao: 1 }] } });
});

it("evidências paginadas conservam seleção fora da página e recusam arquivamento posterior", async () => {
  const { proposta, dados } = await prepararConferencia(); await decidir(proposta);
  authMock.mockResolvedValue({ user: { id: fixture.secretariaId } });
  await prisma.documento.createMany({ data: Array.from({ length: 23 }, (_, i) => ({ id: `evidencia-publica-${String(i).padStart(2, "0")}`, matriculaId: fixture.matriculaId, categoria: "OUTRO" as const, nome: `Evidência ${i}`, url: `/api/files/evidencia-${i}.pdf` })) });
  const outroLead = await prisma.lead.create({ data: { nome: "Lead de outro documento de teste" } });
  await prisma.documento.createMany({ data: [
    { id: "evidencia-arquivada-ui", matriculaId: fixture.matriculaId, categoria: "OUTRO", nome: "Arquivada", url: "/api/files/arquivo.pdf", arquivado: true },
    { id: "evidencia-sem-url-ui", matriculaId: fixture.matriculaId, categoria: "OUTRO", nome: "Sem arquivo", url: "" },
    { id: "evidencia-outro-escopo-ui", leadId: outroLead.id, categoria: "OUTRO", nome: "Outro escopo", url: "/api/files/outro.pdf" },
  ] });
  const consulta = { matriculaId: fixture.matriculaId, propostaId: proposta.id, maioridade: "MAIOR" as const };
  const p1 = await consultarFormularioParticipantesAditivo(consulta), p2 = await consultarFormularioParticipantesAditivo({ ...consulta, paginaDocumentos: 2 });
  if (!p1.ok || !p1.dado || !p2.ok || !p2.dado) throw new Error("Consulta de documentos falhou");
  expect(p1.dado.documentos).toHaveLength(20); expect(p1.dado.temProxima).toBe(true);
  const ids = [...p1.dado.documentos, ...p2.dado.documentos].map(d => d.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).not.toContain("evidencia-arquivada-ui"); expect(ids).not.toContain("evidencia-sem-url-ui"); expect(ids).not.toContain("evidencia-outro-escopo-ui");
  expect(p1.dado.documentos[0]).not.toHaveProperty("url");
  const documento = p1.dado.documentos[0]; expect(p2.dado.documentos.some(d => d.id === documento.id)).toBe(false);
  const gravar = { matriculaId: fixture.matriculaId, ...dados, maioridade: { classificacao: "MAIOR" as const, criterio: "Documento e regra aplicável conferidos", evidenciaDocumentoId: documento.id } };
  expect(await conferirParticipantesAditivo(gravar)).toMatchObject({ ok: true });
  await prisma.documento.update({ where: { id: documento.id }, data: { arquivado: true } });
  expect(await conferirParticipantesAditivo({ ...gravar, versaoEsperada: 1, chaveIdempotencia: "evidencia-arquivada-apos-consulta" })).toMatchObject({ ok: false });
  expect(await consultarConferenciasParticipantesAditivo({ matriculaId: fixture.matriculaId, propostaId: proposta.id })).toMatchObject({ ok: true, dado: { registros: [{ maioridade: { criterio: gravar.maioridade.criterio, evidencia: { id: documento.id, nome: documento.nome } } }] } });
});
it("confere os signatários da proposta aprovada, sem herdar assinatura e com versão imutável", async () => {
  const { proposta, dados } = await prepararConferencia();
  const conferir = () => prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, fixture.secretariaId, dados), { timeout: 20000 });
  await expect(conferir()).rejects.toThrow("aprovação administrativa");
  await decidir(proposta);
  const [c, repetida] = await Promise.all([conferir(), conferir()]); expect(repetida).toEqual(c);
  const registro = await prisma.conferenciaParticipantesAditivo.findUniqueOrThrow({ where: { id: c.id } });
  expect(registro.snapshot).toMatchObject({ assinaturasHerdadas: [], participantes: [{ papel: "ALUNO", etapa: "CLIENTE", identidade: dados.participantes[0].identidade }] });
  expect(await prisma.conferenciaParticipantesAditivo.count()).toBe(1);
  expect(await prisma.conclusaoAssinaturaContratual.count()).toBe(1);
  expect(await prisma.processoAssinaturaContratual.count()).toBe(1);
  await expect(prisma.conferenciaParticipantesAditivo.delete({ where: { id: c.id } })).rejects.toThrow("imutável");
  const snapshot = JSON.parse(JSON.stringify(registro.snapshot)); snapshot.assinaturasHerdadas = ["assinatura-antiga"];
  await expect(prisma.conferenciaParticipantesAditivo.create({ data: { ...registro, id: "conferencia-invalida-heranca", versao: 2,
    chaveIdempotencia: "conferencia-heranca-direta", snapshot } })).rejects.toThrow("herdar assinaturas");
});

it("recusa identidade, versão e evidência incompatíveis na conferência de aditivo", async () => {
  const { proposta, dados } = await prepararConferencia(); await decidir(proposta);
  const conferir = (extra: Record<string, unknown>) => prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, fixture.secretariaId, { ...dados, ...extra }), { timeout: 20000 });
  await expect(conferir({ propostaHashEsperado: "0".repeat(64) })).rejects.toThrow("versão exata");
  await expect(conferir({ participantes: [{ ...dados.participantes[0], identidade: { ...dados.participantes[0].identidade, email: "outra@example.test" } }] })).rejects.toThrow("identificação revisada");
  await expect(conferir({ maioridade: { classificacao: "MAIOR", criterio: "Conferência de identidade documentada", evidenciaDocumentoId: "documento-ausente" } })).rejects.toThrow("documento disponível");
  await conferir({});
  await expect(conferir({ versaoEsperada: 0, chaveIdempotencia: "conferencia-outro-pedido" })).rejects.toThrow("outra conferência");
  const atualizada = await conferir({ versaoEsperada: 1, chaveIdempotencia: "conferencia-nova-versao" }); expect(atualizada.versao).toBe(2);
  await preparar({ alteracoes: entrada().alteracoes, chaveIdempotencia: "aditivo-proposta-superveniente" });
  await expect(conferir({ versaoEsperada: 2, chaveIdempotencia: "conferencia-proposta-superada" })).rejects.toThrow("mais recente");
});

it("modelo de menor exige representantes, ordena cliente antes da escola e confere documentos no banco", async () => {
  const originalModelo = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: modeloId } });
  const novoModelo = await prisma.$transaction(tx => prepararModeloTx(tx, fixture.secretariaId, {
    codigo: originalModelo.codigo, versaoEsperada: 1, chaveIdempotencia: "modelo-aditivo-menor", motivo: "Modelo para aluno representado",
    conteudo: { ...ConteudoModeloSchema.parse(originalModelo.conteudo), assinaturas: [
      { papel: "REPRESENTANTE_ESCOLA", condicao: "SEMPRE" }, { papel: "REPRESENTANTE_LEGAL", condicao: "ALUNO_MENOR" },
    ] },
  }));
  modeloId = novoModelo.id; modeloHash = (await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: modeloId } })).conteudoHash;
  expect(await decidirModeloContratual({ modeloId, conteudoHash: modeloHash, aprovada: true, motivo: "Conferência do modelo com representantes" })).toMatchObject({ ok: true });
  const { proposta } = await prepararConferencia(); await decidir(proposta);
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId } });
  await prisma.aluno.update({ where: { id: m.alunoId }, data: { email: null } });
  const doc = await prisma.documento.create({ data: { matriculaId: m.id, categoria: "OUTRO", nome: "Evidência de representação fictícia", url: "/api/files/evidencia-teste.pdf" } });
  const dados = { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, versaoEsperada: 0,
    maioridade: { classificacao: "MENOR", criterio: "Classificação e representação conferidas", evidenciaDocumentoId: doc.id },
    participantes: [
      { papel: "REPRESENTANTE_ESCOLA", identidade: { nome: "Representante escola", email: "escola@example.test", documento: "ESCOLA-1" }, representacao: { descricao: "Representação institucional conferida", evidenciaDocumentoId: doc.id } },
      { papel: "REPRESENTANTE_LEGAL", identidade: { nome: "Responsável legal", email: "legal@example.test", documento: "LEGAL-1" }, representacao: { descricao: "Representação legal conferida", evidenciaDocumentoId: doc.id } },
    ], identificacoesConferidas: true, motivo: "Representações conferidas para este aditivo", chaveIdempotencia: "conferencia-menor-aditivo" };
  const c = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, fixture.secretariaId, dados), { timeout: 20000 });
  const registro = await prisma.conferenciaParticipantesAditivo.findUniqueOrThrow({ where: { id: c.id } });
  expect(registro.snapshot).toMatchObject({ plano: { participantesExigidos: [
    { papel: "REPRESENTANTE_LEGAL", etapa: "CLIENTE" }, { papel: "REPRESENTANTE_ESCOLA", etapa: "ESCOLA" },
  ] } });
  await prisma.documento.update({ where: { id: doc.id }, data: { arquivado: true } });
  await expect(prisma.conferenciaParticipantesAditivo.create({ data: { ...registro, id: "conferencia-documento-arquivado", versao: 2,
    snapshot: JSON.parse(JSON.stringify(registro.snapshot)), chaveIdempotencia: "conferencia-documento-arquivado" } })).rejects.toThrow("Evidência indisponível");
});

it("confere nome contratual proposto sem mudar o aluno compartilhado", async () => {
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId }, include: { aluno: true } });
  const antes = m.aluno;
  const { proposta, dados } = await prepararConferencia(true);
  await decidir(proposta);
  const c = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, fixture.secretariaId, dados));
  expect(await prisma.aluno.findUnique({ where: { id: m.alunoId } })).toEqual(antes);
  expect(await prisma.conferenciaParticipantesAditivo.findUnique({ where: { id: c.id } })).toMatchObject({ snapshot: { participantes: [{ identidade: { nome: "Nome atualizado no aditivo" } }] } });
});
