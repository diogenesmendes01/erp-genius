import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedRelatoOfertaConfirmado } from "@/test/indisponibilidade-oferta";
import { carregarPeriodoIntegralTx } from "./periodo-integral-estado";
import { carregarUltimaCoberturaContinuidadeTx } from "./continuidade-cadeia-tx";
import { proporRegularizacaoPeriodoIntegral, decidirRegularizacaoPeriodoIntegral, consultarRegularizacoesPeriodoIntegral, aplicarRegularizacaoPeriodoIntegral } from "./periodo-integral";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { proporUtilizacaoCredito } from "@/server/financeiro/uso-credito-proposta";
import { decidirUtilizacaoCredito } from "@/server/financeiro/uso-credito-decisao";
import { saldoCreditoTx } from "@/server/financeiro/uso-credito-estado";
import { carregarContextoEncerramentoTx } from "./encerramento-contexto-tx";
import * as sessao from "@/server/_shared/sessao";

let matriculaId: string, cobrancaId: string, autorId: string, adminId: string;
const dados = () => ({ matriculaId, cobrancaId, escolha: "CREDITO" as const, clausula: "Contrato permite crédito por período sem oferta", evidenciaEscolha: "Aluno escolheu crédito em atendimento documentado", motivo: "Regularizar período sem oferta da escola", chaveIdempotencia: "regularizacao-integral-primeira" });
const decidir = (propostaId: string, aprovada = true) => decidirRegularizacaoPeriodoIntegral({ propostaId, aprovada, motivo: "Conferência independente da regularização" });
beforeEach(async () => {
  await truncarBanco(); const cat = await seedCatalogoMinimo();
  autorId = (await criarUsuario(["FINANCEIRO"])).id; adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Integral teste", paisId: cat.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: cat.pais.id, produtoId: cat.produto.id, moeda: "CRC", status: "ATIVA" } })).id;
  const doc = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato sintético", url: "/api/files/periodo-integral.pdf" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true, contratoDocumentoId: doc.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: adminId } });
  cobrancaId = (await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", valorOriginal: 300, valorNegociado: 300, moeda: "CRC", vencimento: new Date("2026-09-05"), coberturaInicio: new Date("2026-09-01"), coberturaFim: new Date("2026-09-30") } })).id;
  await seedRelatoOfertaConfirmado(matriculaId, "2026-09-01", "2026-09-30");
  authMock.mockResolvedValue({ user: { id: autorId } });
});

it("reconcilia pagamento parcial e prepara decisão sem disponibilizar crédito antecipadamente", async () => {
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-integral-parcial", valorRecebido: 100, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  const estado = await prisma.$transaction(tx => carregarPeriodoIntegralTx(tx, { matriculaId, cobrancaId, escolha: "CREDITO" }));
  expect(estado.snapshot.memoria).toMatchObject({ saldoADesobrigar: "200.00", creditoAConstituir: "100.00" });
  const antes = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  const recebimentos = await prisma.recebimento.findMany();
  const p = await proporRegularizacaoPeriodoIntegral(dados());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  expect(await proporRegularizacaoPeriodoIntegral(dados())).toEqual(p);
  expect(await decidir(p.dado.id)).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: adminId } });
  const d = await decidir(p.dado.id); expect(d).toMatchObject({ ok: true }); expect(await decidir(p.dado.id)).toEqual(d);
  const consulta = await consultarRegularizacoesPeriodoIntegral({ matriculaId, cobrancaId });
  expect(consulta).toMatchObject({ ok: true, dado: { podePropor: false, propostas: [{ aplicacaoPendente: true, podeDecidir: false, memoria: { moeda: "CRC", saldoADesobrigar: "200.00", creditoAConstituir: "100.00" } }] } });
  expect(JSON.stringify(consulta)).not.toMatch(/snapshot|entradaHash|snapshotHash/);
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toEqual(antes);
  expect(await prisma.recebimento.findMany()).toEqual(recebimentos);
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const contexto = await prisma.$transaction(tx => carregarContextoEncerramentoTx(tx, { alunoId: m.alunoId, matriculaId }));
  expect(contexto.cobrancas).toMatchObject([{ id: cobrancaId }]);
  expect(await prisma.creditoMatricula.count()).toBe(0);
  await expect(prisma.propostaPeriodoIntegral.update({ where: { id: p.dado.id }, data: { motivo: "Alteração posterior proibida" } })).rejects.toThrow();
  await expect(prisma.decisaoPeriodoIntegral.deleteMany()).rejects.toThrow();
});

