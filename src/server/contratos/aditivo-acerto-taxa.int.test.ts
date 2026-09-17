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
import { hashSubstituicao } from "./substituicao-estado";

let base: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>, alvo: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string }, cobrancaId: string, financeiro: string, aprovador: string;
async function cadeiaTaxa(vencimentoTaxa?: string) {
 base = await prepararFixtureSubstituicaoContratual(authMock, { camposFinanceiros: true, ambiente: "PRODUCAO", semSubstituicao: true });
 const fonte = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: base.processoId }, include: { artefato: { include: { conferencia: true } } } });
 const pessoas = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(fonte.artefato.conferencia.snapshot).participantes, agora = new Date().toISOString();
 const conclusao = await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, { processoId: fonte.id, referenciaExterna: base.referenciaExternaFonte, originalHash: fonte.artefato.pdfHash, concluidaEm: agora, pdfAssinado: Buffer.from("%PDF-assinado"), evidencias: Buffer.from("evidencia"), assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(pessoas[0].identidade), referenciaAssinatura: "fonte", assinadaEm: agora }] }));
 const modelo = await prisma.$transaction(tx => prepararModeloTx(tx, base.secretariaId, { codigo: "DCT03", versaoEsperada: 0, chaveIdempotencia: "dct03-modelo", motivo: "Modelo de acerto de taxa", conteudo: { titulo: "Aditivo", finalidade: "ADITIVO", regimes: ["MENSALIDADE"], aplicacao: "Teste DCT03", campos: [{ chave: "nome", descricao: "Aluno", origem: "ALUNO_NOME" }, { chave: "taxa", descricao: "Taxa", origem: "TAXA_VALOR" }, { chave: "vencimento", descricao: "Vencimento da taxa", origem: "TAXA_VENCIMENTO" }, { chave: "original", descricao: "Original", origem: "ADITIVO_CONTRATO_ORIGINAL" }, { chave: "anteriores", descricao: "Anteriores", origem: "ADITIVO_ANTERIORES" }, { chave: "alteracoes", descricao: "Alterações", origem: "ADITIVO_ALTERACOES" }, { chave: "vigencia", descricao: "Vigência", origem: "ADITIVO_VIGENCIA" }], secoes: [{ titulo: "Dados", texto: "{{nome}} {{taxa}} {{vencimento}} {{original}} {{anteriores}} {{alteracoes}} {{vigencia}}" }], assinaturas: [{ papel: "ALUNO", condicao: "SEMPRE" }] } }));
 const modeloGravado = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: modelo.id } }); authMock.mockResolvedValue({ user: { id: base.adminId } }); await decidirModeloContratual({ modeloId: modelo.id, conteudoHash: modeloGravado.conteudoHash, aprovada: true, motivo: "Modelo aprovado independentemente" }); authMock.mockResolvedValue({ user: { id: base.secretariaId } });
 const fonteAssinada = await prisma.conclusaoAssinaturaContratual.findUniqueOrThrow({ where: { id: conclusao.id } });
 const proposta = await prisma.$transaction(tx => prepararAditivoContratualTx(tx, base.secretariaId, { matriculaId: base.matriculaId, conclusaoOriginalId: conclusao.id, conclusaoHashEsperado: fonteAssinada.entradaHash, modeloId: modelo.id, modeloHashEsperado: modeloGravado.conteudoHash, vigenciaInicio: "2026-09-01T00:00:00-03:00", alteracoes: [{ origem: "TAXA_VALOR", novo: "80.00 CRC", valorEstruturado: { tipo: "DINHEIRO", valor: "80", moeda: "CRC" } }, ...(vencimentoTaxa ? [{ origem: "TAXA_VENCIMENTO" as const, novo: vencimentoTaxa, valorEstruturado: { tipo: "DATA" as const, data: vencimentoTaxa } }] : [])], motivo: "Reduzir taxa paga para acerto", chaveIdempotencia: "dct03-proposta" }));
 await prisma.$transaction(tx => decidirAditivoContratualTx(tx, base.adminId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true, motivo: "Aditivo aprovado independentemente" }));
 authMock.mockResolvedValue({ user: { id: base.adminId } }); for (const alcada of ["FINANCEIRA", "COMERCIAL"] as const) await decidirAlcadaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, propostaHash: proposta.propostaHash, alcada, aprovada: true, motivo: "Alçada aprovada independentemente" });
 authMock.mockResolvedValue({ user: { id: base.secretariaId } }); const aluno = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId }, include: { aluno: true } }), identidade = { nome: `${aluno.aluno.primeiroNome} ${aluno.aluno.sobrenome}`, email: aluno.aluno.email!, documento: aluno.aluno.documento! };
 const participantes = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, base.secretariaId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, versaoEsperada: 0, maioridade: null, participantes: [{ papel: "ALUNO", identidade }], identificacoesConferidas: true, motivo: "Participantes conferidos para o aditivo", chaveIdempotencia: "dct03-participantes" }));
 const original = await preservarOriginalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conferenciaId: participantes.id, conferenciaHash: participantes.revisaoHash, conteudoConferido: true, motivo: "Original conferido para assinatura" }); if (!original.ok || !original.dado) throw new Error(JSON.stringify(original));
 const assinatura = await consultarAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id }); if (!assinatura.ok || !assinatura.dado?.revisao) throw new Error(JSON.stringify(assinatura));
 const conferencia = await registrarConferenciaAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id, revisaoHash: assinatura.dado.revisao.hash, dadosConferidos: true, motivo: "Assinatura conferida para o aditivo", chaveIdempotencia: "dct03-assinatura" }); if (!conferencia.ok || !conferencia.dado) throw new Error(JSON.stringify(conferencia));
 const processo = await prepararProcessoAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: original.dado.id, conferenciaId: conferencia.dado.id, fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" }); if (!processo.ok || !processo.dado) throw new Error(JSON.stringify(processo));
 const tentativa = await prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, base.secretariaId, { processoId: processo.dado!.id })); await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId: processo.dado!.id, tentativaId: tentativa.tentativaId, chave: "dct03-envio", resultado: "REGISTRADO", referenciaExterna: "dct03-assinado", evidenciaHash: "a".repeat(64) }));
 const artefato = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: original.dado.id }, include: { conferencia: true } }), ass = z.object({ participantes: z.array(z.object({ papel: z.literal("ALUNO"), identidade: IdentidadeSignatarioSchema })) }).parse(artefato.conferencia.snapshot).participantes, agoraFim = new Date().toISOString(), fim = await prisma.$transaction(tx => preservarConclusaoAssinaturaAditivoTx(tx, { processoId: processo.dado!.id, referenciaExterna: "dct03-assinado", originalHash: artefato.pdfHash, concluidaEm: agoraFim, pdfAssinado: Buffer.from("%PDF-assinado-aditivo"), evidencias: Buffer.from("evidencia-aditivo"), assinaturas: ass.map(x => ({ papel: x.papel, identidadeHash: hashPrevia(x.identidade), referenciaAssinatura: "dct03", assinadaEm: agoraFim })) }));
 const revisao = await consultarConferenciaFinalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id }); if (!revisao.ok || !revisao.dado?.revisao) throw new Error(JSON.stringify(revisao)); const final = await registrarConferenciaFinalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash, documentoConferido: true, evidenciasConferidas: true, motivo: "Conclusão conferida para o acerto" }); if (!final.ok) throw new Error(JSON.stringify(final));
 const cond = await registrarCondicoesFormalizadasAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash }); if (!cond.ok) throw new Error(JSON.stringify(cond)); alvo = { matriculaId: base.matriculaId, propostaId: proposta.id, conclusaoId: fim.id, revisaoHash: revisao.dado.revisao.hash }; cobrancaId = (await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId, tipo: "MATRICULA" } })).id;
}
async function formalizarNovaVersaoTaxa(valor: string) {
 const original = await prisma.conclusaoAssinaturaContratual.findFirstOrThrow({ where: { processo: { matriculaId: base.matriculaId } } });
 const anterior = await prisma.versaoCondicoesAditivo.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, include: { proposta: true } });
 const modelo = await prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: anterior.proposta.modeloId } });
 const proposta = await prisma.$transaction(tx => prepararAditivoContratualTx(tx, base.secretariaId, { matriculaId: base.matriculaId, conclusaoOriginalId: original.id, conclusaoHashEsperado: original.entradaHash, modeloId: anterior.proposta.modeloId, modeloHashEsperado: modelo.conteudoHash, vigenciaInicio: "2026-09-02T00:00:00-03:00", alteracoes: [{ origem: "TAXA_VALOR", novo: `${Number(valor).toFixed(2)} CRC`, valorEstruturado: { tipo: "DINHEIRO", valor, moeda: "CRC" } }], motivo: "Nova redução formalizada após acerto aprovado", chaveIdempotencia: "dct03-segundo-aditivo" }));
 await prisma.$transaction(tx => decidirAditivoContratualTx(tx, base.adminId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true, motivo: "Segundo aditivo aprovado" }));
 authMock.mockResolvedValue({ user: { id: base.adminId } });
 for (const alcada of ["FINANCEIRA", "COMERCIAL"] as const) await decidirAlcadaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, propostaHash: proposta.propostaHash, alcada, aprovada: true, motivo: "Alçada do segundo aditivo aprovada" });
 authMock.mockResolvedValue({ user: { id: base.secretariaId } });
 const aluno = await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId }, include: { aluno: true } });
 const participantes = await prisma.$transaction(tx => conferirParticipantesAditivoTx(tx, base.secretariaId, { propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, versaoEsperada: 0, maioridade: null, participantes: [{ papel: "ALUNO", identidade: { nome: `${aluno.aluno.primeiroNome} ${aluno.aluno.sobrenome}`, email: aluno.aluno.email!, documento: aluno.aluno.documento! } }], identificacoesConferidas: true, motivo: "Participantes do segundo aditivo conferidos", chaveIdempotencia: "dct03-segundo-participantes" }));
 const artefato = await preservarOriginalAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, conferenciaId: participantes.id, conferenciaHash: participantes.revisaoHash, conteudoConferido: true, motivo: "Original do segundo aditivo conferido" });
 if (!artefato.ok || !artefato.dado) throw new Error(JSON.stringify(artefato));
 const revisaoAssinatura = await consultarAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: artefato.dado.id });
 if (!revisaoAssinatura.ok || !revisaoAssinatura.dado?.revisao) throw new Error(JSON.stringify(revisaoAssinatura));
 const conferencia = await registrarConferenciaAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: artefato.dado.id, revisaoHash: revisaoAssinatura.dado.revisao.hash, dadosConferidos: true, motivo: "Assinatura do segundo aditivo conferida", chaveIdempotencia: "dct03-segundo-assinatura" });
 if (!conferencia.ok || !conferencia.dado) throw new Error(JSON.stringify(conferencia));
 const processo = await prepararProcessoAssinaturaAditivo({ matriculaId: base.matriculaId, propostaId: proposta.id, artefatoId: artefato.dado.id, conferenciaId: conferencia.dado.id, fornecedor: "ZAPSIGN", ambiente: "PRODUCAO" });
 if (!processo.ok || !processo.dado) throw new Error(JSON.stringify(processo));
 const tentativa = await prisma.$transaction(tx => iniciarTentativaAditivoTx(tx, base.secretariaId, { processoId: processo.dado!.id }));
 await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId: processo.dado!.id, tentativaId: tentativa.tentativaId, chave: "dct03-segundo-envio", resultado: "REGISTRADO", referenciaExterna: "dct03-segundo-assinado", evidenciaHash: "b".repeat(64) }));
 const assinado = await prisma.artefatoAditivoContratual.findUniqueOrThrow({ where: { id: artefato.dado.id }, include: { conferencia: true } });
 const assinaturas = z.object({ participantes: z.array(z.object({ papel: z.literal("ALUNO"), identidade: IdentidadeSignatarioSchema })) }).parse(assinado.conferencia.snapshot).participantes;
 const agora = new Date().toISOString();
 const fim = await prisma.$transaction(tx => preservarConclusaoAssinaturaAditivoTx(tx, { processoId: processo.dado!.id, referenciaExterna: "dct03-segundo-assinado", originalHash: assinado.pdfHash, concluidaEm: agora, pdfAssinado: Buffer.from("%PDF-segundo-aditivo"), evidencias: Buffer.from("evidencia-segundo-aditivo"), assinaturas: assinaturas.map(x => ({ papel: x.papel, identidadeHash: hashPrevia(x.identidade), referenciaAssinatura: "dct03-segundo", assinadaEm: agora })) }));
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
async function propor(chave = "dct03-propor", motivo = "Taxa paga maior que o aditivo assinado", evidencia = { recibo: "DCT03" }) { authMock.mockResolvedValue({ user: { id: financeiro } }); const { propostaId: propostaAditivoId, ...final } = alvo; return proporAcertoTaxaAditivo({ ...final, propostaAditivoId, cobrancaId, motivo, evidencia, chaveIdempotencia: chave }); }
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
  const posterior = await formalizarNovaVersaoTaxa("70");
  authMock.mockResolvedValue({ user: { id: aprovador } });
  const invalidada = await invalidarAcertoTaxaAditivo({ propostaId: proposta.dado.id, motivo: "Outro aditivo assinou nova taxa para a matrícula", evidencia: { conferencia: "versão posterior" }, chaveIdempotencia: "dct03-versao-posterior-invalidar" });
  if (!invalidada.ok) throw new Error(invalidada.erro);
  const invalidacao = await prisma.invalidacaoAcertoTaxaAditivo.findUniqueOrThrow({ where: { propostaId: proposta.dado.id } });
  expect(invalidacao.fotografiaAtual).toMatchObject({ versaoCondicoesId: posterior.versaoCondicoesId, revisaoHash: posterior.revisaoHash });
  authMock.mockResolvedValue({ user: { id: financeiro } });
  const nova = await proporAcertoTaxaAditivo({ matriculaId: base.matriculaId, propostaAditivoId: posterior.propostaId, conclusaoId: posterior.conclusaoId, revisaoHash: posterior.revisaoHash, cobrancaId, motivo: "Acerto da última taxa formalizada", evidencia: { recibo: "DCT03-70" }, chaveIdempotencia: "dct03-versao-posterior-repropor" });
  if (!nova.ok || !nova.dado) throw new Error(JSON.stringify(nova));
  authMock.mockResolvedValue({ user: { id: aprovador } });
  expect(await decidirAcertoTaxaAditivo({ propostaId: nova.dado.id, aprovada: true, motivo: "Reproposta da última versão conferida", chaveIdempotencia: "dct03-versao-posterior-redecidir" })).toMatchObject({ ok: true });
  expect(await aplicarAcertoTaxaAditivo({ propostaId: nova.dado.id, chaveIdempotencia: "dct03-versao-posterior-aplicar" })).toMatchObject({ ok: true });
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).valorNegociado.toFixed(2)).toBe("70.00");
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
