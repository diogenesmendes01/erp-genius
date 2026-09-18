import { aplicarImpactosCoberturaAditivo, decidirImpactosCoberturaAditivo, obsoletarImpactosCoberturaAditivo, prepararImpactosCoberturaAditivo } from "./aditivo-cobertura";
import { carregarAplicacoesCamposTx } from "./aditivo-aplicacao-campos-tx";
import { projetarAplicacoesPorCampo } from "./aditivo-aplicacao-campos";
import { resolverMensalVigenteTx } from "./aditivo-mensal-vigente";
import { consultarEfeitosAditivo } from "./aditivo-efeitos-consulta";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TipoDestinacaoRecebimento } from "@prisma/client";
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
import { decidirAlcadaAditivo } from "./aditivo-alcadas";
import { conferirParticipantesAditivoTx } from "./aditivo-participantes-tx";
import { preservarOriginalAditivo } from "./aditivo-originais";
import { consultarAssinaturaAditivo, registrarConferenciaAssinaturaAditivo } from "./aditivo-assinatura";
import { prepararProcessoAssinaturaAditivo } from "./aditivo-envio";
import { iniciarTentativaAditivoTx, registrarResultadoEnvioAditivoTx } from "./aditivo-envio-tx";
import { preservarConclusaoAssinaturaAditivoTx } from "./aditivo-conclusao-tx";
import { consultarConferenciaFinalAditivo, registrarConferenciaFinalAditivo } from "./aditivo-conferencia-final";
import { registrarCondicoesFormalizadasAditivo } from "./aditivo-condicoes";
import { proporAcertoTaxaAditivo, decidirAcertoTaxaAditivo, aplicarAcertoTaxaAditivo, invalidarAcertoTaxaAditivo } from "./aditivo-acerto-taxa-acoes";
import { receberComDestinacoesTx, receberTx } from "@/server/financeiro/recebimentos";
import { proporUtilizacaoCredito } from "@/server/financeiro/uso-credito-proposta";
import { decidirUtilizacaoCredito } from "@/server/financeiro/uso-credito-decisao";
import { decidirDevolucaoCredito, proporDevolucaoCredito, registrarExecucaoDevolucaoCredito } from "@/server/financeiro/devolucao-credito";
import { hashSubstituicao } from "./substituicao-estado";
import { completarImpactosTaxaAditivo, consultarImpactosTaxaAditivo, decidirImpactosTaxaAditivo, obsoletarImpactosTaxaAditivo, prepararImpactosTaxaAditivo, vincularImpactoTaxaAditivo } from "./aditivo-taxa-impactos";

import { consultarImpactosCoberturaAditivo, consultarPreparoCoberturaAditivo } from "./aditivo-cobertura-consulta";