it("mudança financeira após proposta impede aprovação e permite rejeição", async () => {
  const p = await proporRegularizacaoPeriodoIntegral(dados());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-altera-snapshot", valorRecebido: 50, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: adminId } });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: false });
  expect(await decidir(p.dado.id, false)).toMatchObject({ ok: true });
});

it("confere cobertura futura e não altera datas antes da aplicação", async () => {
  const p = await proporRegularizacaoPeriodoIntegral({ ...dados(), escolha: "COBERTURA_FUTURA", coberturaFutura: { inicio: "2026-10-01", fim: "2026-10-31" } });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  authMock.mockResolvedValue({ user: { id: adminId } });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: true });
  expect(await prisma.cobranca.findUnique({ where: { id: cobrancaId } })).toMatchObject({ coberturaInicio: new Date("2026-09-01"), coberturaFim: new Date("2026-09-30") });
  expect(await prisma.creditoMatricula.count()).toBe(0);
});

it("nega escopo cruzado, acesso docente e datas na escolha de crédito", async () => {
  expect(await proporRegularizacaoPeriodoIntegral({ ...dados(), matriculaId: "outra-matricula" })).toMatchObject({ ok: false });
  expect(await proporRegularizacaoPeriodoIntegral({ ...dados(), coberturaFutura: { inicio: "2026-10-01", fim: "2026-10-31" } })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: (await criarUsuario(["PROFESSOR"])).id } });
  expect(await consultarRegularizacoesPeriodoIntegral({ matriculaId, cobrancaId })).toMatchObject({ ok: false });
  expect(await proporRegularizacaoPeriodoIntegral(dados())).toMatchObject({ ok: false });
});

it("bloqueia aprovação quando surge sobreposição na cobertura futura, inclusive diretamente no banco", async () => {
  const p = await proporRegularizacaoPeriodoIntegral({ ...dados(), escolha: "COBERTURA_FUTURA", coberturaFutura: { inicio: "2026-10-01", fim: "2026-10-31" } });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", valorOriginal: 300, valorNegociado: 300, moeda: "CRC", vencimento: new Date("2026-10-05"), coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31") } });
  authMock.mockResolvedValue({ user: { id: adminId } });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: false });
  await expect(prisma.decisaoPeriodoIntegral.create({ data: { propostaId: p.dado.id, decisorId: adminId, aprovada: true, motivo: "Conferir sobreposição de cobertura", entradaHash: "a".repeat(64) } })).rejects.toThrow();
  expect(await decidir(p.dado.id, false)).toMatchObject({ ok: true });
});

it("preserva idempotência e recusa reaproveitar chave com escolha diferente", async () => {
  const p = await proporRegularizacaoPeriodoIntegral(dados());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  expect(await proporRegularizacaoPeriodoIntegral({ ...dados(), escolha: "COBERTURA_FUTURA", coberturaFutura: { inicio: "2026-10-01", fim: "2026-10-31" } })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: adminId } });
  expect(await decidir(p.dado.id)).toMatchObject({ ok: true });
  expect(await proporRegularizacaoPeriodoIntegral({ ...dados(), chaveIdempotencia: "nova-proposta-apos-aprovacao" })).toMatchObject({ ok: false });
  expect(await prisma.propostaPeriodoIntegral.count()).toBe(1);
});

async function aprovarCredito() {
  authMock.mockResolvedValue({ user: { id: autorId } });
  const p = await proporRegularizacaoPeriodoIntegral(dados());
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  authMock.mockResolvedValue({ user: { id: adminId } });
  const d = await decidir(p.dado.id);
  if (!d.ok || !d.dado) throw new Error(JSON.stringify(d));
  authMock.mockResolvedValue({ user: { id: autorId } });
  return { propostaId: p.dado.id, decisaoId: d.dado.id };
}

