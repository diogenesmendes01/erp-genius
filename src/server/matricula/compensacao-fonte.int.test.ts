import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedRelatoOfertaConfirmado } from "@/test/indisponibilidade-oferta";
import { prepararCompensacaoCobertura, decidirCompensacaoCobertura } from "./compensacao-cobertura";
import { apurarDiasIndisponibilidadeCoberturaTx } from "./apuracao-indisponibilidade-cobertura";
import { proporTerminoIndisponibilidadeOferta, decidirTerminoIndisponibilidadeOferta } from "./indisponibilidade-oferta-termino";
import { consultarCompensacoesCobertura } from "./compensacao-cobertura-consulta";

let matriculaId: string, cobrancaId: string, financeiroId: string, adminId: string, versaoCobranca: number;
const entrada = () => ({ matriculaId, cobrancaId, versaoCobranca, dias: ["2026-09-10"], motivo: "Compensar dias sem oferta", evidenciaCondicoes: "Condições contratuais conferidas", chaveIdempotencia: "compensacao-fonte-verificada" });
beforeEach(async () => {
  await truncarBanco();
  const c = await seedCatalogoMinimo();
  financeiroId = (await criarUsuario(["FINANCEIRO"])).id;
  adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Fonte QA", paisId: c.pais.id } });
  const m = await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: c.pais.id, produtoId: c.produto.id, moeda: "CRC", status: "ATIVA" } });
  matriculaId = m.id;
  const doc = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato sintético", url: "/api/files/teste-fonte.pdf" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: adminId, contratoDocumentoId: doc.id } });
  cobrancaId = (await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", valorOriginal: 300, valorNegociado: 300, moeda: "CRC", vencimento: new Date("2026-09-05"), coberturaInicio: new Date("2026-09-01"), coberturaFim: new Date("2026-09-30") } })).id;
  versaoCobranca = (await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).versao;
  authMock.mockResolvedValue({ user: { id: financeiroId } });
});

it("recusa dias sem fonte positiva e fonte de outra matrícula", async () => {
  expect(await prepararCompensacaoCobertura(entrada())).toMatchObject({ ok: false });
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId: m.alunoId, paisId: m.paisId, produtoId: m.produtoId, moeda: m.moeda } });
  await seedRelatoOfertaConfirmado(outra.id, "2026-09-10", "2026-09-10");
  expect(await consultarCompensacoesCobertura({ matriculaId: outra.id, cobrancaId })).toMatchObject({ ok: false });
  expect(await consultarCompensacoesCobertura({ matriculaId, cobrancaId })).toMatchObject({ ok: true, dado: { apuracao: { classificacao: "NENHUMA" } } });
  expect(await prepararCompensacaoCobertura(entrada())).toMatchObject({ ok: false });
  expect(await prisma.compensacaoCoberturaMatricula.count()).toBe(0);
});

it("une sobreposições e aprova somente dias confirmados ainda não compensados", async () => {
  await seedRelatoOfertaConfirmado(matriculaId, "2026-09-09", "2026-09-11");
  await seedRelatoOfertaConfirmado(matriculaId, "2026-09-10", "2026-09-12");
  const apuracao = await prisma.$transaction(tx => apurarDiasIndisponibilidadeCoberturaTx(tx, { matriculaId, inicio: new Date("2026-09-01"), fim: new Date("2026-09-30") }));
  expect(apuracao).toMatchObject({ classificacao: "PARCIAL", diasConfirmados: ["2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"] });
  const p = await prepararCompensacaoCobertura(entrada());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  expect(await consultarCompensacoesCobertura({ matriculaId, cobrancaId })).toMatchObject({ ok: true, dado: { propostas: [{ podeDecidir: false }] } });
  authMock.mockResolvedValue({ user: { id: adminId } });
  expect(await consultarCompensacoesCobertura({ matriculaId, cobrancaId })).toMatchObject({ ok: true, dado: { propostas: [{ podeDecidir: true }] } });
  expect(await decidirCompensacaoCobertura({ id: p.dado.id, aprovar: true, motivo: "Dias e origem conferidos" })).toMatchObject({ ok: true });
  expect(await prisma.diaCompensacaoCobertura.count()).toBe(1);
  expect(await consultarCompensacoesCobertura({ matriculaId, cobrancaId })).toMatchObject({ ok: true, dado: { diasComDireito: ["2026-09-10"], propostas: [{ podeDecidir: false }] } });
  authMock.mockResolvedValue({ user: { id: financeiroId } });
  expect(await prepararCompensacaoCobertura({ ...entrada(), chaveIdempotencia: "duplicar-dia-compensacao" })).toMatchObject({ ok: false });
});

it("fim aprovado depois da proposta exige nova conferência antes de conceder dias", async () => {
  const fonte = await seedRelatoOfertaConfirmado(matriculaId, "2026-09-09", null);
  const p = await prepararCompensacaoCobertura(entrada());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  authMock.mockResolvedValue({ user: { id: fonte.autor.id } });
  const termino = await proporTerminoIndisponibilidadeOferta({ registroId: fonte.relato.id, fim: "2026-09-09", motivo: "Último dia confirmado da indisponibilidade", evidenciaTexto: "Fonte conferida após a preparação financeira", chaveIdempotencia: "termino-fonte-compensacao" });
  if (!termino.ok || !termino.dado) throw new Error(JSON.stringify(termino));
  authMock.mockResolvedValue({ user: { id: fonte.gestor.id } });
  expect(await decidirTerminoIndisponibilidadeOferta({ propostaId: termino.dado.id, aprovada: true, motivo: "Fim da indisponibilidade conferido", evidenciaTexto: "A oferta voltou no dia dez" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: adminId } });
  expect(await decidirCompensacaoCobertura({ id: p.dado.id, aprovar: true, motivo: "Conferência da proposta anterior" })).toMatchObject({ ok: false });
  await expect(prisma.compensacaoCoberturaMatricula.update({ where: { id: p.dado.id }, data: { status: "APROVADA", decisorId: adminId, decididaEm: new Date(), motivoDecisao: "Tentativa direta após mudança da fonte" } })).rejects.toThrow();
  expect(await decidirCompensacaoCobertura({ id: p.dado.id, aprovar: false, motivo: "Fonte alterada exige nova proposta" })).toMatchObject({ ok: true });
  expect(await prisma.diaCompensacaoCobertura.count()).toBe(0);
});

it("período inteiro confirmado não permite contornar a escolha do aluno com poucos dias", async () => {
  await seedRelatoOfertaConfirmado(matriculaId, "2026-09-01", "2026-09-30");
  expect(await prepararCompensacaoCobertura(entrada())).toMatchObject({ ok: false });
  await expect(prisma.compensacaoCoberturaMatricula.create({ data: { matriculaId, cobrancaOrigemId: cobrancaId, preparadorId: financeiroId, decisorId: adminId, status: "APROVADA", decididaEm: new Date(), motivoDecisao: "Aprovação direta indevida", motivo: "Compensar somente um dia", evidenciaCondicoes: "Fonte integral não permite este fluxo", diasPropostos: ["2026-09-10"], coberturaOriginalInicio: new Date("2026-09-01"), coberturaOriginalFim: new Date("2026-09-30"), valorCoberturaOriginal: 300, moeda: "CRC", cobrancaVersao: 0 } })).rejects.toThrow();
  expect(await prisma.diaCompensacaoCobertura.count()).toBe(0);
});