let base: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>, alvo: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string }, cobrancaId: string, financeiro: string, aprovador: string;
async function proximaMensalidade() {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId, tipo: "MENSALIDADE" }, orderBy: { vencimento: "asc" }, select: { valorOriginal: true, valorNegociado: true, moeda: true } });
  return { valorOriginal: cobranca.valorOriginal.toFixed(2), valorNegociado: cobranca.valorNegociado.toFixed(2), moeda: cobranca.moeda };
}
async function cadeiaTaxa(vencimentoTaxa?: string, cobertura = false) {
 base = await prepararFixtureSubstituicaoContratual(authMock, { camposFinanceiros: true, ambiente: "PRODUCAO", semSubstituicao: true });
 const fonte = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: base.processoId }, include: { artefato: { include: { conferencia: true } } } });
 const pessoas = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(fonte.artefato.conferencia.snapshot).participantes;
 const envioFonte = await prisma.tentativaEnvioAssinatura.findFirstOrThrow({ where: { processoId: fonte.id }, orderBy: { numero: "desc" } }), agora = envioFonte.iniciadaEm.toISOString();
 const conclusao = await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { processoId: fonte.id, referenciaExterna: base.referenciaExternaFonte, originalHash: fonte.artefato.pdfHash, concluidaEm: agora, pdfAssinado: Buffer.from("%PDF-assinado"), evidencias: Buffer.from("evidencia"), assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(pessoas[0].identidade), referenciaAssinatura: "fonte", assinadaEm: agora }] }));
 const modelo = await prisma.$transaction(tx => prepararModeloTx(tx, base.secretariaId, { codigo: "DCT03", versaoEsperada: 0, chaveIdempotencia: "dct03-modelo", motivo: "Modelo de acerto de taxa", conteudo: { titulo: "Aditivo", finalidade: "ADITIVO", regimes: ["MENSALIDADE"], aplicacao: "Teste DCT03", campos: [{ chave: "nome", descricao: "Aluno", origem: "ALUNO_NOME" }, { chave: "taxa", descricao: "Taxa", origem: "TAXA_VALOR" }, { chave: "vencimento", descricao: "Vencimento da taxa", origem: "TAXA_VENCIMENTO" }, ...(cobertura ? [{ chave: "inicio", descricao: "Início da cobertura", origem: "COBERTURA_INICIO" as const }, { chave: "fim", descricao: "Fim da cobertura", origem: "COBERTURA_FIM" as const }] : []), { chave: "original", descricao: "Original", origem: "ADITIVO_CONTRATO_ORIGINAL" }, { chave: "anteriores", descricao: "Anteriores", origem: "ADITIVO_ANTERIORES" }, { chave: "alteracoes", descricao: "Alterações", origem: "ADITIVO_ALTERACOES" }, { chave: "vigencia", descricao: "Vigência", origem: "ADITIVO_VIGENCIA" }], secoes: [{ titulo: "Dados", texto: "{{nome}} {{taxa}} {{vencimento}} {{original}} {{anteriores}} {{alteracoes}} {{vigencia}}" }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }] } }));
 const modeloGravado = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: modelo.id } }); authMock.mockResolvedValue({ user: { id: base.adminId } }); await decidirModeloContratual({ modeloId: modelo.id, conteudoHash: modeloGravado.conteudoHash, aprovada: true, motivo: "Modelo aprovado independentemente" }); authMock.mockResolvedValue({ user: { id: base.secretariaId } });
 const fonteAssinada = await prisma.conclusaoAssinaturaContratual.findUniqueOrThrow({ where: { id: conclusao.id } });
 const proposta = await prisma.$transaction(tx => prepararAditivoContratualTx(tx, base.secretariaId, { matriculaId: base.matriculaId, conclusaoOriginalId: conclusao.id, conclusaoHashEsperado: fonteAssinada.entradaHash, modeloId: modelo.id, modeloHashEsperado: modeloGravado.conteudoHash, vigenciaInicio: "2026-09-01T00:00:00-03:00", alteracoes: cobertura ? [{ origem: "COBERTURA_INICIO", novo: "2026-11-01", valorEstruturado: { tipo: "DATA", data: "2026-11-01" } }, { origem: "COBERTURA_FIM", novo: "2026-11-30", valorEstruturado: { tipo: "DATA", data: "2026-11-30" } }] : [{ origem: "TAXA_VALOR", novo: "80.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "80", moeda: "CRC" } }, ...(vencimentoTaxa ? [{ origem: "TAXA_VENCIMENTO" as const, novo: vencimentoTaxa, valorEstruturado: { tipo: "DATA" as const, data: vencimentoTaxa } }] : [])], ...(cobertura ? { cicloCoberturaFutura: { escolha: "PRESERVAR_REFERENCIA" as const } } : {}), motivo: cobertura ? "Corrigir cobertura formalizada para o acerto" : "Reduzir taxa paga para acerto", chaveIdempotencia: "dct03-proposta" }));
 await prisma.$transaction(tx => decidirAditivoContratualTx(tx, base.adminId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true, motivo: "Aditivo aprovado independentemente" }));
 authMock.mockResolvedValue({ user: { id: base.adminId } }); for (const alcada of ["FINANCEIRA", "COMERCIAL"] as const) await decidirAlcadaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, propostaHash: proposta.propostaHash, alcada, aprovada: true, motivo: "Alçada aprovada independentemente" });
 authMock.mockResolvedValue({ user: { id: base.secretariaId } }); const aluno = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId }, include: { aluno: true } }), identidade = { nome: `${aluno.aluno.primeiroNome} ${aluno.aluno.sobrenome}`, email: aluno.aluno.email!, documento: aluno.aluno.documento! };
 const participantes = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, base.secretariaId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, versaoEsperada: 0, maioridade: null, participantes: [{ papel: "ALUNO", identidade }], identificacoesConferidas: true, motivo: "Participantes conferidos para o aditivo", chaveIdempotencia: "dct03-participantes" }));
 const original = await preservarOriginalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conferenciaId: participantes.id, conferenciaHash: participantes.revisaoHash, conteudoConferido: true, motivo: "Original conferido para assinatura" }); if (!original.ok || !original.dado) throw new Error(JSON.stringify(original));
 const assinatura = await consultarAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id }); if (!assinatura.ok || !assinatura.dado?.revisao) throw new Error(JSON.stringify(assinatura));
 const conferencia = await registrarConferenciaAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id, revisaoHash: assinatura.dado.revisao.hash, dadosConferidos: true, motivo: "Assinatura conferida para o aditivo", chaveIdempotencia: "dct03-assinatura" }); if (!conferencia.ok || !conferencia.dado) throw new Error(JSON.stringify(conferencia));
 const processo = await prepararProcessoAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id, conferenciaId: conferencia.dado.id, fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" }); if (!processo.ok || !processo.dado) throw new Error(JSON.stringify(processo));
 const tentativa = await prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, base.secretariaId, { processoId: processo.dado!.id })); await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId: processo.dado!.id, tentativaId: tentativa.tentativaId, chave: "dct03-envio", resultado: "REGISTRADO", referenciaExterna: "dct03-assinado", evidenciaHash: "a".repeat(64) }));
 const artefato = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: original.dado.id }, include: { conferencia: true } }), ass = z.object({ participantes: z.array(z.object({ papel: z.literal("ALUNO"), identidade: IdentidadeSignatarioSchema })) }).parse(artefato.conferencia.snapshot).participantes;
 const envioAditivo = await prisma.tentativaEnvioAditivo.findFirstOrThrow({ where: { processoId: processo.dado!.id }, orderBy: { numero: "desc" } }), agoraFim = envioAditivo.iniciadaEm.toISOString(), fim = await prisma.$transaction(tx => preservarConclusaoAssinaturaAditivoTx(tx, { processoId: processo.dado!.id, referenciaExterna: "dct03-assinado", originalHash: artefato.pdfHash, concluidaEm: agoraFim, pdfAssinado: Buffer.from("%PDF-assinado-aditivo"), evidencias: Buffer.from("evidencia-aditivo"), assinaturas: ass.map(x => ({ papel: x.papel, identidadeHash: hashPrevia(x.identidade), referenciaAssinatura: "dct03", assinadaEm: agoraFim })) }));
 const revisao = await consultarConferenciaFinalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id }); if (!revisao.ok || !revisao.dado?.revisao) throw new Error(JSON.stringify(revisao)); const final = await registrarConferenciaFinalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash, documentoConferido: true, evidenciasConferidas: true, motivo: "Conclusão conferida para o acerto" }); if (!final.ok) throw new Error(JSON.stringify(final));
 const cond = await registrarCondicoesFormalizadasAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash }); if (!cond.ok) throw new Error(JSON.stringify(cond)); alvo = { matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash }; cobrancaId = (await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId, tipo: "MATRICULA" } })).id;
}
async function formalizarNovaVersaoTaxa(valor: string, vigenciaInicio = "2026-09-02T00:00:00-03:00") {
 const original = await prisma.conclusaoAssinaturaContratual.findFirstOrThrow({ where: { processo: { matriculaId: base.matriculaId } } });
 const anterior = await prisma.versaoCondicoesAditivo.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, include: { proposta: true } });
 const modelo = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: anterior.proposta.modeloId } });
 const proposta = await prisma.$transaction(tx => prepararAditivoContratualTx(tx, base.secretariaId, { matriculaId: base.matriculaId, conclusaoOriginalId: original.id, conclusaoHashEsperado: original.entradaHash, modeloId: anterior.proposta.modeloId, modeloHashEsperado: modelo.conteudoHash, vigenciaInicio, alteracoes: [{ origem: "TAXA_VALOR", novo: `${Number(valor).toFixed(2)} CRC`, valorEstruturado: { tipo: "DINHEIRO", valor, moeda: "CRC" } }], motivo: "Nova taxa formalizada após acerto aprovado", chaveIdempotencia: `dct03-taxa-${valor}-aditivo` }));
 await prisma.$transaction(tx => decidirAditivoContratualTx(tx, base.adminId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true, motivo: "Segundo aditivo aprovado" }));
 authMock.mockResolvedValue({ user: { id: base.adminId } });
 for (const alcada of ["FINANCEIRA", "COMERCIAL"] as const) await decidirAlcadaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, propostaHash: proposta.propostaHash, alcada, aprovada: true, motivo: "Alçada do segundo aditivo aprovada" });
 authMock.mockResolvedValue({ user: { id: base.secretariaId } });
 const aluno = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId }, include: { aluno: true } });
 const participantes = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, base.secretariaId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, versaoEsperada: 0, maioridade: null, participantes: [{ papel: "ALUNO", identidade: { nome: `${aluno.aluno.primeiroNome} ${aluno.aluno.sobrenome}`, email: aluno.aluno.email!, documento: aluno.aluno.documento! } }], identificacoesConferidas: true, motivo: "Participantes da nova taxa conferidos", chaveIdempotencia: `dct03-taxa-${valor}-participantes` }));
 const artefato = await preservarOriginalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conferenciaId: participantes.id, conferenciaHash: participantes.revisaoHash, conteudoConferido: true, motivo: "Original do segundo aditivo conferido" });
 if (!artefato.ok || !artefato.dado) throw new Error(JSON.stringify(artefato));
 const revisaoAssinatura = await consultarAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: artefato.dado.id });
 if (!revisaoAssinatura.ok || !revisaoAssinatura.dado?.revisao) throw new Error(JSON.stringify(revisaoAssinatura));
 const conferencia = await registrarConferenciaAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: artefato.dado.id, revisaoHash: revisaoAssinatura.dado.revisao.hash, dadosConferidos: true, motivo: "Assinatura da nova taxa conferida", chaveIdempotencia: `dct03-taxa-${valor}-assinatura` });
 if (!conferencia.ok || !conferencia.dado) throw new Error(JSON.stringify(conferencia));
 const processo = await prepararProcessoAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: artefato.dado.id, conferenciaId: conferencia.dado.id, fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" });
 if (!processo.ok || !processo.dado) throw new Error(JSON.stringify(processo));
 const tentativa = await prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, base.secretariaId, { processoId: processo.dado!.id }));
 await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId: processo.dado!.id, tentativaId: tentativa.tentativaId, chave: `dct03-taxa-${valor}-envio`, resultado: "REGISTRADO", referenciaExterna: `dct03-taxa-${valor}-assinado`, evidenciaHash: "b".repeat(64) }));
 const assinado = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: artefato.dado.id }, include: { conferencia: true } });
 const assinaturas = z.object({ participantes: z.array(z.object({ papel: z.literal("ALUNO"), identidade: IdentidadeSignatarioSchema })) }).parse(assinado.conferencia.snapshot).participantes;
 const envioAditivo = await prisma.tentativaEnvioAditivo.findFirstOrThrow({ where: { processoId: processo.dado!.id }, orderBy: { numero: "desc" } }), agora = envioAditivo.iniciadaEm.toISOString();
 const fim = await prisma.$transaction(tx => preservarConclusaoAssinaturaAditivoTx(tx, { processoId: processo.dado!.id, referenciaExterna: `dct03-taxa-${valor}-assinado`, originalHash: assinado.pdfHash, concluidaEm: agora, pdfAssinado: Buffer.from("%PDF-nova-taxa"), evidencias: Buffer.from("evidencia-nova-taxa"), assinaturas: assinaturas.map(x => ({ papel: x.papel, identidadeHash: hashPrevia(x.identidade), referenciaAssinatura: `dct03-taxa-${valor}`, assinadaEm: agora })) }));
 const revisao = await consultarConferenciaFinalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id });
 if (!revisao.ok || !revisao.dado?.revisao) throw new Error(JSON.stringify(revisao));
 const final = await registrarConferenciaFinalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash, documentoConferido: true, evidenciasConferidas: true, motivo: "Segundo aditivo final conferido" });
 if (!final.ok) throw new Error(JSON.stringify(final));
 const cond = await registrarCondicoesFormalizadasAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash });
 if (!cond.ok) throw new Error(JSON.stringify(cond));
 return { propostaId: proposta.id, conclusaoId: fim.id, versaoCondicoesId: cond.dado!.id, revisaoHash: revisao.dado.revisao.hash };
}
async function prepararFinanceiro(liquidacao: "DINHEIRO" | "CREDITO" | "MISTO" | "SEM_PAGAMENTO" = "DINHEIRO") {
 financeiro = (await criarUsuario(["FINANCEIRO"])).id;
 aprovador = (await criarUsuario(["FINANCEIRO"])).id;
 await prisma.usuario.update({ where: { id: aprovador }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
 await prisma.cobranca.update({ where: { id: cobrancaId }, data: { valorOriginal: 100, valorNegociado: 100, saldo: 100 } });
 const dinheiro = liquidacao === "DINHEIRO" ? 100 : liquidacao === "MISTO" ? 50 : 0;
 const credito = liquidacao === "CREDITO" ? 100 : liquidacao === "MISTO" ? 50 : 0;
 if (dinheiro) await prisma.$transaction(tx => receberTx(tx, { cobrancaId, chaveIdempotencia: `dct03-pagamento-${liquidacao}`, autorId: financeiro, valorRecebido: dinheiro, forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-01"), evidencia: "Comprovante DCT03 de quitação da taxa" }));
 if (credito) {
  await prisma.$transaction(tx => receberComDestinacoesTx(tx, { titularMatriculaId: base.matriculaId, chaveIdempotencia: `dct03-credito-${liquidacao}`, autorId: financeiro, valorRecebido: credito, forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-01"), moeda: "CRC", destinos: [{ tipo: TipoDestinacaoRecebimento.CREDITO_SEM_DESTINO, valor: credito, evidencia: "Comprovante DCT03 convertido em crédito", chaveIdempotencia: `dct03-credito-destino-${liquidacao}` }] }));
  const creditoCriado = await prisma.creditoMatricula.findFirstOrThrow({ where: { matriculaId: base.matriculaId, origemDestinacaoRecebimentoId: { not: null } } });
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const proposta = await proporUtilizacaoCredito({ creditoId: creditoCriado.id, cobrancaId, valor: credito.toFixed(2), concordancia: "Aluno autorizou liquidar a taxa DCT03 com crédito", motivo: "Liquidar taxa paga por crédito antes do aditivo", chaveIdempotencia: `dct03-uso-credito-${liquidacao}` });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  const decisao = await decidirUtilizacaoCredito({ propostaId: proposta.dado.id, aprovar: true, motivo: "Utilização de crédito DCT03 conferida independentemente" });
  if (!decisao.ok) throw new Error(JSON.stringify(decisao));
 }
 authMock.mockResolvedValue({ user: { id: financeiro } });
}
beforeEach(async () => { await truncarBanco(); await cadeiaTaxa(); await prepararFinanceiro(); });
async function propor(chave = "dct03-propor", motivo = "Taxa paga maior que o aditivo assinado", evidencia = { recibo: "DCT03" }, cobrancaAlvo = cobrancaId) { authMock.mockResolvedValue({ user: { id: financeiro } }); const { propostaId: propostaAditivoId, ...final } = alvo; return proporAcertoTaxaAditivo({ ...final, propostaAditivoId, cobrancaId: cobrancaAlvo, motivo, evidencia, chaveIdempotencia: chave }); }
describe.sequential("DCT03", () => {
it("DCT03 credita a diferença, exige outro financeiro e faz replay sem duplicar", async () => { authMock.mockResolvedValue({ user: { id: financeiro } }); const { propostaId: propostaAditivoId, ...final } = alvo, entrada = { ...final, propostaAditivoId, cobrancaId, motivo: "Taxa paga maior que o aditivo assinado", evidencia: { recibo: "DCT03" }, chaveIdempotencia: "dct03-propor" }; const proposta = await proporAcertoTaxaAditivo(entrada); if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta)); expect(await proporAcertoTaxaAditivo(entrada)).toEqual(proposta); expect(await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Autoaprovação indevida", chaveIdempotencia: "dct03-auto" })).toMatchObject({ ok: false }); authMock.mockResolvedValue({ user: { id: aprovador } }); const decisao = await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Crédito conferido independentemente", chaveIdempotencia: "dct03-decidir" }); expect(await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Crédito conferido independentemente", chaveIdempotencia: "dct03-decidir" })).toEqual(decisao); const aplicada = await aplicarAcertoTaxaAditivo({ propostaId: proposta.dado.id, chaveIdempotencia: "dct03-aplicar" }); expect(await aplicarAcertoTaxaAditivo({ propostaId: proposta.dado.id, chaveIdempotencia: "dct03-aplicar" })).toEqual(aplicada); expect((await prisma.origemCreditoAcertoTaxaAditivo.findFirstOrThrow()).valor.toFixed(2)).toBe("20.00"); expect(await prisma.creditoMatricula.count()).toBe(1); expect(await prisma.evento.count({ where: { tipo: { in: ["AcertoTaxaAditivoProposto", "AcertoTaxaAditivoAprovado", "AcertoTaxaAditivoAplicado"] } } })).toBe(3); });
it.each([
 ["crédito Q68", "CREDITO", "0.00", "100.00"],
 ["50 em dinheiro e 50 em crédito Q68", "MISTO", "50.00", "50.00"],
] as const)("DCT03 devolve 20 após taxa liquidada com %s, sem recebimento fictício e sem tocar outra matrícula", async (_descricao, liquidacao, recebidoEsperado, creditoEsperado) => {
  // Este caso precisa substituir a quitação em dinheiro padrão do beforeEach.
  await truncarBanco();
  await cadeiaTaxa();
  await prepararFinanceiro(liquidacao);
  const principal = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId }, select: { alunoId: true, produtoId: true, paisId: true, moeda: true } });
  const outra = await prisma.matricula.create({ data: { alunoId: principal.alunoId, produtoId: principal.produtoId, paisId: principal.paisId, moeda: principal.moeda, status: "ATIVA" } });
  const outraCobranca = await prisma.cobranca.create({ data: { matriculaId: outra.id, tipo: "MENSALIDADE", valorOriginal: 73, valorNegociado: 73, saldo: 73, moeda: principal.moeda, vencimento: new Date("2026-10-05") } });
  const outraAntes = await prisma.cobranca.findUniqueOrThrow({ where: { id: outraCobranca.id } });
  const recebimentosAntes = await prisma.recebimento.count();
  const proposta = await propor("dct03-propor-credito", "Taxa liquidada antes da redução contratual", { recibo: "DCT03-Q68" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Acerto com crédito conferido independentemente", chaveIdempotencia: "dct03-decidir-credito" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: proposta.dado.id, chaveIdempotencia: "dct03-aplicar-credito" })).toMatchObject({ ok: true });
  const taxa = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  expect(taxa.valorRecebido?.toFixed(2) ?? "0.00").toBe(recebidoEsperado);
  expect(taxa.valorLiquidadoCredito.toFixed(2)).toBe(creditoEsperado);
  expect((await prisma.origemCreditoAcertoTaxaAditivo.findFirstOrThrow()).valor.toFixed(2)).toBe("20.00");
  expect(await prisma.creditoMatricula.count({ where: { origemAcertoTaxaAditivoId: { not: null } } })).toBe(1);
  expect(await prisma.recebimento.count()).toBe(recebimentosAntes);
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: outraCobranca.id } })).toEqual(outraAntes);
});
it.each([
  ["2099-09-02", "PENDENTE"],
  ["2000-09-01", "ATRASADO"],
] as const)("DCT03 mantém taxa não liquidada como %s quando o novo vencimento é %s", async (vencimento, status) => {
  await truncarBanco();
  await cadeiaTaxa(vencimento);
  await prepararFinanceiro("SEM_PAGAMENTO");
  const proposta = await propor(`dct03-vencimento-${vencimento}`, "Taxa não liquidada com vencimento contratual alterado", { recibo: "DCT03-vencimento" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Vencimento da taxa não liquidada conferido", chaveIdempotencia: `dct03-decidir-vencimento-${vencimento}` })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: proposta.dado.id, chaveIdempotencia: `dct03-aplicar-vencimento-${vencimento}` })).toMatchObject({ ok: true });
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toMatchObject({ valorNegociado: expect.anything(), saldo: expect.anything(), status });
  const taxa = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  expect(taxa.valorNegociado.toFixed(2)).toBe("80.00");
  expect(taxa.saldo?.toFixed(2)).toBe("80.00");
  expect(taxa.vencimento.toISOString()).toBe(`${vencimento}T00:00:00.000Z`);
});
it("recusa replay da proposta com outro motivo ou evidência", async () => { const p = await propor("dct03-chave"); expect(p.ok).toBe(true); const antes = await prisma.propostaAcertoTaxaAditivo.count(); expect(await propor("dct03-chave", "Outro motivo válido para o acerto", { recibo: "OUTRO" })).toMatchObject({ ok: false }); expect(await prisma.propostaAcertoTaxaAditivo.count()).toBe(antes); expect(await prisma.evento.count({ where: { tipo: "AcertoTaxaAditivoProposto" } })).toBe(1); });
it("SQL recusa marcar proposta pendente como obsoleta sem invalidação", async () => {
  const proposta = await propor("dct03-obsoleta-sem-decisao"); if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  await expect(prisma.propostaAcertoTaxaAditivo.update({ where: { id: proposta.dado.id }, data: { status: "OBSOLETA" } })).rejects.toThrow();
  expect(await prisma.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: proposta.dado.id } })).toMatchObject({ status: "PENDENTE" });
});
it("revogar aprovação impede decidir e aplicar sem criar fatos", async () => { const p = await propor("dct03-revogacao"); if (!p.ok || !p.dado) throw new Error(JSON.stringify(p)); await prisma.usuario.update({ where: { id: aprovador }, data: { permissoes: [] } }); authMock.mockResolvedValue({ user: { id: aprovador } }); expect(await decidirAcertoTaxaAditivo({ propostaId: p.dado.id, aprovada: true, motivo: "Aprovação que foi revogada", chaveIdempotencia: "dct03-revogada" })).toMatchObject({ ok: false }); expect(await aplicarAcertoTaxaAditivo({ propostaId: p.dado.id, chaveIdempotencia: "dct03-aplicar-revogado" })).toMatchObject({ ok: false }); expect(await prisma.decisaoAcertoTaxaAditivo.count()).toBe(0); expect(await prisma.aplicacaoAcertoTaxaAditivo.count()).toBe(0); });
it("recalcula somente comissão percentual pendente e preserva fixa e paga", async () => { const vendedor = await criarUsuario(["VENDEDOR"]); const percentual = await prisma.comissao.create({ data: { matriculaId: base.matriculaId, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, valorBase: 100, moeda: "CRC", status: "PENDENTE" } }); const fixa = await prisma.comissao.create({ data: { matriculaId: base.matriculaId, vendedorId: vendedor.id, tipo: "VALOR_FIXO", percentual: 0, valor: 17, valorFixo: 17, valorBase: 100, moeda: "CRC", status: "PENDENTE" } }); const paga = await prisma.comissao.create({ data: { matriculaId: base.matriculaId, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, valorBase: 100, moeda: "CRC", status: "PAGA", pagaEm: new Date("2026-09-02") } }); const p = await propor("dct03-comissao"); if (!p.ok || !p.dado) throw new Error(JSON.stringify(p)); authMock.mockResolvedValue({ user: { id: aprovador } }); expect(await decidirAcertoTaxaAditivo({ propostaId: p.dado.id, aprovada: true, motivo: "Comissões conferidas independentemente", chaveIdempotencia: "dct03-comissao-decisao" })).toMatchObject({ ok: true }); const primeira = await aplicarAcertoTaxaAditivo({ propostaId: p.dado.id, chaveIdempotencia: "dct03-comissao-aplicar" }); expect(await aplicarAcertoTaxaAditivo({ propostaId: p.dado.id, chaveIdempotencia: "dct03-comissao-aplicar" })).toEqual(primeira); expect((await prisma.comissao.findUniqueOrThrow({ where: { id: percentual.id } })).valor.toFixed(2)).toBe("8.00"); expect((await prisma.comissao.findUniqueOrThrow({ where: { id: percentual.id } })).valorBase!.toFixed(2)).toBe("80.00"); expect((await prisma.comissao.findUniqueOrThrow({ where: { id: fixa.id } })).valor.toFixed(2)).toBe("17.00"); expect((await prisma.comissao.findUniqueOrThrow({ where: { id: paga.id } })).valor.toFixed(2)).toBe("10.00"); expect(await prisma.evento.count({ where: { tipo: "ComissaoRecalculada", agregadoId: percentual.id } })).toBe(1); });
it("DCT03 arredonda comissão fracionária e registra no evento o valor persistido", async () => {
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const comissao = await prisma.comissao.create({ data: { matriculaId: base.matriculaId, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: "12.34", valor: "12.34", valorBase: 100, moeda: "CRC", status: "PENDENTE" } });
  const proposta = await propor("dct03-comissao-fracionaria");
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Comissão fracionária conferida independentemente", chaveIdempotencia: "dct03-comissao-fracionaria-decisao" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: proposta.dado.id, chaveIdempotencia: "dct03-comissao-fracionaria-aplicar" })).toMatchObject({ ok: true });
  const persistida = await prisma.comissao.findUniqueOrThrow({ where: { id: comissao.id } });
  expect(persistida.valor.toFixed(2)).toBe("9.87");
  const evento = await prisma.evento.findFirstOrThrow({ where: { tipo: "ComissaoRecalculada", agregadoId: comissao.id } });
  expect(evento.payload).toMatchObject({ para: Number(persistida.valor.toFixed(2)) });
});
it("recusa decisão se a comissão fotografada mudou", async () => { const vendedor = await criarUsuario(["VENDEDOR"]), comissao = await prisma.comissao.create({ data: { matriculaId: base.matriculaId, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, valorBase: 100, moeda: "CRC", status: "PENDENTE" } }); const p = await propor("dct03-comissao-obsoleta"); if (!p.ok || !p.dado) throw new Error(JSON.stringify(p)); await prisma.comissao.update({ where: { id: comissao.id }, data: { status: "APROVADA" } }); authMock.mockResolvedValue({ user: { id: aprovador } }); expect(await decidirAcertoTaxaAditivo({ propostaId: p.dado.id, aprovada: true, motivo: "Não deve decidir fotografia antiga", chaveIdempotencia: "dct03-comissao-obsoleta-decisao" })).toMatchObject({ ok: false }); expect(await prisma.decisaoAcertoTaxaAditivo.count()).toBe(0); expect(await prisma.aplicacaoAcertoTaxaAditivo.count()).toBe(0); expect(await prisma.creditoMatricula.count()).toBe(0); expect(await prisma.evento.count({ where: { tipo: "AcertoTaxaAditivoAprovado" } })).toBe(0); });
it("rejeita proposta DCT03 obsoleta sem alterar o financeiro e permite preparar fotografia nova", async () => {
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const comissao = await prisma.comissao.create({ data: { matriculaId: base.matriculaId, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, valorBase: 100, moeda: "CRC", status: "PENDENTE" } });
  const original = await propor("dct03-rejeitar-obsoleta");
  if (!original.ok || !original.dado) throw new Error(JSON.stringify(original));
  const cobrancaAntes = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  await prisma.comissao.update({ where: { id: comissao.id }, data: { status: "APROVADA" } });
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: original.dado.id, aprovada: true, motivo: "Fotografia antiga não pode ser aprovada", chaveIdempotencia: "dct03-aprovar-obsoleta" })).toMatchObject({ ok: false });
  expect(await decidirAcertoTaxaAditivo({ propostaId: original.dado.id, aprovada: false, motivo: "Fotografia obsoleta rejeitada pelo Financeiro", chaveIdempotencia: "dct03-rejeitar-obsoleta" })).toMatchObject({ ok: true, dado: { aprovada: false } });
  expect(await prisma.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: original.dado.id } })).toMatchObject({ status: "REJEITADA" });
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toEqual(cobrancaAntes);
  expect(await prisma.aplicacaoAcertoTaxaAditivo.count()).toBe(0);
  expect(await prisma.creditoMatricula.count()).toBe(0);
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const atual = await propor("dct03-repropor-obsoleta", "Fotografia atual preparada após rejeição", { recibo: "DCT03-atual" });
  if (!atual.ok || !atual.dado) throw new Error(JSON.stringify(atual));
  expect(atual.dado.id).not.toBe(original.dado.id);
  expect(await prisma.propostaAcertoTaxaAditivo.count({ where: { status: "PENDENTE" } })).toBe(1);
});
it("invalida acerto aprovado obsoleto, preserva financeiro e permite repropor", async () => {
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const comissao = await prisma.comissao.create({ data: { matriculaId: base.matriculaId, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, valorBase: 100, moeda: "CRC", status: "PENDENTE" } });
  const proposta = await propor("dct03-invalidar-aprovada"); if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Acerto conferido antes da mudança", chaveIdempotencia: "dct03-invalidar-decisao" })).toMatchObject({ ok: true });
  const cobrancaAntes = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  await prisma.comissao.update({ where: { id: comissao.id }, data: { status: "APROVADA" } });
  expect(await invalidarAcertoTaxaAditivo({ propostaId: proposta.dado.id, motivo: "Comissão mudou depois da aprovação", evidencia: { conferencia: "Comissão atualizada" }, chaveIdempotencia: "dct03-invalidar" })).toMatchObject({ ok: true, dado: { invalidada: true } });
  expect(await prisma.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: proposta.dado.id } })).toMatchObject({ status: "OBSOLETA" });
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toEqual(cobrancaAntes);
  expect(await prisma.creditoMatricula.count()).toBe(0); expect(await prisma.aplicacaoAcertoTaxaAditivo.count()).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "AcertoTaxaAditivoInvalidado" } })).toBe(1);
  authMock.mockResolvedValue({ user: { id: financeiro } });
  expect(await propor("dct03-repropor-aprovada", "Nova fotografia após invalidação", { recibo: "DCT03-nova" })).toMatchObject({ ok: true });
});
it("invalida acerto aprovado após outra versão assinada e aplica a reproposta vigente", async () => {
  const proposta = await propor("dct03-versao-posterior");
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Acerto aprovado antes do novo aditivo", chaveIdempotencia: "dct03-versao-posterior-decisao" })).toMatchObject({ ok: true });
  const cobrancaAntes = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  const decisaoAntes = await prisma.decisaoAcertoTaxaAditivo.findUniqueOrThrow({ where: { propostaId: proposta.dado.id } });
  const posterior = await formalizarNovaVersaoTaxa("70");
  authMock.mockResolvedValue({ user: { id: aprovador } });
  const invalidada = await invalidarAcertoTaxaAditivo({ propostaId: proposta.dado.id, motivo: "Outro aditivo assinou nova taxa para a matrícula", evidencia: { conferencia: "versão posterior" }, chaveIdempotencia: "dct03-versao-posterior-invalidar" });
  if (!invalidada.ok) throw new Error(invalidada.erro);
  const invalidacao = await prisma.invalidacaoAcertoTaxaAditivo.findUniqueOrThrow({ where: { propostaId: proposta.dado.id } });
  expect(invalidacao.fotografiaAtual).toMatchObject({ versaoCondicoesId: posterior.versaoCondicoesId, revisaoHash: posterior.revisaoHash });
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toEqual(cobrancaAntes);
  expect(await prisma.decisaoAcertoTaxaAditivo.findUniqueOrThrow({ where: { propostaId: proposta.dado.id } })).toEqual(decisaoAntes);
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const nova = await proporAcertoTaxaAditivo({ matriculaId: base.matriculaId, propostaAditivoId: posterior.propostaId, conclusaoId: posterior.conclusaoId, revisaoHash: posterior.revisaoHash, cobrancaId, motivo: "Acerto da última taxa formalizada", evidencia: { recibo: "DCT03-70" }, chaveIdempotencia: "dct03-versao-posterior-repropor" });
  if (!nova.ok || !nova.dado) throw new Error(JSON.stringify(nova));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: nova.dado.id, aprovada: true, motivo: "Reproposta da última versão conferida", chaveIdempotencia: "dct03-versao-posterior-redecidir" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: nova.dado.id, chaveIdempotencia: "dct03-versao-posterior-aplicar" })).toMatchObject({ ok: true });
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).valorNegociado.toFixed(2)).toBe("70.00");
});
it("gera somente créditos incrementais nas reduções assinadas 100 para 80 e depois 70", async () => {
  const primeira = await propor("dct03-reducoes-80");
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: primeira.dado.id, aprovada: true, motivo: "Redução inicial conferida", chaveIdempotencia: "dct03-reducoes-80-decisao" })).toMatchObject({ ok: true });
  const aplicada80 = await aplicarAcertoTaxaAditivo({ propostaId: primeira.dado.id, chaveIdempotencia: "dct03-reducoes-80-aplicar" });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: primeira.dado.id, chaveIdempotencia: "dct03-reducoes-80-aplicar" })).toEqual(aplicada80);
  expect((await prisma.origemCreditoAcertoTaxaAditivo.findMany()).map(x => x.valor.toFixed(2))).toEqual(["20.00"]);
  const posterior = await formalizarNovaVersaoTaxa("70");
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const segunda = await proporAcertoTaxaAditivo({ matriculaId: base.matriculaId, propostaAditivoId: posterior.propostaId, conclusaoId: posterior.conclusaoId, revisaoHash: posterior.revisaoHash, cobrancaId, motivo: "Segunda redução formalizada", evidencia: { recibo: "DCT03-70" }, chaveIdempotencia: "dct03-reducoes-70" });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  const proposta70 = await prisma.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: segunda.dado.id } });
  expect([proposta70.creditoAnterior.toFixed(2), proposta70.creditoNovo.toFixed(2)]).toEqual(["20.00", "10.00"]);
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: segunda.dado.id, aprovada: true, motivo: "Segunda redução conferida", chaveIdempotencia: "dct03-reducoes-70-decisao" })).toMatchObject({ ok: true });
  const aplicada70 = await aplicarAcertoTaxaAditivo({ propostaId: segunda.dado.id, chaveIdempotencia: "dct03-reducoes-70-aplicar" });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: segunda.dado.id, chaveIdempotencia: "dct03-reducoes-70-aplicar" })).toEqual(aplicada70);
  expect((await prisma.origemCreditoAcertoTaxaAditivo.findMany({ orderBy: { criadaEm: "asc" } })).map(x => x.valor.toFixed(2))).toEqual(["20.00", "10.00"]);
  expect(await prisma.creditoMatricula.count({ where: { origemAcertoTaxaAditivoId: { not: null } } })).toBe(2);
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).valorNegociado.toFixed(2)).toBe("70.00");
});
it("preserva crédito e fatos ao elevar taxa liquidada de 80 para 90 e 120", async () => {
  const inicial = await propor("dct03-liquido-80");
  if (!inicial.ok || !inicial.dado) throw new Error(JSON.stringify(inicial));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: inicial.dado.id, aprovada: true, motivo: "Redução inicial conferida para saldo líquido", chaveIdempotencia: "dct03-liquido-80-decidir" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: inicial.dado.id, chaveIdempotencia: "dct03-liquido-80-aplicar" })).toMatchObject({ ok: true });
  const origem = await prisma.origemCreditoAcertoTaxaAditivo.findFirstOrThrow({ where: { cobrancaId } });
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { origemAcertoTaxaAditivoId: origem.id } });
  const dadosMatricula = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId }, select: { moeda: true } });
  const outra = await prisma.cobranca.create({ data: { matriculaId: base.matriculaId, tipo: "MENSALIDADE", valorOriginal: 20, valorNegociado: 20, saldo: 20, moeda: dadosMatricula.moeda, vencimento: new Date("2099-10-10") } });
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const usoOutra = await proporUtilizacaoCredito({ creditoId: credito.id, cobrancaId: outra.id, valor: "20.00", concordancia: "Aluno autorizou usar o crédito do acerto em outra cobrança", motivo: "Usar o crédito de acerto em mensalidade distinta", chaveIdempotencia: "dct03-liquido-uso-outra" });
  if (!usoOutra.ok || !usoOutra.dado) throw new Error(JSON.stringify(usoOutra));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirUtilizacaoCredito({ propostaId: usoOutra.dado.id, aprovar: true, motivo: "Uso em outra cobrança aprovado independentemente" })).toMatchObject({ ok: true });
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: outra.id } })).saldo?.toFixed(2)).toBe("0.00");
  const recebimentosAntes = await prisma.recebimento.count(), usosAntes = await prisma.decisaoUsoCredito.count();
  const versao90 = await formalizarNovaVersaoTaxa("90");
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const entrada90 = { matriculaId: base.matriculaId, propostaAditivoId: versao90.propostaId, conclusaoId: versao90.conclusaoId, revisaoHash: versao90.revisaoHash, cobrancaId, motivo: "Elevação formalizada preserva crédito já utilizado", evidencia: { recibo: "DCT03-90" }, chaveIdempotencia: "dct03-liquido-90" };
  const proposta90 = await proporAcertoTaxaAditivo(entrada90);
  if (!proposta90.ok || !proposta90.dado) throw new Error(JSON.stringify(proposta90));
  expect(await proporAcertoTaxaAditivo(entrada90)).toEqual(proposta90);
  expect(await prisma.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: proposta90.dado.id } })).toMatchObject({ creditoAnterior: expect.anything(), creditoNovo: expect.anything() });
  const guardada90 = await prisma.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: proposta90.dado.id } });
  expect([guardada90.creditoAnterior.toFixed(2), guardada90.creditoNovo.toFixed(2)]).toEqual(["20.00", "0.00"]);
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: proposta90.dado.id, aprovada: true, motivo: "Elevação a noventa conferida independentemente", chaveIdempotencia: "dct03-liquido-90-decidir" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: proposta90.dado.id, chaveIdempotencia: "dct03-liquido-90-aplicar" })).toMatchObject({ ok: true });
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).saldo?.toFixed(2)).toBe("10.00");
  const versao120 = await formalizarNovaVersaoTaxa("120", "2026-09-03T00:00:00-03:00");
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const proposta120 = await proporAcertoTaxaAditivo({ matriculaId: base.matriculaId, propostaAditivoId: versao120.propostaId, conclusaoId: versao120.conclusaoId, revisaoHash: versao120.revisaoHash, cobrancaId, motivo: "Elevação posterior preserva o crédito já usado", evidencia: { recibo: "DCT03-120" }, chaveIdempotencia: "dct03-liquido-120" });
  if (!proposta120.ok || !proposta120.dado) throw new Error(JSON.stringify(proposta120));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: proposta120.dado.id, aprovada: true, motivo: "Elevação a cento e vinte conferida", chaveIdempotencia: "dct03-liquido-120-decidir" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: proposta120.dado.id, chaveIdempotencia: "dct03-liquido-120-aplicar" })).toMatchObject({ ok: true });
  const taxa = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  expect(taxa.saldo?.toFixed(2)).toBe("40.00");
  expect(await prisma.origemCreditoAcertoTaxaAditivo.count({ where: { cobrancaId } })).toBe(1);
  expect(await prisma.recebimento.count()).toBe(recebimentosAntes);
  expect(await prisma.decisaoUsoCredito.count()).toBe(usosAntes);
  expect(await prisma.creditoMatricula.findUniqueOrThrow({ where: { id: credito.id } })).toMatchObject({ origemAcertoTaxaAditivoId: origem.id, valorInicial: expect.anything() });
  authMock.mockResolvedValue({ user: { id: financeiro } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId, chaveIdempotencia: "dct03-liquido-120-pagamento", autorId: financeiro, valorRecebido: 40, forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-04"), evidencia: "Comprovante da parcela pendente após elevação da taxa" }));
  const quitada = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  expect([quitada.saldo?.toFixed(2), quitada.status, await prisma.origemCreditoAcertoTaxaAditivo.count({ where: { cobrancaId } })]).toEqual(["0.00", "PAGO", 1]);
});
it("liquida a taxa elevada pelo crédito DCT03 via Q68 e conserva devolução confirmada", async () => {
  const inicial = await propor("dct03-q68-80");
  if (!inicial.ok || !inicial.dado) throw new Error(JSON.stringify(inicial));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: inicial.dado.id, aprovada: true, motivo: "Redução para crédito utilizável conferida", chaveIdempotencia: "dct03-q68-80-decidir" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: inicial.dado.id, chaveIdempotencia: "dct03-q68-80-aplicar" })).toMatchObject({ ok: true });
  const origem = await prisma.origemCreditoAcertoTaxaAditivo.findFirstOrThrow({ where: { cobrancaId } });
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { origemAcertoTaxaAditivoId: origem.id } });
  const versao120 = await formalizarNovaVersaoTaxa("120");
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const elevada = await proporAcertoTaxaAditivo({ matriculaId: base.matriculaId, propostaAditivoId: versao120.propostaId, conclusaoId: versao120.conclusaoId, revisaoHash: versao120.revisaoHash, cobrancaId, motivo: "Elevação antes da liquidação do saldo líquido", evidencia: { recibo: "DCT03-Q68-120" }, chaveIdempotencia: "dct03-q68-120" });
  if (!elevada.ok || !elevada.dado) throw new Error(JSON.stringify(elevada));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: elevada.dado.id, aprovada: true, motivo: "Elevação antes de uso de crédito conferida", chaveIdempotencia: "dct03-q68-120-decidir" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: elevada.dado.id, chaveIdempotencia: "dct03-q68-120-aplicar" })).toMatchObject({ ok: true });
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).saldo?.toFixed(2)).toBe("40.00");
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const uso = await proporUtilizacaoCredito({ creditoId: credito.id, cobrancaId, valor: "19.00", concordancia: "Aluno autorizou aplicar seu crédito de taxa no saldo elevado", motivo: "Liquidar parte da taxa elevada com crédito DCT03", chaveIdempotencia: "dct03-q68-proposta" });
  if (!uso.ok || !uso.dado) throw new Error(JSON.stringify(uso));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirUtilizacaoCredito({ propostaId: uso.dado.id, aprovar: true, motivo: "Uso na própria taxa aprovado independentemente" })).toMatchObject({ ok: true });
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).saldo?.toFixed(2)).toBe("21.00");
  authMock.mockResolvedValue({ user: { id: financeiro } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId, chaveIdempotencia: "dct03-q68-pagamento", autorId: financeiro, valorRecebido: 21, forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-04"), evidencia: "Comprovante do saldo restante após uso de crédito" }));
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toMatchObject({ status: "PAGO", saldo: expect.anything() });
  const devolucao = await proporDevolucaoCredito({ creditoId: credito.id, valor: "1.00", pedidoAluno: "Aluno solicitou devolução parcial do crédito restante", evidenciaPedido: "Protocolo de devolução parcial DCT03", destino: "Conta bancária do titular conferida", motivo: "Registrar devolução real do crédito remanescente", chaveIdempotencia: "dct03-q69-proposta" });
  expect(devolucao.ok, devolucao.ok ? undefined : devolucao.erro).toBe(true);
  if (!devolucao.ok || !devolucao.dado) throw new Error(JSON.stringify(devolucao));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  const decisao = await decidirDevolucaoCredito({ propostaId: devolucao.dado.id, aprovar: true, motivo: "Devolução parcial aprovada independentemente" });
  expect(decisao).toMatchObject({ ok: true });
  if (!decisao.ok || !decisao.dado?.id) throw new Error(JSON.stringify(decisao));
  const reserva = await prisma.reservaDevolucaoCredito.findFirstOrThrow({ where: { decisaoId: decisao.dado?.id } });
  const executor = await criarUsuario(["ADMINISTRADOR"]);
  authMock.mockResolvedValue({ user: { id: executor.id } });
  expect(await registrarExecucaoDevolucaoCredito({ reservaId: reserva.id, resultado: "CONFIRMADA", referenciaExterna: "dct03-q69-confirmada", evidenciaExecucao: "Comprovante de devolução conciliado", chaveIdempotencia: "dct03-q69-execucao" })).toMatchObject({ ok: true, dado: { estado: "CONFIRMADA" } });
  expect(await prisma.origemCreditoAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: origem.id } })).toMatchObject({ cobrancaId, valor: expect.anything() });
});
it("DCT03 recusa invalidação vigente ou pelo preparador e preserva replay sob permissão", async () => {
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const comissao = await prisma.comissao.create({ data: { matriculaId: base.matriculaId, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, valorBase: 100, moeda: "CRC", status: "PENDENTE" } });
  const proposta = await propor("dct03-invalidacao-guards"); if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: aprovador } }); await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Aprovação para conferir invalidação", chaveIdempotencia: "dct03-invalidacao-guards-decisao" });
  const p = await prisma.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  await expect(prisma.invalidacaoAcertoTaxaAditivo.create({ data: { propostaId: p.id, resolvedorId: aprovador, motivo: "Forjar JSON extra em fotografia vigente", evidencia: { conferencia: "forjada" }, fotografiaOriginalHash: p.fotografiaHash, fotografiaAtual: { ...(p.fotografia as object), extra: "não é mudança material" }, fotografiaAtualHash: "b".repeat(64), chaveIdempotencia: "dct03-forja-vigente" } })).rejects.toThrow();
  authMock.mockResolvedValue({ user: { id: financeiro } });
  await prisma.usuario.update({ where: { id: financeiro }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  expect(await invalidarAcertoTaxaAditivo({ propostaId: p.id, motivo: "Preparador não pode invalidar o próprio acerto", evidencia: { conferencia: "segregação" }, chaveIdempotencia: "dct03-auto-invalidar" })).toMatchObject({ ok: false });
  await prisma.comissao.update({ where: { id: comissao.id }, data: { status: "APROVADA" } }); authMock.mockResolvedValue({ user: { id: aprovador } });
  const entrada = { propostaId: p.id, motivo: "Comissão mudou e exige nova conferência", evidencia: { conferencia: "mudança material" }, chaveIdempotencia: "dct03-replay-invalidar" };
  const primeira = await invalidarAcertoTaxaAditivo(entrada); expect(primeira).toMatchObject({ ok: true }); expect(await invalidarAcertoTaxaAditivo(entrada)).toEqual(primeira);
  await prisma.usuario.update({ where: { id: aprovador }, data: { permissoes: [] } });
  expect(await invalidarAcertoTaxaAditivo(entrada)).toMatchObject({ ok: false });
});
it("DCT03 SQL reproduz o hash canônico TS e recusa hash arbitrário ou forma adulterada", async () => {
  const vendedor = await criarUsuario(["VENDEDOR"]);
  const comissao = await prisma.comissao.create({ data: { matriculaId: base.matriculaId, vendedorId: vendedor.id, tipo: "PERCENTUAL", percentual: 10, valor: 10, valorBase: 100, moeda: "CRC", status: "PENDENTE" } });
  const proposta = await propor("dct03-sql-canonica");
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Aprovação para validar fotografia SQL", chaveIdempotencia: "dct03-sql-canonica-decisao" })).toMatchObject({ ok: true });
  await prisma.comissao.update({ where: { id: comissao.id }, data: { status: "APROVADA" } });
  const p = await prisma.propostaAcertoTaxaAditivo.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  const atual = structuredClone(p.fotografia) as any;
  atual.comissoes = atual.comissoes.map((x: any) => x.id === comissao.id ? { ...x, status: "APROVADA" } : x);
  await expect(prisma.invalidacaoAcertoTaxaAditivo.create({ data: {
    propostaId: p.id, resolvedorId: aprovador, motivo: "Hash arbitrário não pode registrar uma mudança real", evidencia: { teste: "hash" },
    fotografiaOriginalHash: p.fotografiaHash, fotografiaAtual: atual, fotografiaAtualHash: "a".repeat(64), chaveIdempotencia: "dct03-hash-arbitrario",
  } })).rejects.toThrow();
  await expect(prisma.invalidacaoAcertoTaxaAditivo.create({ data: {
    propostaId: p.id, resolvedorId: aprovador, motivo: "Campo extra não pode registrar uma mudança real", evidencia: { teste: "shape" },
    fotografiaOriginalHash: p.fotografiaHash, fotografiaAtual: { ...atual, forjado: true }, fotografiaAtualHash: hashSubstituicao({ ...atual, forjado: true }), chaveIdempotencia: "dct03-shape-adulterado",
  } })).rejects.toThrow();
  const gravada = await prisma.invalidacaoAcertoTaxaAditivo.create({ data: {
    propostaId: p.id, resolvedorId: aprovador, motivo: "A fotografia canônica TS registra a mudança material exata", evidencia: { teste: "canonico" },
    fotografiaOriginalHash: p.fotografiaHash, fotografiaAtual: atual, fotografiaAtualHash: hashSubstituicao(atual), chaveIdempotencia: "dct03-canonica",
  } });
  expect(gravada.fotografiaAtualHash).toBe(hashSubstituicao(atual));
  await prisma.propostaAcertoTaxaAditivo.update({ where: { id: p.id }, data: { status: "OBSOLETA" } });
});
});