it("aplica crédito real uma vez, retira saldo não pago e conserva recebimentos", async () => {
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-aplicacao-100", valorRecebido: 100, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  const antes = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  const recebimentos = await prisma.recebimento.findMany();
  const { decisaoId } = await aprovarCredito();
  const app = await aplicarRegularizacaoPeriodoIntegral({ decisaoId });
  if (!app.ok) throw new Error(JSON.stringify(app));
  await expect(prisma.$transaction(tx => carregarUltimaCoberturaContinuidadeTx(tx, matriculaId))).rejects.toThrow();
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId })).toEqual(app);
  const c = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  expect(c).toMatchObject({ valorOriginal: antes.valorOriginal, valorRecebido: antes.valorRecebido, valorLiquidadoCredito: antes.valorLiquidadoCredito, vencimento: antes.vencimento, coberturaInicio: antes.coberturaInicio, coberturaFim: antes.coberturaFim, status: "PAGO", versao: antes.versao + 1 });
  expect(c.valorNegociado.toFixed(2)).toBe("100.00"); expect(c.saldo?.toFixed(2)).toBe("0.00");
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { matriculaId } });
  expect(credito.valorInicial.toFixed(2)).toBe("100.00"); expect(credito.origemPeriodoIntegralId).not.toBeNull();
  expect(await prisma.creditoMatricula.count()).toBe(1); expect(await prisma.aplicacaoPeriodoIntegral.count()).toBe(1);
  expect(await prisma.recebimento.findMany()).toEqual(recebimentos);
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const contexto = await prisma.$transaction(tx => carregarContextoEncerramentoTx(tx, { alunoId: m.alunoId, matriculaId }));
  expect(contexto.cobrancas).toEqual([]);
  expect(contexto.regularizacoesPeriodoIntegral).toHaveLength(1);
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-apos-regularizacao", valorRecebido: 1, forma: "DINHEIRO" })).toMatchObject({ ok: false });
  await expect(prisma.cobranca.update({ where: { id: cobrancaId }, data: { valorNegociado: 300, saldo: 200, status: "PENDENTE" } })).rejects.toThrow();
  await expect(prisma.aplicacaoPeriodoIntegral.deleteMany()).rejects.toThrow();
  const consulta = await consultarRegularizacoesPeriodoIntegral({ matriculaId, cobrancaId });
  expect(consulta).toMatchObject({ ok: true, dado: { podePropor: false, propostas: [{ aplicacaoPendente: false }] } });
  expect(await proporRegularizacaoPeriodoIntegral(dados())).toMatchObject({ ok: true, dado: { aplicacaoPendente: false, decisao: { aplicacao: { credito: { valor: "100.00" } } } } });
  const proposta = await prisma.propostaPeriodoIntegral.findFirstOrThrow({ where: { cobrancaId } });
  authMock.mockResolvedValue({ user: { id: adminId } });
  expect(await decidir(proposta.id)).toMatchObject({ ok: true, dado: { aplicacao: { credito: { valor: "100.00" } } } });
});

it("reprograma a mesma mensalidade preservando valores/vencimento e aceita pagamento posterior", async () => {
  const antes = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  const p = await proporRegularizacaoPeriodoIntegral({ ...dados(), escolha: "COBERTURA_FUTURA", coberturaFutura: { inicio: "2026-10-01", fim: "2026-10-31" } });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  authMock.mockResolvedValue({ user: { id: adminId } });
  const d = await decidir(p.dado.id); if (!d.ok || !d.dado) throw new Error(JSON.stringify(d));
  expect(await prisma.$transaction(tx => carregarUltimaCoberturaContinuidadeTx(tx, matriculaId))).toMatchObject({ id: cobrancaId, coberturaInicio: new Date("2026-09-01"), coberturaFim: new Date("2026-09-30") });
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: d.dado.id })).toMatchObject({ ok: true });
  expect(await prisma.$transaction(tx => carregarUltimaCoberturaContinuidadeTx(tx, matriculaId))).toMatchObject({ id: cobrancaId, coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31"), vencimento: antes.vencimento });
  const c = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  expect(c).toMatchObject({ id: antes.id, coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31"), valorOriginal: antes.valorOriginal, valorNegociado: antes.valorNegociado, valorRecebido: antes.valorRecebido, valorLiquidadoCredito: antes.valorLiquidadoCredito, saldo: antes.saldo, moeda: antes.moeda, vencimento: antes.vencimento, status: antes.status, versao: antes.versao + 1 });
  const app = await prisma.aplicacaoPeriodoIntegral.findFirstOrThrow();
  expect(app.snapshot).toMatchObject({ memoria: { cobertura: { inicio: "2026-09-01", fim: "2026-09-30" } } });
  expect(await prisma.creditoMatricula.count()).toBe(0); expect(await prisma.cobranca.count()).toBe(1);
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const contexto = await prisma.$transaction(tx => carregarContextoEncerramentoTx(tx, { alunoId: m.alunoId, matriculaId }));
  expect(contexto.cobrancas).toMatchObject([{ id: cobrancaId, coberturaInicio: "2026-10-01", coberturaFim: "2026-10-31" }]);
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-cobertura-reprogramada", valorRecebido: 100, forma: "DINHEIRO" })).toMatchObject({ ok: true });
});

it("desobriga período não pago sem criar crédito de valor zero", async () => {
  const { decisaoId } = await aprovarCredito();
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId })).toMatchObject({ ok: true });
  const c = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  expect(c.valorNegociado.toFixed(2)).toBe("0.00"); expect(c.saldo?.toFixed(2)).toBe("0.00");
  expect(await prisma.creditoMatricula.count()).toBe(0); expect(await prisma.recebimento.count()).toBe(0);
});

it("não executa decisão cuja cobrança mudou após aprovação nem aceita executor docente", async () => {
  const { decisaoId } = await aprovarCredito();
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-apos-aprovar", valorRecebido: 50, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: (await criarUsuario(["PROFESSOR"])).id } });
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId })).toMatchObject({ ok: false });
  expect(await prisma.aplicacaoPeriodoIntegral.count()).toBe(0); expect(await prisma.creditoMatricula.count()).toBe(0);
});

it("devolve liquidação prévia com crédito sem restaurar o saldo da origem já utilizada", async () => {
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "credito-origem-pagamento", valorRecebido: 100, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  const { decisaoId } = await aprovarCredito();
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId })).toMatchObject({ ok: true });
  const creditoAnterior = await prisma.creditoMatricula.findFirstOrThrow();
  const destino = await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", valorOriginal: 300, valorNegociado: 300, moeda: "CRC", vencimento: new Date("2026-10-05"), coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31") } });
  const uso = await proporUtilizacaoCredito({ creditoId: creditoAnterior.id, cobrancaId: destino.id, valor: "100", concordancia: "Aluno solicita uso nesta mensalidade", motivo: "Aplicar crédito disponível", chaveIdempotencia: "uso-credito-periodo-integral" });
  if (!uso.ok || !uso.dado) throw new Error(JSON.stringify(uso));
  authMock.mockResolvedValue({ user: { id: adminId } });
  expect(await decidirUtilizacaoCredito({ propostaId: uso.dado.id, aprovar: true, motivo: "Uso conferido por outra pessoa" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect(await registrarPagamento(destino.id, { chaveIdempotencia: "pagamento-destino-parcial", valorRecebido: 50, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  await seedRelatoOfertaConfirmado(matriculaId, "2026-10-01", "2026-10-31");
  const p = await proporRegularizacaoPeriodoIntegral({ ...dados(), cobrancaId: destino.id, chaveIdempotencia: "regularizacao-periodo-destino" });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  expect(p.dado.memoria).toMatchObject({ creditoPorRecebimentos: "50.00", creditoPorLiquidacaoPrevia: "100.00", creditoAConstituir: "150.00", saldoADesobrigar: "150.00" });
  authMock.mockResolvedValue({ user: { id: adminId } });
  const d = await decidir(p.dado.id); if (!d.ok || !d.dado) throw new Error(JSON.stringify(d));
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: d.dado.id })).toMatchObject({ ok: true });
  const novo = await prisma.creditoMatricula.findFirstOrThrow({ where: { id: { not: creditoAnterior.id } } });
  expect(novo.valorInicial.toFixed(2)).toBe("150.00");
  expect((await prisma.$transaction(tx => saldoCreditoTx(tx, creditoAnterior.id))).toFixed(2)).toBe("0.00");
  expect(await prisma.decisaoUsoCredito.count({ where: { aprovada: true } })).toBe(1);
  expect(await prisma.recebimento.count()).toBe(2);
});

it("reverte toda a aplicação se a origem de crédito não for criada na mesma transação", async () => {
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-transacao-atomica", valorRecebido: 100, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  const { propostaId, decisaoId } = await aprovarCredito();
  const p = await prisma.propostaPeriodoIntegral.findUniqueOrThrow({ where: { id: propostaId } });
  const antes = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  await expect(prisma.aplicacaoPeriodoIntegral.create({ data: { matriculaId, cobrancaId, decisaoId, executorId: autorId, snapshot: p.snapshot!, snapshotHash: p.snapshotHash, entradaHash: p.entradaHash } })).rejects.toThrow(/mesma transação/);
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toEqual(antes);
  expect(await prisma.aplicacaoPeriodoIntegral.count()).toBe(0); expect(await prisma.creditoMatricula.count()).toBe(0);
});

it("duas execuções simultâneas retornam a mesma aplicação e um único crédito", async () => {
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-concorrencia", valorRecebido: 100, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  const { decisaoId } = await aprovarCredito();
  // Evita corrida do import dinâmico NextAuth no runner; autorização transacional e locks continuam reais.
  const autenticacao = vi.spyOn(sessao, "exigirSessaoComPapel").mockResolvedValue({ id: autorId, nome: "Financeiro sintético", papeis: ["FINANCEIRO"] });
  try {
    const resultados = await Promise.all([aplicarRegularizacaoPeriodoIntegral({ decisaoId }), aplicarRegularizacaoPeriodoIntegral({ decisaoId })]);
    expect(resultados[0], JSON.stringify(resultados)).toMatchObject({ ok: true });
    expect(resultados[1], JSON.stringify(resultados)).toEqual(resultados[0]);
  } finally { autenticacao.mockRestore(); }
  expect(await prisma.aplicacaoPeriodoIntegral.count()).toBe(1); expect(await prisma.creditoMatricula.count()).toBe(1);
});

it("reconfere aprovação obsoleta em nova versão, exigindo outra aprovação e preservando a anterior", async () => {
  const primeira = await aprovarCredito();
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-entre-versoes", valorRecebido: 50, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  const segunda = await proporRegularizacaoPeriodoIntegral({ ...dados(), chaveIdempotencia: "reconferencia-versao-dois", motivo: "Reconferir pagamento registrado após aprovação" });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado).toMatchObject({ versao: 2, memoria: { creditoAConstituir: "50.00" } });
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: primeira.decisaoId })).toMatchObject({ ok: false });
  expect(await decidir(segunda.dado.id)).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: adminId } });
  const decisao = await decidir(segunda.dado.id); if (!decisao.ok || !decisao.dado) throw new Error(JSON.stringify(decisao));
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: decisao.dado.id })).toMatchObject({ ok: true });
  expect((await prisma.creditoMatricula.findFirstOrThrow()).valorInicial.toFixed(2)).toBe("50.00");
  expect(await prisma.decisaoPeriodoIntegral.findUniqueOrThrow({ where: { id: primeira.decisaoId } })).toMatchObject({ aprovada: true });
  const historico = await consultarRegularizacoesPeriodoIntegral({ matriculaId, cobrancaId });
  expect(historico).toMatchObject({ ok: true, dado: { propostas: [{ versao: 2, aplicacaoPendente: false }, { versao: 1, superada: true, podeAplicar: false }] } });
});