it("acerto da taxa selecionada aparece sem declarar a condição global aplicada", async () => {
  authMock.mockResolvedValue({ user: { id: base.secretariaId } });
  expect(await consultarEfeitosAditivo({ matriculaId: base.matriculaId, propostaId: alvo.propostaId })).toMatchObject({ ok: true, dado: { acertosTaxaAplicados: 0 } });
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const proposta = await propor("taxa-escopo-proposta", "Conferência do acerto específico", { recibo: "escopo" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: proposta.dado.id, aprovada: true, motivo: "Acerto específico conferido", chaveIdempotencia: "taxa-escopo-decisao" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: proposta.dado.id, chaveIdempotencia: "taxa-escopo-aplicar" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: base.secretariaId } });
  expect(await consultarEfeitosAditivo({ matriculaId: base.matriculaId, propostaId: alvo.propostaId })).toMatchObject({ ok: true, dado: { acertosTaxaAplicados: 1, aplicado: false, aplicacoesCampos: [{ campo: "TAXA_VALOR", aplicada: false }] } });
  expect(await consultarEfeitosAditivo({ matriculaId: "outra-matricula", propostaId: alvo.propostaId })).toMatchObject({ ok: false });
});

describe.sequential("Q170 impactos de todas as taxas", () => {
  async function prepararDuasTaxas(chave: string) {
    const original = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
    const preservada = await prisma.cobranca.create({ data: { matriculaId: base.matriculaId, tipo: "MATRICULA", moeda: original.moeda, valorOriginal: 35, valorNegociado: 35, saldo: 35, vencimento: new Date("2026-09-15T12:00:00.000Z") } });
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const conjunto = await prepararImpactosTaxaAditivo({ ...alvo, linhas: [
      { cobrancaId, decisao: "AFETADA", justificativa: "Taxa original alterada pelo aditivo assinado." },
      { cobrancaId: preservada.id, decisao: "PRESERVADA", justificativa: "Cobrança adicional permanece fora do escopo do aditivo." },
    ], chaveIdempotencia: chave });
    if (!conjunto.ok || !conjunto.dado) throw new Error(JSON.stringify(conjunto));
    return { conjuntoId: conjunto.dado.id, preservadaId: preservada.id };
  }

  it("prepara todas as duas taxas, exige aprovação independente, vincula e só conclui após aplicar o acerto afetado", async () => {
    await prisma.cobranca.create({ data: { matriculaId: base.matriculaId, tipo: "MENSALIDADE", moeda: "CRC", valorOriginal: 300, valorNegociado: 300, saldo: 300, vencimento: new Date("2026-10-15T12:00:00.000Z") } });
    const { conjuntoId, preservadaId } = await prepararDuasTaxas("q170-duas-taxas");
    expect(await consultarImpactosTaxaAditivo({ matriculaId: "outra-matricula", propostaId: alvo.propostaId })).toMatchObject({ ok: true, dado: null });
    expect(await consultarImpactosTaxaAditivo({ matriculaId: base.matriculaId, propostaId: alvo.propostaId })).toMatchObject({ ok: true, dado: { id: conjuntoId, status: "PENDENTE", impactos: expect.arrayContaining([
      expect.objectContaining({ cobrancaId, decisao: "AFETADA", justificativa: expect.stringContaining("original") }),
      expect.objectContaining({ cobrancaId: preservadaId, decisao: "PRESERVADA", justificativa: expect.stringContaining("permanece") }),
    ]) } });
    authMock.mockResolvedValue({ user: { id: financeiro } });
    expect(await decidirImpactosTaxaAditivo({ conjuntoId, aprovada: true, motivo: "O preparador não pode aprovar o próprio conjunto.", chaveIdempotencia: "q170-autoaprovar" })).toMatchObject({ ok: false });
    expect(await completarImpactosTaxaAditivo({ conjuntoId })).toMatchObject({ ok: false });
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const acerto = await propor("q170-acerto", "Acerto individual da taxa afetada.", { recibo: "Q170" });
    if (!acerto.ok || !acerto.dado) throw new Error(JSON.stringify(acerto));
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirAcertoTaxaAditivo({ propostaId: acerto.dado.id, aprovada: true, motivo: "Acerto individual aprovado por outro Financeiro.", chaveIdempotencia: "q170-acerto-aprovar" })).toMatchObject({ ok: true });
    expect(await aplicarAcertoTaxaAditivo({ propostaId: acerto.dado.id, chaveIdempotencia: "q170-acerto-aplicar" })).toMatchObject({ ok: true });
    const creditosAntes = await prisma.creditoMatricula.count({ where: { origemAcertoTaxaAditivoId: { not: null } } });
    expect(await vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId, propostaAcertoId: acerto.dado.id })).toMatchObject({ ok: true, dado: { vinculada: true } });
    expect(await decidirImpactosTaxaAditivo({ conjuntoId, aprovada: true, motivo: "Financeiro independente conferiu todas as taxas.", chaveIdempotencia: "q170-aprovar" })).toMatchObject({ ok: true, dado: { aprovada: true } });
    const proximaMensalidade = () => prisma.$transaction(tx => resolverMensalVigenteTx(tx, {
      matriculaId: base.matriculaId, inicioCobertura: new Date("2026-11-01"), fimCobertura: new Date("2026-11-30"),
      valorOriginal: "300", valorNegociadoOriginal: "300", moedaOriginal: "CRC",
    }));
    await expect(proximaMensalidade()).rejects.toThrow("aplicação explícita");
    expect(await completarImpactosTaxaAditivo({ conjuntoId })).toMatchObject({ ok: true, dado: { completo: true } });
    expect(await completarImpactosTaxaAditivo({ conjuntoId })).toMatchObject({ ok: true, dado: { completo: true } });
    expect(await prisma.creditoMatricula.count({ where: { origemAcertoTaxaAditivoId: { not: null } } })).toBe(creditosAntes);
    expect(await proximaMensalidade()).toMatchObject({ valorOriginal: "300", valorNegociado: "300", moeda: "CRC" });
    authMock.mockResolvedValue({ user: { id: base.secretariaId } });
    expect(await consultarEfeitosAditivo({ matriculaId: base.matriculaId, propostaId: alvo.propostaId })).toMatchObject({ ok: true, dado: { aplicado: false, aplicacoesCampos: [{ campo: "TAXA_VALOR", aplicada: true }] } });
    authMock.mockResolvedValue({ user: { id: aprovador } });

    expect(await consultarImpactosTaxaAditivo({ matriculaId: base.matriculaId, propostaId: alvo.propostaId })).toMatchObject({ ok: true, dado: { status: "COMPLETO", aplicado: true, impactos: expect.arrayContaining([expect.objectContaining({ cobrancaId, aplicado: true }), expect.objectContaining({ cobrancaId: preservadaId, aplicado: false })]) } });
  });

  it("não aprova nem por SQL uma taxa afetada sem acerto vinculado", async () => {
    const { conjuntoId } = await prepararDuasTaxas("q170-vinculo-obrigatorio");
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirImpactosTaxaAditivo({ conjuntoId, aprovada: true,
      motivo: "Conferência independente sem vínculos ainda preparados.", chaveIdempotencia: "q170-sem-vinculo" }))
      .toMatchObject({ ok: false, erro: expect.stringContaining("Vincule") });
    const conjunto = await prisma.conjuntoImpactosTaxaAditivo.findUniqueOrThrow({ where: { id: conjuntoId } });
    await expect(prisma.decisaoConjuntoImpactosTaxaAditivo.create({ data: {
      conjuntoId, decisorId: aprovador, aprovada: true, motivo: "Tentativa direta sem acerto vinculado.",
      fotografiaHash: conjunto.fotografiaHash, chaveIdempotencia: "q170-sql-sem-vinculo",
    } })).rejects.toThrow("Vincule");
    expect(await prisma.decisaoConjuntoImpactosTaxaAditivo.count({ where: { conjuntoId } })).toBe(0);
    expect(conjunto.status).toBe("PENDENTE");
  });

  it("exige aplicar as duas taxas afetadas antes de completar e bloqueia transição SQL artificial", async () => {
    const original = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
    const segunda = await prisma.cobranca.create({ data: { matriculaId: base.matriculaId, tipo: "MATRICULA", moeda: original.moeda, valorOriginal: 35, valorNegociado: 35, saldo: 35, vencimento: new Date("2026-09-16T12:00:00.000Z") } });
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const preparado = await prepararImpactosTaxaAditivo({ ...alvo, linhas: [
      { cobrancaId, decisao: "AFETADA", justificativa: "A primeira taxa exige acerto individual." },
      { cobrancaId: segunda.id, decisao: "AFETADA", justificativa: "A segunda taxa exige acerto individual." },
    ], chaveIdempotencia: "q170-duas-afetadas" });
    if (!preparado.ok || !preparado.dado) throw new Error(JSON.stringify(preparado));
    const conjuntoId = preparado.dado.id;
    await expect(prisma.conjuntoImpactosTaxaAditivo.update({ where: { id: conjuntoId }, data: { status: "APROVADO" } })).rejects.toThrow();
    const primeira = await propor("q170-duas-afetadas-1", "Primeira taxa afetada.", { recibo: "Q170-1" });
    const segundaProposta = await propor("q170-duas-afetadas-2", "Segunda taxa afetada.", { recibo: "Q170-2" }, segunda.id);
    if (!primeira.ok || !primeira.dado || !segundaProposta.ok || !segundaProposta.dado) throw new Error("Propostas Q170 indisponíveis");
    authMock.mockResolvedValue({ user: { id: aprovador } });
    for (const [propostaId, chave] of [[primeira.dado.id, "1"], [segundaProposta.dado.id, "2"]] as const) expect(await decidirAcertoTaxaAditivo({ propostaId, aprovada: true, motivo: "Acerto individual aprovado independentemente.", chaveIdempotencia: `q170-duas-afetadas-aprovar-${chave}` })).toMatchObject({ ok: true });
    authMock.mockResolvedValue({ user: { id: financeiro } });
    expect(await vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId, propostaAcertoId: primeira.dado.id })).toMatchObject({ ok: true });
    expect(await vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId: segunda.id, propostaAcertoId: segundaProposta.dado.id })).toMatchObject({ ok: true });
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirImpactosTaxaAditivo({ conjuntoId, aprovada: true, motivo: "As duas taxas e vínculos foram conferidos.", chaveIdempotencia: "q170-duas-afetadas-aprovar" })).toMatchObject({ ok: true });
    expect(await aplicarAcertoTaxaAditivo({ propostaId: primeira.dado.id, chaveIdempotencia: "q170-duas-afetadas-aplicar-1" })).toMatchObject({ ok: true });
    expect(await completarImpactosTaxaAditivo({ conjuntoId })).toMatchObject({ ok: false });
    expect(await aplicarAcertoTaxaAditivo({ propostaId: segundaProposta.dado.id, chaveIdempotencia: "q170-duas-afetadas-aplicar-2" })).toMatchObject({ ok: true });
    expect(await completarImpactosTaxaAditivo({ conjuntoId })).toMatchObject({ ok: true, dado: { completo: true } });
  });

  it("recusa replay com entrada alterada e vínculo de acerto de outra taxa", async () => {
    const { conjuntoId, preservadaId } = await prepararDuasTaxas("q170-replay");
    authMock.mockResolvedValue({ user: { id: financeiro } });
    expect(await prepararImpactosTaxaAditivo({ ...alvo, linhas: [
      { cobrancaId, decisao: "AFETADA", justificativa: "Taxa original alterada pelo aditivo assinado." },
      { cobrancaId: preservadaId, decisao: "PRESERVADA", justificativa: "Justificativa alterada para tentar replay inválido." },
    ], chaveIdempotencia: "q170-replay" })).toMatchObject({ ok: false });
    const acerto = await propor("q170-acerto-escopo", "Acerto existente pertence à primeira taxa.", { recibo: "Q170-escopo" });
    if (!acerto.ok || !acerto.dado) throw new Error(JSON.stringify(acerto));
    expect(await vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId: preservadaId, propostaAcertoId: acerto.dado.id })).toMatchObject({ ok: false });
  });

  it("recusa concluir se a cobrança preservada mudou depois da aprovação", async () => {
    const { conjuntoId, preservadaId } = await prepararDuasTaxas("q170-preservada-mutada");
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const acerto = await propor("q170-preservada-acerto", "Acerto aplicado antes da conferência global.", { recibo: "Q170-preservada" });
    if (!acerto.ok || !acerto.dado) throw new Error(JSON.stringify(acerto));
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirAcertoTaxaAditivo({ propostaId: acerto.dado.id, aprovada: true, motivo: "Acerto individual aprovado antes do conjunto.", chaveIdempotencia: "q170-preservada-acerto-aprovar" })).toMatchObject({ ok: true });
    expect(await aplicarAcertoTaxaAditivo({ propostaId: acerto.dado.id, chaveIdempotencia: "q170-preservada-acerto-aplicar" })).toMatchObject({ ok: true });
    expect(await vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId, propostaAcertoId: acerto.dado.id })).toMatchObject({ ok: true });
    expect(await decidirImpactosTaxaAditivo({ conjuntoId, aprovada: true, motivo: "Conjunto completo conferido antes da alteração posterior.", chaveIdempotencia: "q170-preservada-aprovar" })).toMatchObject({ ok: true });
    expect(await obsoletarImpactosTaxaAditivo({ conjuntoId, motivo: "Não há divergência material nesta fotografia.", chaveIdempotencia: "q170-obsoletar-integro" })).toMatchObject({ ok: false });
    await prisma.cobranca.update({ where: { id: preservadaId }, data: { valorNegociado: 36, saldo: 36, versao: { increment: 1 } } });
    expect(await completarImpactosTaxaAditivo({ conjuntoId })).toMatchObject({ ok: false });
    expect(await obsoletarImpactosTaxaAditivo({ conjuntoId, motivo: "Cobrança preservada mudou depois da aprovação.", chaveIdempotencia: "q170-obsoletar" })).toMatchObject({ ok: true, dado: { obsoleto: true } });
    expect(await obsoletarImpactosTaxaAditivo({ conjuntoId, motivo: "Outro motivo não pode alterar o replay auditável.", chaveIdempotencia: "q170-obsoletar" })).toMatchObject({ ok: false });
    expect(await obsoletarImpactosTaxaAditivo({ conjuntoId, motivo: "Cobrança preservada mudou depois da aprovação.", chaveIdempotencia: "q170-obsoletar" })).toMatchObject({ ok: true, dado: { obsoleto: true } });
    expect(await prisma.conjuntoImpactosTaxaAditivo.findUniqueOrThrow({ where: { id: conjuntoId } })).toMatchObject({ status: "OBSOLETO" });
  });

  it("reprepara a mesma classificação após rejeição, mantém um ativo e reutiliza acerto aplicado sem novo crédito", async () => {
    const { conjuntoId, preservadaId } = await prepararDuasTaxas("q170-repreparo-inicial");
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const acerto = await propor("q170-repreparo-acerto", "Acerto aplicado antes da reconstrução do conjunto.", { recibo: "Q170-repreparo" });
    if (!acerto.ok || !acerto.dado) throw new Error(JSON.stringify(acerto));
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirAcertoTaxaAditivo({ propostaId: acerto.dado.id, aprovada: true, motivo: "Acerto aprovado antes da reconstrução.", chaveIdempotencia: "q170-repreparo-acerto-aprovar" })).toMatchObject({ ok: true });
    expect(await aplicarAcertoTaxaAditivo({ propostaId: acerto.dado.id, chaveIdempotencia: "q170-repreparo-acerto-aplicar" })).toMatchObject({ ok: true });
    const creditosAntes = await prisma.creditoMatricula.count({ where: { origemAcertoTaxaAditivoId: { not: null } } });
    authMock.mockResolvedValue({ user: { id: financeiro } });
    expect(await vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId, propostaAcertoId: acerto.dado.id })).toMatchObject({ ok: true });
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirImpactosTaxaAditivo({ conjuntoId, aprovada: false, motivo: "Conjunto rejeitado para reconstrução idêntica.", chaveIdempotencia: "q170-repreparo-rejeitar" })).toMatchObject({ ok: true, dado: { aprovada: false } });
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const novo = await prepararImpactosTaxaAditivo({ ...alvo, linhas: [
      { cobrancaId, decisao: "AFETADA", justificativa: "Taxa original alterada pelo aditivo assinado." },
      { cobrancaId: preservadaId, decisao: "PRESERVADA", justificativa: "Cobrança adicional permanece fora do escopo do aditivo." },
    ], chaveIdempotencia: "q170-repreparo-novo" });
    if (!novo.ok || !novo.dado) throw new Error(JSON.stringify(novo));
    expect(novo.dado.id).not.toBe(conjuntoId);
    expect(await prisma.conjuntoImpactosTaxaAditivo.count({ where: { propostaAditivoId: alvo.propostaId, status: { in: ["PENDENTE", "APROVADO", "COMPLETO"] } } })).toBe(1);
    expect(await vincularImpactoTaxaAditivo({ conjuntoId: novo.dado.id, cobrancaId, propostaAcertoId: acerto.dado.id })).toMatchObject({ ok: true });
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirImpactosTaxaAditivo({ conjuntoId: novo.dado.id, aprovada: true, motivo: "Novo conjunto conferido independentemente.", chaveIdempotencia: "q170-repreparo-aprovar" })).toMatchObject({ ok: true });
    expect(await completarImpactosTaxaAditivo({ conjuntoId: novo.dado.id })).toMatchObject({ ok: true });
    expect(await prisma.creditoMatricula.count({ where: { origemAcertoTaxaAditivoId: { not: null } } })).toBe(creditosAntes);
  });

  it("recusa o vínculo de acerto rejeitado também pela proteção SQL", async () => {
    const { conjuntoId } = await prepararDuasTaxas("q170-acerto-vigente");
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const rejeitado = await propor("q170-acerto-rejeitado", "Acerto que será rejeitado antes do vínculo.", { recibo: "Q170-rejeitado" });
    if (!rejeitado.ok || !rejeitado.dado) throw new Error(JSON.stringify(rejeitado));
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirAcertoTaxaAditivo({ propostaId: rejeitado.dado.id, aprovada: false, motivo: "Acerto rejeitado antes do vínculo.", chaveIdempotencia: "q170-acerto-rejeitado-decisao" })).toMatchObject({ ok: true });
    authMock.mockResolvedValue({ user: { id: financeiro } });
    expect(await vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId, propostaAcertoId: rejeitado.dado.id })).toMatchObject({ ok: false, erro: expect.stringContaining("vigente") });
    await expect(prisma.impactoTaxaAditivo.updateMany({ where: { conjuntoId, cobrancaId }, data: { propostaAcertoId: rejeitado.dado.id } })).rejects.toThrow("vigente");

  });

  it("revalida acerto rejeitado antes da aprovação e permite repreparo", async () => {
    const { conjuntoId, preservadaId } = await prepararDuasTaxas("q170-acerto-revalidar");
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const paraRecusar = await propor("q170-acerto-revalidar", "Acerto pendente que perde vigência antes da aprovação do conjunto.", { recibo: "Q170-revalidar" });
    if (!paraRecusar.ok || !paraRecusar.dado) throw new Error(JSON.stringify(paraRecusar));
    authMock.mockResolvedValue({ user: { id: financeiro } });
    expect(await vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId, propostaAcertoId: paraRecusar.dado.id })).toMatchObject({ ok: true });
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirAcertoTaxaAditivo({ propostaId: paraRecusar.dado.id, aprovada: false, motivo: "Acerto recusado antes da aprovação do conjunto.", chaveIdempotencia: "q170-acerto-revalidar-rejeitar" })).toMatchObject({ ok: true });
    expect(await decidirImpactosTaxaAditivo({ conjuntoId, aprovada: true, motivo: "Não aprovar conjunto com acerto rejeitado.", chaveIdempotencia: "q170-acerto-revalidar-conjunto" })).toMatchObject({ ok: false, erro: expect.stringContaining("vigente") });
    expect(await obsoletarImpactosTaxaAditivo({ conjuntoId, motivo: "Acerto pendente foi rejeitado e exige novo preparo.", chaveIdempotencia: "q170-acerto-revalidar-obsoletar" })).toMatchObject({ ok: true, dado: { obsoleto: true } });

    authMock.mockResolvedValue({ user: { id: financeiro } });
    const reconstruido = await prepararImpactosTaxaAditivo({ ...alvo, linhas: [
      { cobrancaId, decisao: "AFETADA", justificativa: "Taxa original alterada pelo aditivo assinado." },
      { cobrancaId: preservadaId, decisao: "PRESERVADA", justificativa: "Cobrança adicional permanece fora do escopo do aditivo." },
    ], chaveIdempotencia: "q170-acerto-revalidar-repreparo" });
    expect(reconstruido).toMatchObject({ ok: true, dado: { status: "PENDENTE" } });
  });

  it("obsoleta conjunto aprovado quando o acerto é rejeitado depois e permite repreparo", async () => {
    const { conjuntoId, preservadaId } = await prepararDuasTaxas("q170-acerto-rejeicao-posterior");
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const pendenteAprovado = await propor("q170-acerto-rejeicao-posterior", "Acerto pendente aceito pelo conjunto antes da rejeição.", { recibo: "Q170-rejeicao-posterior" });
    if (!pendenteAprovado.ok || !pendenteAprovado.dado) throw new Error(JSON.stringify(pendenteAprovado));
    expect(await vincularImpactoTaxaAditivo({ conjuntoId, cobrancaId, propostaAcertoId: pendenteAprovado.dado.id })).toMatchObject({ ok: true });
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirImpactosTaxaAditivo({ conjuntoId, aprovada: true, motivo: "Conjunto aprovado com acerto ainda pendente.", chaveIdempotencia: "q170-acerto-rejeicao-posterior-conjunto" })).toMatchObject({ ok: true });
    expect(await decidirAcertoTaxaAditivo({ propostaId: pendenteAprovado.dado.id, aprovada: false, motivo: "Acerto rejeitado depois da aprovação do conjunto.", chaveIdempotencia: "q170-acerto-rejeicao-posterior-rejeitar" })).toMatchObject({ ok: true });
    expect(await obsoletarImpactosTaxaAditivo({ conjuntoId, motivo: "Acerto vinculado foi rejeitado após a aprovação.", chaveIdempotencia: "q170-acerto-rejeicao-posterior-obsoletar" })).toMatchObject({ ok: true, dado: { obsoleto: true } });
    expect(await obsoletarImpactosTaxaAditivo({ conjuntoId, motivo: "Acerto vinculado foi rejeitado após a aprovação.", chaveIdempotencia: "q170-acerto-rejeicao-posterior-obsoletar" })).toMatchObject({ ok: true, dado: { obsoleto: true } });

    const novo = await prepararImpactosTaxaAditivo({ ...alvo, linhas: [
      { cobrancaId, decisao: "AFETADA", justificativa: "Taxa original alterada pelo aditivo assinado." },
      { cobrancaId: preservadaId, decisao: "PRESERVADA", justificativa: "Cobrança adicional permanece fora do escopo do aditivo." },
    ], chaveIdempotencia: "q170-acerto-rejeicao-posterior-repreparo" });
    expect(novo).toMatchObject({ ok: true, dado: { status: "PENDENTE" } });
  });
});