it("reconfere cobertura futura que ficou sobreposta sem modificar a cobrança de origem", async () => {
  const p = await proporRegularizacaoPeriodoIntegral({ ...dados(), escolha: "COBERTURA_FUTURA", coberturaFutura: { inicio: "2026-10-01", fim: "2026-10-31" } });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  authMock.mockResolvedValue({ user: { id: adminId } });
  const d = await decidir(p.dado.id); if (!d.ok || !d.dado) throw new Error(JSON.stringify(d));
  await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", valorOriginal: 300, valorNegociado: 300, moeda: "CRC", vencimento: new Date("2026-10-05"), coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31") } });
  authMock.mockResolvedValue({ user: { id: autorId } });
  const nova = await proporRegularizacaoPeriodoIntegral({ ...dados(), escolha: "COBERTURA_FUTURA", coberturaFutura: { inicio: "2026-11-01", fim: "2026-11-30" }, chaveIdempotencia: "reconferir-conflito-futuro" });
  if (!nova.ok || !nova.dado) throw new Error(JSON.stringify(nova));
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: d.dado.id })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: adminId } });
  const nd = await decidir(nova.dado.id); if (!nd.ok || !nd.dado) throw new Error(JSON.stringify(nd));
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: nd.dado.id })).toMatchObject({ ok: true });
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toMatchObject({ coberturaInicio: new Date("2026-11-01"), coberturaFim: new Date("2026-11-30") });
});

it("regulariza novas indisponibilidades da mesma mensalidade reprogramada, até crédito final", async () => {
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-cobertura-sucessiva", valorRecebido: 100, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  const recebimentos = await prisma.recebimento.findMany();
  const decisoes: string[] = [];
  for (const [indice, coberturaFutura] of [{ inicio: "2026-10-01", fim: "2026-10-31" }, { inicio: "2026-11-01", fim: "2026-11-30" }].entries()) {
    authMock.mockResolvedValue({ user: { id: autorId } });
    if (indice > 0) await seedRelatoOfertaConfirmado(matriculaId, "2026-10-01", "2026-10-31");
    const p = await proporRegularizacaoPeriodoIntegral({ ...dados(), escolha: "COBERTURA_FUTURA", coberturaFutura, chaveIdempotencia: `reprogramacao-sucessiva-${indice}` });
    if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
    authMock.mockResolvedValue({ user: { id: adminId } });
    const d = await decidir(p.dado.id); if (!d.ok || !d.dado) throw new Error(JSON.stringify(d));
    decisoes.push(d.dado.id);
    expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: d.dado.id })).toMatchObject({ ok: true });
  }
  await seedRelatoOfertaConfirmado(matriculaId, "2026-11-01", "2026-11-30");
  authMock.mockResolvedValue({ user: { id: autorId } });
  const p = await proporRegularizacaoPeriodoIntegral({ ...dados(), chaveIdempotencia: "credito-apos-duas-reprogramacoes" });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  authMock.mockResolvedValue({ user: { id: adminId } });
  const d = await decidir(p.dado.id); if (!d.ok || !d.dado) throw new Error(JSON.stringify(d));
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: d.dado.id })).toMatchObject({ ok: true });
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: decisoes[0] })).toMatchObject({ ok: true });
  expect(await prisma.cobranca.count()).toBe(1); expect(await prisma.aplicacaoPeriodoIntegral.count()).toBe(3); expect(await prisma.creditoMatricula.count()).toBe(1);
  expect((await prisma.creditoMatricula.findFirstOrThrow()).valorInicial.toFixed(2)).toBe("100.00");
  expect(await prisma.recebimento.findMany()).toEqual(recebimentos);
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toMatchObject({ coberturaInicio: new Date("2026-11-01"), status: "PAGO" });
  expect(await proporRegularizacaoPeriodoIntegral({ ...dados(), chaveIdempotencia: "bloquear-depois-credito-final" })).toMatchObject({ ok: false });
});

it("rejeitar reconferência não restaura autorização antiga e permite outra proposta conferida", async () => {
  const primeira = await aprovarCredito();
  expect(await registrarPagamento(cobrancaId, { chaveIdempotencia: "pagamento-reconferencia-rejeitada", valorRecebido: 50, forma: "DINHEIRO" })).toMatchObject({ ok: true });
  const p = await proporRegularizacaoPeriodoIntegral({ ...dados(), chaveIdempotencia: "reconferencia-que-sera-rejeitada" });
  if (!p.ok || !p.dado) throw new Error(JSON.stringify(p));
  authMock.mockResolvedValue({ user: { id: adminId } });
  expect(await decidir(p.dado.id, false)).toMatchObject({ ok: true });
  expect(await aplicarRegularizacaoPeriodoIntegral({ decisaoId: primeira.decisaoId })).toMatchObject({ ok: false });
  authMock.mockResolvedValue({ user: { id: autorId } });
  const nova = await proporRegularizacaoPeriodoIntegral({ ...dados(), chaveIdempotencia: "reconferencia-depois-rejeicao" });
  expect(nova).toMatchObject({ ok: true, dado: { versao: 3 } });
  expect(await prisma.aplicacaoPeriodoIntegral.count()).toBe(0);
});

it("mudar apenas a escolha não permite substituir uma aprovação ainda válida", async () => {
  const primeira = await aprovarCredito();
  expect(await proporRegularizacaoPeriodoIntegral({ ...dados(), escolha: "COBERTURA_FUTURA", coberturaFutura: { inicio: "2026-10-01", fim: "2026-10-31" }, chaveIdempotencia: "tentativa-mudar-escolha-valida" })).toMatchObject({ ok: false });
  const estado = await prisma.$transaction(tx => carregarPeriodoIntegralTx(tx, { matriculaId, cobrancaId, escolha: "COBERTURA_FUTURA" }));
  await expect(prisma.propostaPeriodoIntegral.create({ data: {
    versao: 2, anteriorId: primeira.propostaId, matriculaId, cobrancaId, documentoId: estado.snapshot.documentoId,
    escolha: "COBERTURA_FUTURA", coberturaFuturaInicio: new Date("2026-10-01"), coberturaFuturaFim: new Date("2026-10-31"),
    clausula: dados().clausula, evidenciaEscolha: dados().evidenciaEscolha, motivo: dados().motivo, autorId,
    chaveIdempotencia: "troca-sem-mudanca-fonte-sql", entradaHash: "a".repeat(64), snapshot: estado.snapshot, snapshotHash: estado.hash,
  } })).rejects.toThrow();
  expect(await prisma.propostaPeriodoIntegral.count()).toBe(1);
});