// Q168/Q169: usa a mesma cadeia documental real de DCT03, mas com a política de
// cobertura assinada. Nenhuma prova de decisão ou aplicação é inserida à mão.
describe("Q168 obsolescência de conjunto de cobertura (requer 238)", () => {
  beforeEach(async () => {
    await truncarBanco();
    await cadeiaTaxa(undefined, true);
    await prepararFinanceiro();
  });

  async function prepararConjuntoCobertura(chaveIdempotencia: string, cobrancaId?: string, incluirPreservada = false) {
    const mensalidadeId = cobrancaId ?? (await prisma.cobranca.create({ data: {
      matriculaId: alvo.matriculaId, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100, saldo: 100, moeda: "CRC",
      vencimento: new Date("2026-10-01T00:00:00Z"), coberturaInicio: new Date("2026-10-01T00:00:00Z"), coberturaFim: new Date("2026-10-31T00:00:00Z"),
    } })).id;
    const preservadaId = incluirPreservada ? (await prisma.cobranca.create({ data: {
      matriculaId: alvo.matriculaId, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100, saldo: 100, moeda: "CRC",
      vencimento: new Date("2026-11-01T00:00:00Z"), coberturaInicio: new Date("2026-11-01T00:00:00Z"), coberturaFim: new Date("2026-11-30T00:00:00Z"),
    } })).id : undefined;
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const preparado = await prepararImpactosCoberturaAditivo({
      ...alvo,
      linhas: [{ cobrancaId: mensalidadeId, classificacao: "AFETADA", coberturaInicioNova: "2026-11-01", coberturaFimNova: "2026-11-30", justificativa: "Cobertura mensal corrigida conforme o aditivo assinado." }, ...(preservadaId ? [{ cobrancaId: preservadaId, classificacao: "PRESERVADA" as const, justificativa: "Mensalidade posterior preservada na fotografia completa." }] : [])],
      motivo: "Conjunto de cobertura preparado para conferência independente.",
      evidencia: "Conferência documental e financeira registrada.",
      chaveIdempotencia,
    });
    if (!preparado.ok || !preparado.dado) throw new Error(JSON.stringify(preparado));
    return { conjuntoId: preparado.dado.id, mensalidadeId, preservadaId };
  }

  async function aprovarConjunto(conjuntoId: string, chaveIdempotencia: string) {
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirImpactosCoberturaAditivo({ conjuntoId, aprovada: true, motivo: "Financeiro independente conferiu a fotografia completa.", chaveIdempotencia })).toMatchObject({ ok: true, dado: { aprovada: true } });
  }

  it("permite pendente → obsoleto → nova preparação e preserva replay por conjunto", async () => {
    const primeiro = await prepararConjuntoCobertura("q168-pendente-inicial");
    const motivo = "Fotografia pendente precisa ser refeita antes da aprovação.";
    expect(await obsoletarImpactosCoberturaAditivo({ conjuntoId: primeiro.conjuntoId, motivo, chaveIdempotencia: "q168-pendente-obsoleto" })).toMatchObject({ ok: true, dado: { obsoleto: true } });
    const segundo = await prepararConjuntoCobertura("q168-pendente-novo", primeiro.mensalidadeId);
    expect(segundo.conjuntoId).not.toBe(primeiro.conjuntoId);
    expect(await obsoletarImpactosCoberturaAditivo({ conjuntoId: segundo.conjuntoId, motivo: "Segundo conjunto pendente também exige reconstrução.", chaveIdempotencia: "q168-segundo-obsoleto" })).toMatchObject({ ok: true });
    expect(await obsoletarImpactosCoberturaAditivo({ conjuntoId: primeiro.conjuntoId, motivo, chaveIdempotencia: "q168-pendente-obsoleto" })).toMatchObject({ ok: true, dado: { obsoleto: true } });
    expect(await obsoletarImpactosCoberturaAditivo({ conjuntoId: primeiro.conjuntoId, motivo: "Motivo diferente não pode alterar o replay auditável.", chaveIdempotencia: "q168-pendente-obsoleto" })).toMatchObject({ ok: false });
    expect(await obsoletarImpactosCoberturaAditivo({ conjuntoId: primeiro.conjuntoId, motivo, chaveIdempotencia: "q168-chave-diversa" })).toMatchObject({ ok: false });
  });

  it("preserva o motivo da decisão no replay", async () => {
    const { conjuntoId } = await prepararConjuntoCobertura("q168-replay-decisao");
    const entrada = { conjuntoId, aprovada: true, motivo: "Financeiro independente conferiu a fotografia completa.", chaveIdempotencia: "q168-replay-aprovacao" };
    authMock.mockResolvedValue({ user: { id: aprovador } });
    const primeira = await decidirImpactosCoberturaAditivo(entrada);
    expect(primeira).toMatchObject({ ok: true });
    expect(await decidirImpactosCoberturaAditivo(entrada)).toEqual(primeira);
    expect(await decidirImpactosCoberturaAditivo({ ...entrada, motivo: "Outra justificativa não pode substituir a decisão registrada." })).toMatchObject({ ok: false });
    expect(await prisma.decisaoConjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { conjuntoId } })).toMatchObject({ motivo: entrada.motivo });
  });

  it("recusa aprovação quando outra mensalidade surgiu após o preparo", async () => {
    const { conjuntoId } = await prepararConjuntoCobertura("q168-nova-mensalidade");
    await prisma.cobranca.create({ data: {
      matriculaId: alvo.matriculaId, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100, saldo: 100, moeda: "CRC",
      vencimento: new Date("2026-12-01T00:00:00Z"), coberturaInicio: new Date("2026-12-01T00:00:00Z"), coberturaFim: new Date("2026-12-31T00:00:00Z"),
    } });
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await decidirImpactosCoberturaAditivo({ conjuntoId, aprovada: true, motivo: "Conferência de todas as mensalidades do contrato.", chaveIdempotencia: "q168-nova-mensalidade-aprovar" })).toMatchObject({ ok: false });
    expect(await prisma.decisaoConjuntoImpactosCoberturaAditivo.count({ where: { conjuntoId } })).toBe(0);
  });

  it("recusa autoaprovação", async () => {
    const { conjuntoId } = await prepararConjuntoCobertura("q168-autoaprovacao");
    authMock.mockResolvedValue({ user: { id: financeiro } });
    expect(await decidirImpactosCoberturaAditivo({ conjuntoId, aprovada: true, motivo: "O próprio preparador não pode aprovar o conjunto.", chaveIdempotencia: "q168-autoaprovar" })).toMatchObject({ ok: false });
    expect(await prisma.decisaoConjuntoImpactosCoberturaAditivo.count({ where: { conjuntoId } })).toBe(0);
  });

  it("consulta apresenta política assinada, motivo, evidência e limites para revisão", async () => {
    const { mensalidadeId } = await prepararConjuntoCobertura("q168-consulta-revisao");
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const consulta = await consultarImpactosCoberturaAditivo({ matriculaId: alvo.matriculaId, propostaId: alvo.propostaId });
    expect(consulta).toMatchObject({ ok: true, dado: {
      politica: { escolha: "PRESERVAR_REFERENCIA" },
      motivo: "Conjunto de cobertura preparado para conferência independente.",
      evidencia: "Conferência documental e financeira registrada.",
      impactos: [expect.objectContaining({ cobrancaId: mensalidadeId, coberturaInicioAnterior: "2026-10-01", coberturaFimAnterior: "2026-10-31", coberturaInicioNova: "2026-11-01", coberturaFimNova: "2026-11-30" })],
    } });
  });

  it("recusa Secretaria na consulta financeira de cobertura", async () => {
    authMock.mockResolvedValue({ user: { id: financeiro } });
    const consulta = { matriculaId: alvo.matriculaId, propostaId: alvo.propostaId };
    const preparo = await consultarPreparoCoberturaAditivo(consulta); if (!preparo.ok) throw new Error(preparo.erro);
    expect(preparo).toMatchObject({ ok: true, dado: { estado: "PRONTA" } });
    authMock.mockResolvedValue({ user: { id: base.secretariaId } });
    expect(await consultarPreparoCoberturaAditivo(consulta)).toMatchObject({ ok: false });
    expect(await consultarImpactosCoberturaAditivo(consulta)).toMatchObject({ ok: false });
  });

  it("recusa sessão financeira revogada antes de consultar cobertura", async () => {
    const consulta = { matriculaId: alvo.matriculaId, propostaId: alvo.propostaId };
    authMock.mockResolvedValue({ user: { id: financeiro } });
    expect(await consultarPreparoCoberturaAditivo(consulta)).toMatchObject({ ok: true, dado: { estado: "PRONTA" } });
    await prisma.usuario.update({ where: { id: financeiro }, data: { ativo: false } });
    expect(await consultarPreparoCoberturaAditivo(consulta)).toMatchObject({ ok: false });
    expect(await consultarImpactosCoberturaAditivo(consulta)).toMatchObject({ ok: false });
  });

  it("recusa obsolescer conjunto APROVADO cuja fotografia continua íntegra", async () => {
    const { conjuntoId } = await prepararConjuntoCobertura("q168-aprovado-integro");
    await aprovarConjunto(conjuntoId, "q168-aprovado-integro-aprovar");
    expect(await obsoletarImpactosCoberturaAditivo({ conjuntoId, motivo: "Não há mudança material na fotografia aprovada.", chaveIdempotencia: "q168-integro-obsoleto" })).toMatchObject({ ok: false, erro: expect.stringContaining("íntegro") });
    await expect(prisma.conjuntoImpactosCoberturaAditivo.update({ where: { id: conjuntoId }, data: { status: "OBSOLETO" } })).rejects.toThrow("Transição");
    expect(await prisma.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: conjuntoId } })).toMatchObject({ status: "APROVADO" });
  });

  it("recusa transição SQL para COMPLETO sem aplicações afetadas", async () => {
    const { conjuntoId } = await prepararConjuntoCobertura("q169-completo-sem-provas");
    await aprovarConjunto(conjuntoId, "q169-completo-sem-provas-aprovar");
    await expect(prisma.conjuntoImpactosCoberturaAditivo.update({ where: { id: conjuntoId }, data: { status: "COMPLETO" } })).rejects.toThrow("todas e somente aplicações afetadas");
    expect(await prisma.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: conjuntoId } })).toMatchObject({ status: "APROVADO" });
  });

  it("permite obsolescer APROVADO após alteração material fotografada", async () => {
    const { conjuntoId, mensalidadeId } = await prepararConjuntoCobertura("q168-aprovado-divergente");
    await aprovarConjunto(conjuntoId, "q168-aprovado-divergente-aprovar");
    await prisma.cobranca.update({ where: { id: mensalidadeId }, data: { coberturaFim: new Date("2026-10-30T00:00:00Z"), versao: { increment: 1 } } });
    expect(await obsoletarImpactosCoberturaAditivo({ conjuntoId, motivo: "Cobertura fotografada mudou após a aprovação independente.", chaveIdempotencia: "q168-divergente-obsoleto" })).toMatchObject({ ok: true, dado: { obsoleto: true } });
  });

  it("recusa obsolescência do conjunto COMPLETO com aplicação real", async () => {
    const { conjuntoId } = await prepararConjuntoCobertura("q168-aplicado");
    await aprovarConjunto(conjuntoId, "q168-aplicado-aprovar");
    const antes = await prisma.$transaction(tx => carregarAplicacoesCamposTx(tx, alvo.matriculaId));
    expect(projetarAplicacoesPorCampo(antes).COBERTURA_INICIO.aplicacaoId).toBeNull();
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await aplicarImpactosCoberturaAditivo({ conjuntoId, chaveIdempotencia: "q168-aplicado-executar" })).toMatchObject({ ok: true, dado: { completo: true } });
    const depois = await prisma.$transaction(tx => carregarAplicacoesCamposTx(tx, alvo.matriculaId));
    const campos = projetarAplicacoesPorCampo(depois);
    expect(campos.COBERTURA_INICIO.aplicacaoId).toBe(conjuntoId);
    expect(campos.COBERTURA_FIM.aplicacaoId).toBe(conjuntoId);
    expect(await prisma.aplicacaoCoberturaAditivo.count({ where: { impacto: { conjuntoId } } })).toBe(1);
    expect(await obsoletarImpactosCoberturaAditivo({ conjuntoId, motivo: "Conjunto aplicado não pode ser tornado obsoleto.", chaveIdempotencia: "q168-aplicado-obsoleto" })).toMatchObject({ ok: false });
    await expect(prisma.conjuntoImpactosCoberturaAditivo.update({ where: { id: conjuntoId }, data: { status: "OBSOLETO" } })).rejects.toThrow("Transição");
  });

  it("recusa aplicação se a mensalidade PRESERVADA mudou depois da aprovação", async () => {
    const { conjuntoId, preservadaId } = await prepararConjuntoCobertura("q169-preservada-mutada", undefined, true);
    if (!preservadaId) throw new Error("Mensalidade preservada indisponível");
    await aprovarConjunto(conjuntoId, "q169-preservada-mutada-aprovar");
    await prisma.cobranca.update({ where: { id: preservadaId }, data: { coberturaFim: new Date("2026-11-29T00:00:00Z"), versao: { increment: 1 } } });
    authMock.mockResolvedValue({ user: { id: aprovador } });
    expect(await aplicarImpactosCoberturaAditivo({ conjuntoId, chaveIdempotencia: "q169-preservada-mutada-aplicar" })).toMatchObject({ ok: false });
    expect(await prisma.aplicacaoCoberturaAditivo.count({ where: { impacto: { conjuntoId } } })).toBe(0);
    expect(await prisma.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: conjuntoId } })).toMatchObject({ status: "APROVADO" });
  });

  it("o gatilho diferido desfaz aplicação comprovada se PRESERVADA muda antes de completar", async () => {
    const { conjuntoId, mensalidadeId, preservadaId } = await prepararConjuntoCobertura("q169-deferred-preservada", undefined, true);
    if (!preservadaId) throw new Error("Mensalidade preservada indisponível");
    await aprovarConjunto(conjuntoId, "q169-deferred-preservada-aprovar");
    await expect(prisma.$transaction(async tx => {
      const conjunto = await tx.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: conjuntoId }, include: { impactos: true } });
      const impacto = conjunto.impactos.find(item => item.cobrancaId === mensalidadeId);
      if (!impacto?.coberturaInicioAnterior || !impacto.coberturaFimAnterior || !impacto.coberturaInicioNova || !impacto.coberturaFimNova) throw new Error("Impacto afetado incompleto");
      await tx.cobranca.update({ where: { id: mensalidadeId }, data: { coberturaInicio: impacto.coberturaInicioNova, coberturaFim: impacto.coberturaFimNova, versao: { increment: 1 } } });
      await tx.aplicacaoCoberturaAditivo.create({ data: {
        impactoId: impacto.id, cobrancaId: mensalidadeId, executorId: aprovador, fotografiaHash: conjunto.fotografiaHash,
        chaveIdempotencia: "q169-deferred-preservada-prova", versaoCobrancaAntes: impacto.versaoCobranca, versaoCobrancaDepois: impacto.versaoCobranca + 1,
        coberturaInicioAnterior: impacto.coberturaInicioAnterior, coberturaFimAnterior: impacto.coberturaFimAnterior,
        coberturaInicioNova: impacto.coberturaInicioNova, coberturaFimNova: impacto.coberturaFimNova,
      } });
      await tx.cobranca.update({ where: { id: preservadaId }, data: { coberturaFim: new Date("2026-11-29T00:00:00Z"), versao: { increment: 1 } } });
      await tx.conjuntoImpactosCoberturaAditivo.update({ where: { id: conjuntoId }, data: { status: "COMPLETO" } });
    })).rejects.toThrow("Conjunto completo sem efeitos comprovados");
    expect(await prisma.aplicacaoCoberturaAditivo.count({ where: { impacto: { conjuntoId } } })).toBe(0);
    expect(await prisma.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: conjuntoId } })).toMatchObject({ status: "APROVADO" });
  });

  it("o gatilho diferido exige a lista exata se nova mensalidade nasce após COMPLETO", async () => {
    const { conjuntoId, mensalidadeId } = await prepararConjuntoCobertura("q169-deferred-lista");
    await aprovarConjunto(conjuntoId, "q169-deferred-lista-aprovar");
    await expect(prisma.$transaction(async tx => {
      const conjunto = await tx.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: conjuntoId }, include: { impactos: true } });
      const impacto = conjunto.impactos.find(item => item.cobrancaId === mensalidadeId);
      if (!impacto?.coberturaInicioAnterior || !impacto.coberturaFimAnterior || !impacto.coberturaInicioNova || !impacto.coberturaFimNova) throw new Error("Impacto afetado incompleto");
      await tx.cobranca.update({ where: { id: mensalidadeId }, data: { coberturaInicio: impacto.coberturaInicioNova, coberturaFim: impacto.coberturaFimNova, versao: { increment: 1 } } });
      await tx.aplicacaoCoberturaAditivo.create({ data: {
        impactoId: impacto.id, cobrancaId: mensalidadeId, executorId: aprovador, fotografiaHash: conjunto.fotografiaHash,
        chaveIdempotencia: "q169-deferred-lista-prova", versaoCobrancaAntes: impacto.versaoCobranca, versaoCobrancaDepois: impacto.versaoCobranca + 1,
        coberturaInicioAnterior: impacto.coberturaInicioAnterior, coberturaFimAnterior: impacto.coberturaFimAnterior,
        coberturaInicioNova: impacto.coberturaInicioNova, coberturaFimNova: impacto.coberturaFimNova,
      } });
      await tx.conjuntoImpactosCoberturaAditivo.update({ where: { id: conjuntoId }, data: { status: "COMPLETO" } });
      await tx.cobranca.create({ data: {
        matriculaId: alvo.matriculaId, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100, saldo: 100, moeda: "CRC",
        vencimento: new Date("2026-12-01T00:00:00Z"), coberturaInicio: new Date("2026-12-01T00:00:00Z"), coberturaFim: new Date("2026-12-31T00:00:00Z"),
      } });
    })).rejects.toThrow("classificar exatamente");
    expect(await prisma.aplicacaoCoberturaAditivo.count({ where: { impacto: { conjuntoId } } })).toBe(0);
    expect(await prisma.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: conjuntoId } })).toMatchObject({ status: "APROVADO" });
  });
});
