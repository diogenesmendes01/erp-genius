import { carregarContextoEncerramentoTx } from "./encerramento-contexto-tx";
import { carregarDependenciasFinanceirasAulaTx } from "@/server/diario/correcao-aula-financeiro-tx";
import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: async (...papeis: import("@prisma/client").Papel[]) => {
    const session = await authMock(); const u = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, nome: true, papeis: true, ativo: true } });
    if (!u.ativo) throw new real.ErroPermissao(); real.exigirPapel(u, ...papeis); return u;
  } };
});
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarCompraHorasAntecipadas, consultarComprasHorasAntecipadas } from "./compra-horas";
import { reservarHorasCompradasParaEncontro } from "./reserva-horas-compradas";
import { conferirRealizacaoHoras } from "./consumo-horas";
import { salvarDiarioParticular } from "@/server/diario/particular";
import { proporCancelamentoParticular, decidirCancelamentoParticular } from "@/server/agenda/cancelamento-particular";
import { proporLiberacaoHorasRemarcacao, decidirLiberacaoHorasRemarcacao } from "./liberacao-horas";
import { proporRemarcacaoParticular, decidirRemarcacaoParticular } from "@/server/agenda/remarcacao-particular";
import { prepararCalendarioEscolar } from "@/server/agenda/calendario";
import { decidirCalendarioEscolar } from "@/server/agenda/calendario-decisao";
import { proporUtilizacaoCredito, consultarPropostasUsoCredito } from "@/server/financeiro/uso-credito-proposta";
import { decidirUtilizacaoCredito } from "@/server/financeiro/uso-credito-decisao";
import { cancelarDevolucaoCredito, conciliarDevolucaoCredito, decidirDevolucaoCredito, proporDevolucaoCredito, registrarExecucaoDevolucaoCredito } from "@/server/financeiro/devolucao-credito";
import { receberTx } from "@/server/financeiro/recebimentos";
import { pagamentoConfirmado } from "@/server/financeiro/regras";
import { kpisFinanceiro } from "@/server/financeiro/consultas";
let input: Parameters<typeof registrarCompraHorasAntecipadas>[0], usuarioId: string;
beforeEach(async () => {
  await truncarBanco(); const cat = await seedCatalogoMinimo(); const u = await criarUsuario(["FINANCEIRO"]); usuarioId = u.id;
  authMock.mockResolvedValue({ user: { id: u.id } });
  const a = await prisma.aluno.create({ data: { primeiroNome: "Compra de horas", paisId: cat.pais.id } });
  const m = await prisma.matricula.create({ data: { alunoId: a.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "ATIVA" } });
  const doc = await prisma.documento.create({ data: { matriculaId: m.id, categoria: "CONTRATO", nome: "Contrato fictício", url: "/api/files/horas.pdf" } });
  await prisma.matricula.update({ where: { id: m.id }, data: { contratoOk: true, contratoDocumentoId: doc.id, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: u.id } });
  const c = await prisma.cobranca.create({ data: { matriculaId: m.id, tipo: "HORA_PARTICULAR", moeda: "CRC", valorOriginal: 360, valorNegociado: 300, valorRecebido: 0, saldo: 300, status: "PENDENTE", vencimento: new Date("2026-09-01") } });
  await prisma.$transaction((tx) => receberTx(tx, { cobrancaId: c.id, chaveIdempotencia: "pagamento-horas", autorId: u.id, valorRecebido: 300, moeda: "CRC", forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-01"), evidencia: "Comprovante de compra de horas" }));
  const cobrancaPaga = await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } });
  input = { alunoId: a.id, matriculaId: m.id, cobrancaId: c.id, versaoCobranca: cobrancaPaga.versao, minutosComprados: 180, evidenciaCondicoes: "Compra contratada conferida", chaveIdempotencia: "compra-horas-teste" };
});
it("registra uma compra idempotente sem duplicar recebimento e preserva valores originais", async () => {
  const consultar = { alunoId: input.alunoId, matriculaId: input.matriculaId };
  expect(await consultarComprasHorasAntecipadas(consultar)).toMatchObject({ ok: true, dado: { compras: [], cobrancas: [{ id: input.cobrancaId }] } });
  const antes = await prisma.recebimento.findMany();
  const [a, b] = await Promise.all([registrarCompraHorasAntecipadas(input), registrarCompraHorasAntecipadas(input)]);
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a);
  expect(await prisma.compraHorasAntecipadas.count()).toBe(1);
  const c = await prisma.compraHorasAntecipadas.findFirstOrThrow();
  expect(c.minutosComprados).toBe(180); expect(c.descontoOriginal.toFixed(2)).toBe("60.00"); expect(c.valorPagoAlocado.toFixed(2)).toBe("300.00");
  expect(await prisma.recebimento.findMany()).toEqual(antes);
  const consulta = await consultarComprasHorasAntecipadas(consultar);
  expect(consulta).toMatchObject({ ok: true, dado: { compras: [{ id: c.id, minutosComprados: 180, valorPagoAlocado: "300.00" }], cobrancas: [] } });
  expect((await consultarComprasHorasAntecipadas({ ...consultar, alunoId: "outro" })).ok).toBe(false);
  expect((await registrarCompraHorasAntecipadas({ ...input, minutosComprados: 240 })).ok).toBe(false);
  expect((await registrarCompraHorasAntecipadas({ ...input, chaveIdempotencia: "segunda-compra-mesma-cobranca" })).ok).toBe(false);
  await expect(prisma.compraHorasAntecipadas.update({ where: { id: c.id }, data: { minutosComprados: 240 } })).rejects.toThrow();
  await expect(prisma.compraHorasAntecipadas.delete({ where: { id: c.id } })).rejects.toThrow();
});
it("recusa outro aluno, versão antiga e cobrança mensal", async () => {
  expect((await registrarCompraHorasAntecipadas({ ...input, alunoId: "outro" })).ok).toBe(false);
  expect((await registrarCompraHorasAntecipadas({ ...input, versaoCobranca: input.versaoCobranca + 1 })).ok).toBe(false);
  await prisma.cobranca.update({ where: { id: input.cobrancaId }, data: { tipo: "MENSALIDADE" } });
  expect((await registrarCompraHorasAntecipadas(input)).ok).toBe(false);
  expect(await prisma.compraHorasAntecipadas.count()).toBe(0);
});
it("não cria saldo a partir de pagamento inconsistente ou contrato indisponível", async () => {
  await expect(prisma.cobranca.update({ where: { id: input.cobrancaId }, data: { valorRecebido: 200 } })).rejects.toThrow(/destinações|créditos/i);
  expect((await registrarCompraHorasAntecipadas(input)).ok).toBe(true);
  await prisma.documento.updateMany({ data: { arquivado: true } });
  expect((await registrarCompraHorasAntecipadas({ ...input, chaveIdempotencia: "compra-contrato-arquivado" })).ok).toBe(false);
  expect(await prisma.compraHorasAntecipadas.count()).toBe(1);
});
it("professor e financeiro desativado não registram compra", async () => {
  await prisma.usuario.update({ where: { id: usuarioId }, data: { papeis: ["PROFESSOR"] } });
  expect((await registrarCompraHorasAntecipadas(input)).ok).toBe(false);
  expect((await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: input.matriculaId })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: usuarioId }, data: { papeis: ["FINANCEIRO"], ativo: false } });
  expect((await registrarCompraHorasAntecipadas(input)).ok).toBe(false);
});

it("reserva horas com concorrência sem exceder a compra nem duplicar encontro", async () => {
  const compra = await registrarCompraHorasAntecipadas(input);
  if (!compra.ok || !compra.dado) throw new Error("Compra ausente");
  const professor = await criarUsuario(["PROFESSOR"]);
  const encontros = [];
  for (const dia of [1, 2]) encontros.push(await prisma.encontroAgenda.create({ data: { matriculaId: input.matriculaId, professorId: professor.id, preparadorId: usuarioId, inicio: new Date(`2099-10-0${dia}T12:00:00Z`), fim: new Date(`2099-10-0${dia}T14:00:00Z`), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Particular contratada", chaveIdempotencia: `teste-horas-${dia}`, entradaHash: "fixture" } }));
  const pedidos = encontros.map((e, i) => ({ compraId: compra.dado!.id, encontroId: e.id, motivo: "Usar compra paga neste encontro", chaveIdempotencia: `reserva-horas-${i}` }));
  const resultados = await Promise.all(pedidos.map(d => reservarHorasCompradasParaEncontro(d)));
  expect(resultados.filter(r => r.ok)).toHaveLength(1);
  const vencedor = resultados.findIndex(r => r.ok);
  expect(await reservarHorasCompradasParaEncontro(pedidos[vencedor])).toEqual(resultados[vencedor]);
  expect((await reservarHorasCompradasParaEncontro({ ...pedidos[vencedor], chaveIdempotencia: "outra-chave-reserva" })).ok).toBe(false);
  expect(await prisma.reservaHorasCompradas.count()).toBe(1);
  const r = await prisma.reservaHorasCompradas.findFirstOrThrow();
  expect(r.minutos).toBe(120);
  const consulta = await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: input.matriculaId });
  expect(consulta).toMatchObject({ ok: true, dado: { compras: [{ minutosReservados: 120, minutosDisponiveis: 60 }] } });
  await expect(prisma.reservaHorasCompradas.update({ where: { id: r.id }, data: { minutos: 60 } })).rejects.toThrow();
  const perdedor = encontros[1 - vencedor];
  await expect(prisma.reservaHorasCompradas.create({ data: { compraId: r.compraId, encontroId: perdedor.id, autorId: usuarioId, minutos: 120, inicio: perdedor.inicio, fim: perdedor.fim, motivo: "Tentativa sem saldo suficiente", chaveIdempotencia: "sql-sem-saldo", entradaHash: "fixture" } })).rejects.toThrow("Saldo de horas insuficiente");
  expect(await prisma.recebimento.count()).toBe(1);
});

it("reserva recusa outro contrato e matrícula pausada", async () => {
  const compra = await registrarCompraHorasAntecipadas(input);
  if (!compra.ok || !compra.dado) throw new Error("Compra ausente");
  const original = await prisma.matricula.findUniqueOrThrow({ where: { id: input.matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId: input.alunoId, produtoId: original.produtoId, paisId: original.paisId, moeda: original.moeda, status: "ATIVA" } });
  const professor = await criarUsuario(["PROFESSOR"]);
  const e = await prisma.encontroAgenda.create({ data: { matriculaId: outra.id, professorId: professor.id, preparadorId: usuarioId, inicio: new Date("2099-10-01T12:00:00Z"), fim: new Date("2099-10-01T13:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outro contrato do aluno", chaveIdempotencia: "outro-contrato-horas", entradaHash: "fixture" } });
  const d = { compraId: compra.dado.id, encontroId: e.id, motivo: "Conferência de contrato", chaveIdempotencia: "contrato-reserva-horas" };
  expect((await reservarHorasCompradasParaEncontro(d)).ok).toBe(false);
  await prisma.encontroAgenda.update({ where: { id: e.id }, data: { matriculaId: original.id } });
  await prisma.matricula.update({ where: { id: original.id }, data: { status: "PAUSADA" } });
  expect((await reservarHorasCompradasParaEncontro(d)).ok).toBe(false);
  expect(await prisma.reservaHorasCompradas.count()).toBe(0);
});

it("realização consome uma vez sem exigir gravação ou gerar novo recebimento", async () => {
  const compra = await registrarCompraHorasAntecipadas(input);
  if (!compra.ok || !compra.dado) throw new Error("Compra ausente");
  const professor = await criarUsuario(["PROFESSOR"]);
  const e = await prisma.encontroAgenda.create({ data: { matriculaId: input.matriculaId, professorId: professor.id, preparadorId: usuarioId, inicio: new Date("2099-10-01T12:00:00Z"), fim: new Date("2099-10-01T13:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula para consumo", chaveIdempotencia: "encontro-consumo", entradaHash: "fixture" } });
  const reserva = await reservarHorasCompradasParaEncontro({ compraId: compra.dado.id, encontroId: e.id, motivo: "Reserva para aula contratada", chaveIdempotencia: "reserva-consumo" });
  if (!reserva.ok || !reserva.dado) throw new Error("Reserva ausente");
  const alvo = { reservaId: reserva.dado.id };
  expect((await conferirRealizacaoHoras(alvo)).ok).toBe(false);
  const aula = await prisma.aulaDiario.create({ data: { encontroId: e.id, professorId: professor.id, ocorridaEm: e.inicio, conteudo: "Conversação realizada", registros: { create: { alunoId: input.alunoId, nomeAluno: "Aluno teste", presente: false } } } });
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2099-10-02T12:00:00Z"));
    expect((await conferirRealizacaoHoras(alvo)).ok).toBe(false);
    await expect(prisma.consumoHorasCompradas.create({ data: { reservaId: alvo.reservaId, autorId: usuarioId, motivo: "Consumo sem presença comprovada", estadoDiario: "a".repeat(64) } })).rejects.toThrow("exige presença");
    await expect(prisma.consumoHorasCompradas.create({ data: { reservaId: alvo.reservaId, autorId: professor.id, motivo: "Professor não confirma consumo", estadoDiario: "a".repeat(64) } })).rejects.toThrow("sem permissão");
    await prisma.registroAulaAluno.updateMany({ where: { aulaId: aula.id }, data: { presente: true } });
    const revisao = await conferirRealizacaoHoras(alvo);
    if (!revisao.ok || !revisao.dado) throw new Error("Revisão ausente");
    const confirmar = { ...alvo, estadoDiario: revisao.dado.estadoDiario, motivo: "Realização conferida pelo Financeiro" };
    await prisma.aulaDiario.update({ where: { id: aula.id }, data: { conteudo: "Conteúdo corrigido antes do consumo" } });
    expect((await conferirRealizacaoHoras(confirmar)).ok).toBe(false);
    const atual = await conferirRealizacaoHoras(alvo);
    if (!atual.ok || !atual.dado) throw new Error("Revisão atual ausente");
    confirmar.estadoDiario = atual.dado.estadoDiario;
    const resultados = await Promise.all([conferirRealizacaoHoras(confirmar), conferirRealizacaoHoras(confirmar)]);
    expect(resultados[0]).toMatchObject({ ok: true }); expect(resultados[1]).toEqual(resultados[0]);
    expect(await prisma.consumoHorasCompradas.count()).toBe(1);
    const vinculosCorrecao = await prisma.$transaction(tx => carregarDependenciasFinanceirasAulaTx(tx, e.id, [input.matriculaId]));
    const consumo = await prisma.consumoHorasCompradas.findUniqueOrThrow({ where: { reservaId: alvo.reservaId } });
    expect(vinculosCorrecao).toEqual({ exigeConferenciaFinanceira: true, ocorrencias: [],
      reservas: [{ id: alvo.reservaId, matriculaId: input.matriculaId, consumoId: consumo.id, liberacoesAprovadas: [] }] });
    expect(JSON.stringify(vinculosCorrecao)).not.toMatch(/valor|moeda|snapshot|minutos/);
    await expect(prisma.$transaction(tx => carregarDependenciasFinanceirasAulaTx(tx, e.id, ["outro-contrato"]))).rejects.toThrow("não correspondem");
    const consulta = await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: input.matriculaId });
    expect(consulta).toMatchObject({ ok: true, dado: { compras: [{ minutosReservados: 0, minutosConsumidos: 60, minutosDisponiveis: 120 }] } });
    expect(await prisma.encontroAgenda.findUnique({ where: { id: e.id } })).toMatchObject({ status: "PREVISTO" });
    expect(await prisma.recebimento.count()).toBe(1);
    await expect(prisma.consumoHorasCompradas.deleteMany()).rejects.toThrow();
    await expect(prisma.aulaDiario.update({ where: { id: aula.id }, data: { conteudo: "Reescrita indevida" } })).rejects.toThrow("revisão financeira");
    await expect(prisma.registroAulaAluno.updateMany({ where: { aulaId: aula.id }, data: { presente: false } })).rejects.toThrow("revisão financeira");
    await expect(prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "CANCELADO" } })).rejects.toThrow("revisão financeira");
    await prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "MINISTRADO" } });
    expect(await prisma.encontroAgenda.findUnique({ where: { id: e.id } })).toMatchObject({ status: "MINISTRADO" });
    await expect(prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "MINISTRADO" } })).rejects.toThrow("histórico");
    expect(await prisma.consumoHorasCompradas.count()).toBe(1);
    authMock.mockResolvedValue({ user: { id: professor.id } });
    expect((await salvarDiarioParticular({ encontroId: e.id, aulaId: aula.id, estadoAnterior: confirmar.estadoDiario, ocorridaEm: e.inicio.toISOString(), conteudo: "Alteração após consumo", registros: [{ alunoId: input.alunoId, presente: false }] })).ok).toBe(false);
  } finally { vi.useRealTimers(); }
});

async function prepararReservaParaLiberacao() {
  const compra = await registrarCompraHorasAntecipadas(input);
  if (!compra.ok || !compra.dado) throw new Error("Compra ausente");
  const prof = await criarUsuario(["PROFESSOR"]), gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const encontro = await prisma.encontroAgenda.create({ data: { matriculaId: input.matriculaId, professorId: prof.id, preparadorId: gestor.id, inicio: new Date("2099-10-10T15:00:00Z"), fim: new Date("2099-10-10T17:00:00Z"), fusoOrigem: "America/Sao_Paulo", status: "PREVISTO", motivo: "Encontro contratado", chaveIdempotencia: "liberacao-encontro", entradaHash: "fixture" } });
  const reserva = await reservarHorasCompradasParaEncontro({ compraId: compra.dado.id, encontroId: encontro.id, motivo: "Reservar horas pagas", chaveIdempotencia: "liberacao-reserva" });
  if (!reserva.ok || !reserva.dado) throw new Error("Reserva ausente");
  return { compraId: compra.dado.id, reservaId: reserva.dado.id, encontro, prof, gestor };
}
async function cancelarPelaEscola(c: Awaited<ReturnType<typeof prepararReservaParaLiberacao>>, origem?: "ALUNO") {
  authMock.mockResolvedValue({ user: { id: c.prof.id } });
  const p = await proporCancelamentoParticular({ encontroId: c.encontro.id, motivo: origem ? "Aluno solicitou cancelamento" : "Escola não poderá realizar encontro", chaveIdempotencia: "liberacao-cancelar", ...(origem ? { origem } : {}) });
  if (!p.ok || !p.dado) throw new Error("Cancelamento ausente");
  authMock.mockResolvedValue({ user: { id: c.gestor.id } });
  const d = await decidirCancelamentoParticular({ propostaId: p.dado.id, aprovar: true, motivo: "Cancelamento conferido pela gestão" });
  if (!d.ok || !d.dado) throw new Error("Decisão ausente");
  authMock.mockResolvedValue({ user: { id: usuarioId } });
  return d.dado.id;
}
it("libera horas para remarcação com escolha documentada e aprovação independente, sem duplicar saldo ou pagamento", async () => {
  const c = await prepararReservaParaLiberacao(); await cancelarPelaEscola(c);
  const consulta = { alunoId: input.alunoId, matriculaId: input.matriculaId };
  const pagamentos = await prisma.recebimento.findMany();
  const entrada = { reservaId: c.reservaId, evidenciaEscolhaRemarcacao: "Aluno escolheu remarcação no atendimento institucional", motivo: "Liberar reserva de encontro cancelado pela escola", chaveIdempotencia: "liberacao-primeira" };
  const [a, b] = await Promise.all([proporLiberacaoHorasRemarcacao(entrada), proporLiberacaoHorasRemarcacao(entrada)]);
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a); if (!a.ok || !a.dado) throw new Error("Liberação ausente");
  expect(await consultarComprasHorasAntecipadas(consulta)).toMatchObject({ ok: true, dado: { compras: [{ minutosDisponiveis: 60, minutosReservados: 120 }] } });
  const d = { propostaId: a.dado.id, aprovar: true, motivo: "Escolha do aluno e cancelamento conferidos" };
  await prisma.usuario.update({ where: { id: usuarioId }, data: { papeis: ["FINANCEIRO", "ADMINISTRADOR"] } });
  expect(await decidirLiberacaoHorasRemarcacao(d)).toMatchObject({ ok: false, erro: expect.stringContaining("Outra pessoa") });
  await expect(prisma.decisaoLiberacaoHoras.create({ data: { propostaId: d.propostaId, reservaId: c.reservaId, decisorId: usuarioId, aprovada: true, motivo: d.motivo } })).rejects.toThrow("independente");
  const aprovador = await criarUsuario(["FINANCEIRO"]); authMock.mockResolvedValue({ user: { id: aprovador.id } });
  expect(await decidirLiberacaoHorasRemarcacao(d)).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: aprovador.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  const [r, repetida] = await Promise.all([decidirLiberacaoHorasRemarcacao(d), decidirLiberacaoHorasRemarcacao(d)]);
  expect(r.ok, r.ok ? undefined : r.erro).toBe(true); expect(repetida).toEqual(r);
  const liberacaoConferida = await prisma.decisaoLiberacaoHoras.findUniqueOrThrow({ where: { propostaId: a.dado.id } });
  expect(await prisma.$transaction(tx => carregarDependenciasFinanceirasAulaTx(tx, c.encontro.id, [input.matriculaId])))
    .toMatchObject({ reservas: [{ id: c.reservaId, consumoId: null, liberacoesAprovadas: [liberacaoConferida.id] }] });
  expect(await consultarComprasHorasAntecipadas(consulta)).toMatchObject({ ok: true, dado: { compras: [{ minutosDisponiveis: 180, minutosReservados: 0, minutosConsumidos: 0, reservas: [{ id: c.reservaId, liberada: true }] }] } });
  expect(await conferirRealizacaoHoras({ reservaId: c.reservaId })).toMatchObject({ ok: false, erro: expect.stringContaining("liberada") });
  expect(await proporLiberacaoHorasRemarcacao({ ...entrada, chaveIdempotencia: "liberacao-duplicada" })).toMatchObject({ ok: false });
  await expect(prisma.decisaoLiberacaoHoras.updateMany({ data: { aprovada: false } })).rejects.toThrow();
  const novos = [];
  for (const dia of [11, 12]) novos.push(await prisma.encontroAgenda.create({ data: { matriculaId: input.matriculaId, professorId: c.prof.id, preparadorId: c.gestor.id, inicio: new Date(`2099-10-${dia}T15:00:00Z`), fim: new Date(`2099-10-${dia}T17:00:00Z`), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Novo encontro autorizado", chaveIdempotencia: `novo-encontro-${dia}`, entradaHash: "fixture" } }));
  const resultados = await Promise.all(novos.map(e => reservarHorasCompradasParaEncontro({ compraId: c.compraId, encontroId: e.id, motivo: "Nova reserva após liberação", chaveIdempotencia: `nova-reserva-${e.id}` })));
  expect(resultados.filter(r => r.ok)).toHaveLength(1);
  expect(await consultarComprasHorasAntecipadas(consulta)).toMatchObject({ ok: true, dado: { compras: [{ minutosDisponiveis: 60, minutosReservados: 120 }] } });
  expect(await prisma.reservaHorasCompradas.count()).toBe(2);
  expect(await prisma.recebimento.findMany()).toEqual(pagamentos); expect(await prisma.cobranca.count()).toBe(1);
});
it("exige cancelamento aprovado, recusa mudança de estado, permite rejeição e respeita revogação de papel", async () => {
  const c = await prepararReservaParaLiberacao();
  const entrada = { reservaId: c.reservaId, evidenciaEscolhaRemarcacao: "Escolha registrada pelo atendimento", motivo: "Remarcação solicitada pelo aluno", chaveIdempotencia: "liberacao-valida" };
  expect(await proporLiberacaoHorasRemarcacao(entrada)).toMatchObject({ ok: false });
  await prisma.encontroAgenda.update({ where: { id: c.encontro.id }, data: { status: "CANCELADO" } });
  expect(await proporLiberacaoHorasRemarcacao(entrada)).toMatchObject({ ok: false, erro: expect.stringContaining("aprovado") });
  await prisma.encontroAgenda.update({ where: { id: c.encontro.id }, data: { status: "PREVISTO" } });
  await cancelarPelaEscola(c);
  const a = await proporLiberacaoHorasRemarcacao(entrada); if (!a.ok || !a.dado) throw new Error("Liberação ausente");
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  await prisma.encontroAgenda.update({ where: { id: c.encontro.id }, data: { status: "PREVISTO" } });
  const d = { propostaId: a.dado.id, aprovar: true, motivo: "Conferência administrativa" };
  expect(await decidirLiberacaoHorasRemarcacao(d)).toMatchObject({ ok: false });
  await expect(prisma.decisaoLiberacaoHoras.create({ data: { propostaId: d.propostaId, reservaId: c.reservaId, decisorId: admin.id, aprovada: true, motivo: d.motivo } })).rejects.toThrow("cancelamento");
  expect(await decidirLiberacaoHorasRemarcacao({ ...d, aprovar: false })).toMatchObject({ ok: true });
  expect(await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: input.matriculaId })).toMatchObject({ ok: true, dado: { compras: [{ minutosDisponiveis: 60, minutosReservados: 120 }] } });
  await prisma.usuario.update({ where: { id: admin.id }, data: { ativo: false } });
  expect(await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: input.matriculaId })).toMatchObject({ ok: false });
});

it("vincula cancelamento pago, liberação financeira e nova agenda antes de reutilizar horas", async () => {
  const c = await prepararReservaParaLiberacao(); await cancelarPelaEscola(c);
  await prisma.usuario.update({ where: { id: usuarioId }, data: { papeis: ["FINANCEIRO", "ADMINISTRADOR"] } });
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  const cal = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 0, periodos: [], motivo: "Calendário das particulares", chaveIdempotencia: "calendario-ciclo-pago" });
  if (!cal.ok || !cal.dado) throw new Error("Calendário ausente");
  authMock.mockResolvedValue({ user: { id: c.gestor.id } });
  expect(await decidirCalendarioEscolar({ calendarioId: cal.dado.id, aprovar: true, motivo: "Calendário conferido pela gestão" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: usuarioId } });
  const entrada = { encontroOriginalId: c.encontro.id, professorId: c.prof.id, data: "2099-10-15", horario: "15:00", fuso: "UTC", evidenciaEscolha: "Aluno escolheu remarcar o encontro pago", motivo: "Nova data para encontro cancelado", chaveIdempotencia: "remarcacao-ciclo-pago" };
  expect(await proporRemarcacaoParticular(entrada)).toMatchObject({ ok: false, erro: expect.stringContaining("Financeiro") });
  const liberacao = await proporLiberacaoHorasRemarcacao({ reservaId: c.reservaId, evidenciaEscolhaRemarcacao: entrada.evidenciaEscolha, motivo: "Liberação para nova data", chaveIdempotencia: "liberacao-ciclo-pago" });
  if (!liberacao.ok || !liberacao.dado) throw new Error("Liberação ausente");
  const aprovador = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: aprovador.id } });
  expect(await decidirLiberacaoHorasRemarcacao({ propostaId: liberacao.dado.id, aprovar: true, motivo: "Liberação financeira conferida" })).toMatchObject({ ok: true });
  authMock.mockResolvedValue({ user: { id: usuarioId } });
  const proposta = await proporRemarcacaoParticular(entrada); if (!proposta.ok || !proposta.dado) throw new Error("Proposta ausente");
  authMock.mockResolvedValue({ user: { id: c.gestor.id } });
  const decisao = await decidirRemarcacaoParticular({ propostaId: proposta.dado.id, aprovar: true, motivo: "Remarcação conferida pela gestão" });
  expect(decisao.ok, decisao.ok ? undefined : decisao.erro).toBe(true); if (!decisao.ok || !decisao.dado?.encontroNovoId) throw new Error("Encontro ausente");
  authMock.mockResolvedValue({ user: { id: usuarioId } });
  expect(await reservarHorasCompradasParaEncontro({ compraId: c.compraId, encontroId: decisao.dado.encontroNovoId, motivo: "Horas destinadas ao encontro remarcado", chaveIdempotencia: "reserva-ciclo-pago" })).toMatchObject({ ok: true });
  expect(await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: input.matriculaId })).toMatchObject({ ok: true, dado: { compras: [{ minutosDisponiveis: 60, minutosReservados: 120, minutosConsumidos: 0 }] } });
  expect(await prisma.recebimento.count()).toBe(1); expect(await prisma.cobranca.count()).toBe(1);
});

it("converte horas canceladas em crédito original sem liberar as mesmas horas para remarcação", async () => {
  const c = await prepararReservaParaLiberacao(); await cancelarPelaEscola(c);
  const pagamentos = await prisma.recebimento.findMany();
  const entrada = { reservaId: c.reservaId, evidenciaEscolhaRemarcacao: "Aluno escolheu crédito do encontro já pago", motivo: "Escola cancelou o encontro contratado", chaveIdempotencia: "credito-horas-teste", destino: "CREDITO" as const };
  const a = await proporLiberacaoHorasRemarcacao(entrada); expect(a.ok, a.ok ? undefined : a.erro).toBe(true); if (!a.ok || !a.dado) throw new Error("Proposta ausente");
  expect(await prisma.creditoMatricula.count()).toBe(0);
  const proposta = await prisma.propostaLiberacaoHoras.findUniqueOrThrow({ where: { id: a.dado.id } }); expect(proposta.valorCredito?.toFixed(2)).toBe("200.00");
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  const d = { propostaId: a.dado.id, aprovar: true, motivo: "Crédito e escolha do aluno conferidos" };
  await expect(prisma.decisaoLiberacaoHoras.create({ data: { propostaId: d.propostaId, reservaId: c.reservaId, decisorId: admin.id, aprovada: true, motivo: d.motivo } })).rejects.toThrow("registro monetário");
  expect(await prisma.decisaoLiberacaoHoras.count()).toBe(0);
  const [r, repetida] = await Promise.all([decidirLiberacaoHorasRemarcacao(d), decidirLiberacaoHorasRemarcacao(d)]);
  expect(r.ok, r.ok ? undefined : r.erro).toBe(true); expect(repetida).toEqual(r);
  const credito = await prisma.creditoMatricula.findFirstOrThrow(); expect(credito.matriculaId).toBe(input.matriculaId); expect(credito.valorInicial.toFixed(2)).toBe("200.00"); expect(credito.moeda).toBe("CRC");
  expect(await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: input.matriculaId })).toMatchObject({ ok: true, dado: { compras: [{ minutosReservados: 0, minutosConsumidos: 0, minutosConvertidosCredito: 120, minutosDisponiveis: 60 }] } });
  expect(await proporLiberacaoHorasRemarcacao({ ...entrada, destino: "REMARCACAO", chaveIdempotencia: "remarcar-horas-creditadas" })).toMatchObject({ ok: false });
  expect(await proporRemarcacaoParticular({ encontroOriginalId: c.encontro.id, professorId: c.prof.id, data: "2099-10-15", horario: "15:00", fuso: "UTC", evidenciaEscolha: "Tentativa de reutilizar horas convertidas", motivo: "Nova data para encontro", chaveIdempotencia: "remarcacao-apos-credito" })).toMatchObject({ ok: false, erro: expect.stringContaining("crédito") });
  const novo = await prisma.encontroAgenda.create({ data: { matriculaId: input.matriculaId, professorId: c.prof.id, preparadorId: c.gestor.id, inicio: new Date("2099-10-15T15:00:00Z"), fim: new Date("2099-10-15T17:00:00Z"), status: "PREVISTO", fusoOrigem: "UTC", motivo: "Outro encontro", chaveIdempotencia: "outro-encontro-credito", entradaHash: "fixture" } });
  expect(await reservarHorasCompradasParaEncontro({ compraId: c.compraId, encontroId: novo.id, motivo: "Tentativa de reservar horas creditadas", chaveIdempotencia: "reserva-saldo-creditado" })).toMatchObject({ ok: false });
  await expect(prisma.reservaHorasCompradas.create({ data: { compraId: c.compraId, encontroId: novo.id, autorId: admin.id, minutos: 120, inicio: novo.inicio, fim: novo.fim, motivo: "Tentativa SQL de reserva", chaveIdempotencia: "sql-reserva-credito", entradaHash: "fixture" } })).rejects.toThrow("Saldo");
  await expect(prisma.creditoMatricula.update({ where: { id: credito.id }, data: { valorInicial: 300 } })).rejects.toThrow();
  expect(await prisma.recebimento.findMany()).toEqual(pagamentos); expect(await prisma.cobranca.count()).toBe(1);
});
it("preserva centavos no acumulado e exige revisar outra proposta quando um crédito da compra é aprovado", async () => {
  input = { ...input, minutosComprados: 7 };
  const compra = await registrarCompraHorasAntecipadas(input); if (!compra.ok || !compra.dado) throw new Error("Compra ausente");
  const propostas: { id: string; reservaId: string; entrada: Parameters<typeof proporLiberacaoHorasRemarcacao>[0] }[] = [];
  for (const [i, minutos] of [2, 2, 3].entries()) {
    authMock.mockResolvedValue({ user: { id: usuarioId } });
    const prof = await criarUsuario(["PROFESSOR"]), gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
    const inicio = new Date(`2099-10-${10 + i}T15:00:00Z`), fim = new Date(inicio.getTime() + minutos * 60000);
    const encontro = await prisma.encontroAgenda.create({ data: { matriculaId: input.matriculaId, professorId: prof.id, preparadorId: gestor.id, inicio, fim, status: "PREVISTO", fusoOrigem: "UTC", motivo: "Encontro por minutos contratados", chaveIdempotencia: `arredondamento-${i}`, entradaHash: "fixture" } });
    const reserva = await reservarHorasCompradasParaEncontro({ compraId: compra.dado.id, encontroId: encontro.id, motivo: "Reservar minutos originais", chaveIdempotencia: `reserva-arredondamento-${i}` });
    if (!reserva.ok || !reserva.dado) throw new Error("Reserva ausente");
    await cancelarPelaEscola({ compraId: compra.dado.id, reservaId: reserva.dado.id, encontro, prof, gestor });
    const entrada = { reservaId: reserva.dado.id, evidenciaEscolhaRemarcacao: "Aluno escolheu crédito integral deste encontro", motivo: "Cancelamento pela escola", chaveIdempotencia: `credito-arredondamento-${i}`, destino: "CREDITO" as const };
    const p = await proporLiberacaoHorasRemarcacao(entrada); if (!p.ok || !p.dado) throw new Error("Crédito ausente"); propostas.push({ id: p.dado.id, reservaId: reserva.dado.id, entrada });
  }
  const admin = await criarUsuario(["ADMINISTRADOR"]);
  const valores = [];
  for (const [i, p] of propostas.entries()) {
    authMock.mockResolvedValue({ user: { id: admin.id } });
    let propostaId = p.id;
    if (i > 0) {
      expect(await decidirLiberacaoHorasRemarcacao({ propostaId, aprovar: true, motivo: "Conferência de crédito" })).toMatchObject({ ok: false, erro: expect.stringContaining("cálculo mudou") });
      expect(await decidirLiberacaoHorasRemarcacao({ propostaId, aprovar: false, motivo: "Revisar cálculo atualizado" })).toMatchObject({ ok: true });
      authMock.mockResolvedValue({ user: { id: usuarioId } });
      const nova = await proporLiberacaoHorasRemarcacao({ ...p.entrada, chaveIdempotencia: `credito-revisado-${i}` }); if (!nova.ok || !nova.dado) throw new Error("Revisão ausente"); propostaId = nova.dado.id;
      authMock.mockResolvedValue({ user: { id: admin.id } });
    }
    const r = await decidirLiberacaoHorasRemarcacao({ propostaId, aprovar: true, motivo: "Conferência de crédito" }); expect(r.ok, r.ok ? undefined : r.erro).toBe(true);
    valores.push((await prisma.creditoMatricula.findFirstOrThrow({ where: { origemLiberacao: { propostaId } } })).valorInicial.toFixed(2));
  }
  expect(valores).toEqual(["85.71", "85.72", "128.57"]);
  expect((await prisma.creditoMatricula.aggregate({ _sum: { valorInicial: true } }))._sum.valorInicial?.toFixed(2)).toBe("300.00");
  expect(await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: input.matriculaId })).toMatchObject({ ok: true, dado: { compras: [{ minutosDisponiveis: 0, minutosConvertidosCredito: 7 }] } });
});

async function creditoParaPropostaUso() {
  const c = await prepararReservaParaLiberacao(); await cancelarPelaEscola(c);
  const p = await proporLiberacaoHorasRemarcacao({ reservaId: c.reservaId, evidenciaEscolhaRemarcacao: "Aluno escolheu crédito do valor pago", motivo: "Escola cancelou o encontro", chaveIdempotencia: "credito-para-utilizacao", destino: "CREDITO" });
  if (!p.ok || !p.dado) throw new Error("Proposta de crédito ausente");
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  const d = await decidirLiberacaoHorasRemarcacao({ propostaId: p.dado.id, aprovar: true, motivo: "Crédito conferido independentemente" });
  if (!d.ok) throw new Error(d.erro);
  authMock.mockResolvedValue({ user: { id: usuarioId } });
  const credito = await prisma.creditoMatricula.findFirstOrThrow();
  const cobranca = await prisma.cobranca.create({ data: { matriculaId: input.matriculaId, tipo: "HORA_PARTICULAR", valorOriginal: 300, valorNegociado: 300, valorRecebido: 0, saldo: 300, moeda: "CRC", status: "PENDENTE", vencimento: new Date("2099-11-01") } });
  return { credito, cobranca, entrada: { creditoId: credito.id, cobrancaId: cobranca.id, valor: "150.00", concordancia: "Aluno autorizou propor abatimento nesta cobrança", motivo: "Proposta de destinação do crédito disponível", chaveIdempotencia: "utilizacao-credito-proposta" } };
}
it("reserva devolução aprovada, impede apagar e só libera por cancelamento ou conciliação evidenciada", async () => {
  const { credito } = await creditoParaPropostaUso();
  const proposta = await proporDevolucaoCredito({ creditoId: credito.id, valor: "150.00", pedidoAluno: "Aluno pediu devolução do crédito", evidenciaPedido: "Protocolo do pedido do aluno", destino: "Conta bancária conferida do titular", motivo: "Devolver saldo não utilizado", chaveIdempotencia: "devolucao-proposta-um" });
  expect(proposta.ok, proposta.ok ? undefined : proposta.erro).toBe(true); if (!proposta.ok || !proposta.dado) throw new Error("Proposta ausente");
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  expect(await decidirDevolucaoCredito({ propostaId: proposta.dado.id, aprovar: true, motivo: "Aprovação independente conferida" })).toMatchObject({ ok: true, dado: { aprovada: true } });
  const reserva = await prisma.reservaDevolucaoCredito.findFirstOrThrow(); expect(reserva.estado).toBe("AGUARDANDO_EXECUCAO"); expect((await prisma.$transaction(tx => import("@/server/financeiro/uso-credito-estado").then(({ saldoCreditoTx }) => saldoCreditoTx(tx, credito.id)))).toFixed(2)).toBe("50.00");
  expect(await consultarPropostasUsoCredito({ alunoId: input.alunoId, creditoId: credito.id })).toMatchObject({ ok: true, dado: { valorCredito: "50.00", reservaDevolucao: "150.00", devolvido: "0.00" } });
  await expect(prisma.reservaDevolucaoCredito.delete({ where: { id: reserva.id } })).rejects.toThrow();
  await expect(prisma.reservaDevolucaoCredito.update({ where: { id: reserva.id }, data: { estado: "LIBERADA" } })).rejects.toThrow();
  await expect(prisma.reservaDevolucaoCredito.update({ where: { id: reserva.id }, data: { estado: "CONFIRMADA", executorId: admin.id, chaveExecucao: "forja-sem-evidencia", referenciaExterna: "forja", executadaEm: new Date() } })).rejects.toThrow();
  expect(await cancelarDevolucaoCredito({ reservaId: reserva.id, motivo: "Aluno retirou o pedido", evidenciaCancelamento: "Registro de retirada pelo aluno" })).toMatchObject({ ok: true, dado: { estado: "LIBERADA" } });
  expect(await cancelarDevolucaoCredito({ reservaId: reserva.id, motivo: "Aluno retirou o pedido", evidenciaCancelamento: "Registro de retirada pelo aluno" })).toMatchObject({ ok: true, dado: { estado: "LIBERADA" } });
  expect(await cancelarDevolucaoCredito({ reservaId: reserva.id, motivo: "Outro motivo inválido", evidenciaCancelamento: "Registro de retirada pelo aluno" })).toMatchObject({ ok: false });
  expect(await consultarPropostasUsoCredito({ alunoId: input.alunoId, creditoId: credito.id })).toMatchObject({ ok: true, dado: { valorCredito: "200.00", reservaDevolucao: "0.00", devolvido: "0.00" } });
  expect((await prisma.$transaction(tx => import("@/server/financeiro/uso-credito-estado").then(({ saldoCreditoTx }) => saldoCreditoTx(tx, credito.id)))).toFixed(2)).toBe("200.00");
  authMock.mockResolvedValue({ user: { id: usuarioId } });
  const segunda = await proporDevolucaoCredito({ creditoId: credito.id, valor: "100.00", pedidoAluno: "Aluno confirmou nova devolução", evidenciaPedido: "Protocolo novo do pedido aluno", destino: "Conta bancária conferida do titular", motivo: "Devolver saldo restante", chaveIdempotencia: "devolucao-proposta-dois" }); if (!segunda.ok || !segunda.dado) throw new Error("Segunda proposta ausente");
  authMock.mockResolvedValue({ user: { id: admin.id } }); await decidirDevolucaoCredito({ propostaId: segunda.dado.id, aprovar: true, motivo: "Aprovação independente renovada" });
  const incerta = await prisma.reservaDevolucaoCredito.findFirstOrThrow({ where: { estado: "AGUARDANDO_EXECUCAO" } });
  expect(await registrarExecucaoDevolucaoCredito({ reservaId: incerta.id, resultado: "INCERTO", referenciaExterna: "manual-externo-1", evidenciaExecucao: "Comprovante manual pendente", chaveIdempotencia: "execucao-manual-um" })).toMatchObject({ ok: true, dado: { estado: "INCERTO" } });
  expect(await registrarExecucaoDevolucaoCredito({ reservaId: incerta.id, resultado: "INCERTO", referenciaExterna: "manual-externo-1", evidenciaExecucao: "Comprovante manual pendente", chaveIdempotencia: "execucao-manual-um" })).toMatchObject({ ok: true, dado: { estado: "INCERTO" } });
  expect(await registrarExecucaoDevolucaoCredito({ reservaId: incerta.id, resultado: "CONFIRMADA", referenciaExterna: "manual-externo-1", evidenciaExecucao: "Comprovante manual pendente", chaveIdempotencia: "execucao-manual-um" })).toMatchObject({ ok: false });
  await expect(prisma.reservaDevolucaoCredito.update({ where: { id: incerta.id }, data: { estado: "LIBERADA" } })).rejects.toThrow();
  expect(await conciliarDevolucaoCredito({ reservaId: incerta.id, confirmouSaida: false, evidenciaConciliacao: "Extrato confirma que não houve saída" })).toMatchObject({ ok: true, dado: { estado: "LIBERADA" } });
  const eventosAntesRevogacao = await prisma.evento.count();
  await prisma.usuario.update({ where: { id: admin.id }, data: { papeis: ["FINANCEIRO"], permissoes: [] } });
  expect(await conciliarDevolucaoCredito({ reservaId: incerta.id, confirmouSaida: false, evidenciaConciliacao: "Extrato confirma que não houve saída" })).toMatchObject({ ok: false });
  expect(await cancelarDevolucaoCredito({ reservaId: reserva.id, motivo: "Aluno retirou o pedido", evidenciaCancelamento: "Registro de retirada pelo aluno" })).toMatchObject({ ok: false });
  expect(await prisma.evento.count()).toBe(eventosAntesRevogacao);
  expect((await prisma.reservaDevolucaoCredito.findUniqueOrThrow({ where: { id: incerta.id } })).estado).toBe("LIBERADA");

  expect(await consultarPropostasUsoCredito({ alunoId: input.alunoId, creditoId: credito.id })).toMatchObject({ ok: true, dado: { valorCredito: "200.00", reservaDevolucao: "0.00", devolvido: "0.00" } });
});
it("serializa cancelamento e execução da mesma reserva", async () => {
  const { credito } = await creditoParaPropostaUso();
  const p = await proporDevolucaoCredito({ creditoId: credito.id, valor: "100.00", pedidoAluno: "Aluno pediu devolução concorrente", evidenciaPedido: "Protocolo concorrente do aluno", destino: "Conta conferida do titular", motivo: "Devolução concorrente", chaveIdempotencia: "devolucao-corrida" }); if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } }); await decidirDevolucaoCredito({ propostaId: p.dado.id, aprovar: true, motivo: "Aprovação concorrente independente" });
  const r = await prisma.reservaDevolucaoCredito.findFirstOrThrow();
  const [cancelar, executar] = await Promise.all([cancelarDevolucaoCredito({ reservaId: r.id, motivo: "Cancelar antes da saída", evidenciaCancelamento: "Evidência do cancelamento" }), registrarExecucaoDevolucaoCredito({ reservaId: r.id, resultado: "INCERTO", referenciaExterna: "corrida-manual", evidenciaExecucao: "Comprovante da tentativa manual", chaveIdempotencia: "execucao-corrida" })]);
  expect([cancelar.ok, executar.ok].filter(Boolean)).toHaveLength(1);
  const final = await prisma.reservaDevolucaoCredito.findUniqueOrThrow({ where: { id: r.id } }); expect(["LIBERADA", "INCERTO"]).toContain(final.estado);
  if (final.estado === "INCERTO") expect(await conciliarDevolucaoCredito({ reservaId: r.id, confirmouSaida: false, evidenciaConciliacao: "Extrato da corrida sem saída" })).toMatchObject({ ok: true, dado: { estado: "LIBERADA" } });
});
it("revalida executor revogado depois da aprovação e conserva a reserva", async () => {
  const { credito } = await creditoParaPropostaUso();
  const p = await proporDevolucaoCredito({ creditoId: credito.id, valor: "100.00", pedidoAluno: "Aluno pediu devolução revogável", evidenciaPedido: "Protocolo de devolução revogável", destino: "Conta conferida do titular", motivo: "Devolução para testar revogação", chaveIdempotencia: "devolucao-revogacao" }); if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } }); await decidirDevolucaoCredito({ propostaId: p.dado.id, aprovar: true, motivo: "Aprovação independente válida" });
  const r = await prisma.reservaDevolucaoCredito.findFirstOrThrow(); await prisma.usuario.update({ where: { id: admin.id }, data: { ativo: false } });
  expect(await registrarExecucaoDevolucaoCredito({ reservaId: r.id, resultado: "CONFIRMADA", referenciaExterna: "externa-revogada", evidenciaExecucao: "Comprovante não autorizado", chaveIdempotencia: "execucao-revogada" })).toMatchObject({ ok: false });
  expect(await prisma.reservaDevolucaoCredito.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ estado: "AGUARDANDO_EXECUCAO", executorId: null, evidenciaExecucao: null });
});
it("guard SQL recusa proposta de devolução acima do saldo ou com proveniência forjada", async () => {
  const { credito } = await creditoParaPropostaUso();
  const base = { creditoId: credito.id, preparadorId: usuarioId, versao: 1, pedidoAluno: "Pedido direto de devolução", evidenciaPedido: "Evidência direta de devolução", destino: "Destino direto conferido", chaveIdempotencia: "sql-direto-devolucao", entradaHash: "hash-direto" };
  await expect(prisma.propostaDevolucaoCredito.create({ data: { ...base, valor: 201, snapshot: { creditoId: credito.id, matriculaId: credito.matriculaId, moeda: credito.moeda, saldoDisponivel: "200.00", valor: "201.00", destino: base.destino } } })).rejects.toThrow();
  await expect(prisma.propostaDevolucaoCredito.create({ data: { ...base, valor: 100, chaveIdempotencia: "sql-proveniencia-forjada", snapshot: { creditoId: credito.id, matriculaId: "matricula-forjada", moeda: "USD", saldoDisponivel: "200.00", valor: "100.00", destino: base.destino } } })).rejects.toThrow();
  expect(await prisma.propostaDevolucaoCredito.count()).toBe(0);
});
it("serializa aprovação concorrente de uso Q68 e devolução Q69 no mesmo crédito", async () => {
  const { credito, entrada } = await creditoParaPropostaUso();
  const uso = await proporUtilizacaoCredito({ ...entrada, valor: "150.00", chaveIdempotencia: "uso-concorrente-devolucao" }); if (!uso.ok || !uso.dado) throw new Error("Uso ausente");
  const devolucao = await proporDevolucaoCredito({ creditoId: credito.id, valor: "100.00", pedidoAluno: "Pedido de devolução concorrente", evidenciaPedido: "Evidência de devolução concorrente", destino: "Destino conferido concorrente", motivo: "Conferir disputa pelo crédito", chaveIdempotencia: "devolucao-concorrente-uso" }); if (!devolucao.ok || !devolucao.dado) throw new Error("Devolução ausente");
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  const [a, b] = await Promise.all([decidirUtilizacaoCredito({ propostaId: uso.dado.id, aprovar: true, motivo: "Aprovação concorrente de uso" }), decidirDevolucaoCredito({ propostaId: devolucao.dado.id, aprovar: true, motivo: "Aprovação concorrente de devolução" })]);
  expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  expect((await prisma.$transaction(tx => import("@/server/financeiro/uso-credito-estado").then(({ saldoCreditoTx }) => saldoCreditoTx(tx, credito.id)))).gte(0)).toBe(true);
});
it("guarda proposta de uso idempotente e versionada sem consumir crédito, alterar cobrança ou criar recebimento", async () => {
  const { credito, cobranca, entrada } = await creditoParaPropostaUso();
  const recebimentos = await prisma.recebimento.findMany();
  const [a, b] = await Promise.all([proporUtilizacaoCredito(entrada), proporUtilizacaoCredito({ ...entrada, valor: "150" })]);
  expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a);
  expect(a).toMatchObject({ dado: { versao: 1, aplicada: false } });
  expect(await prisma.creditoMatricula.findUniqueOrThrow({ where: { id: credito.id } })).toEqual(credito);
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } })).toEqual(cobranca);
  expect(await prisma.recebimento.findMany()).toEqual(recebimentos);
  const p = await prisma.propostaUsoCredito.findFirstOrThrow();
  expect(p.snapshot).toMatchObject({ valorCredito: "200.00", valorProposto: "150.00", saldoCreditoProposto: "50.00", saldoCobrancaProposto: "150.00", aplicada: false });
  expect(await proporUtilizacaoCredito({ ...entrada, valor: "100.00" })).toMatchObject({ ok: false });
  expect(await proporUtilizacaoCredito({ ...entrada, valor: "100.00", chaveIdempotencia: "utilizacao-credito-versao-2" })).toMatchObject({ ok: true, dado: { versao: 2, aplicada: false } });
  expect(await consultarPropostasUsoCredito({ alunoId: input.alunoId, creditoId: credito.id })).toMatchObject({ ok: true, dado: { valorCredito: "200.00", aplicacaoDisponivel: true, propostas: [{ versao: 2 }, { versao: 1 }] } });
  await expect(prisma.propostaUsoCredito.updateMany({ data: { valor: 1 } })).rejects.toThrow();
});
it("recusa valor, moeda, vínculo e estado incompatíveis e mantém acesso financeiro restrito", async () => {
  const { credito, cobranca, entrada } = await creditoParaPropostaUso();
  for (const valor of ["0", "201.00", "150.001", "-1", "1e2"]) expect(await proporUtilizacaoCredito({ ...entrada, valor })).toMatchObject({ ok: false });
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: input.matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId: m.alunoId, produtoId: m.produtoId, paisId: m.paisId, moeda: "CRC", status: "ATIVA" } });
  const outraCobranca = await prisma.cobranca.create({ data: { matriculaId: outra.id, tipo: "MENSALIDADE", valorOriginal: 300, valorNegociado: 300, moeda: "CRC", vencimento: new Date("2099-11-01") } });
  expect(await proporUtilizacaoCredito({ ...entrada, cobrancaId: outraCobranca.id })).toMatchObject({ ok: false });
  await expect(prisma.propostaUsoCredito.create({ data: { creditoId: credito.id, cobrancaId: outraCobranca.id, preparadorId: usuarioId, versao: 1, valor: 150, concordancia: entrada.concordancia, motivo: entrada.motivo, chaveIdempotencia: "sql-outro-contrato", entradaHash: "fixture", snapshot: {} } })).rejects.toThrow("incompatível");
  await prisma.cobranca.update({ where: { id: cobranca.id }, data: { moeda: "BRL" } });
  expect(await proporUtilizacaoCredito(entrada)).toMatchObject({ ok: false });
  await expect(prisma.cobranca.update({ where: { id: cobranca.id }, data: { moeda: "CRC", saldo: 290 } })).rejects.toThrow(/destinações|créditos/i);
  expect(await consultarPropostasUsoCredito({ alunoId: "outro-aluno", creditoId: credito.id })).toMatchObject({ ok: false });
  const professor = await criarUsuario(["PROFESSOR"]); authMock.mockResolvedValue({ user: { id: professor.id } });
  expect(await consultarPropostasUsoCredito({ alunoId: input.alunoId, creditoId: credito.id })).toMatchObject({ ok: false });
  expect(await proporUtilizacaoCredito(entrada)).toMatchObject({ ok: false });
  expect(await prisma.propostaUsoCredito.count()).toBe(0);
});

it("aplica crédito com aprovação independente e recebe apenas o restante em dinheiro", async () => {
  const { credito, cobranca, entrada } = await creditoParaPropostaUso();
  const p = await proporUtilizacaoCredito(entrada); if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  const d = { propostaId: p.dado.id, aprovar: true, motivo: "Concordância, origem e destino conferidos" };
  await prisma.usuario.update({ where: { id: usuarioId }, data: { papeis: ["FINANCEIRO", "ADMINISTRADOR"] } });
  expect(await decidirUtilizacaoCredito(d)).toMatchObject({ ok: false, erro: expect.stringContaining("Outra pessoa") });
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  const [a, b] = await Promise.all([decidirUtilizacaoCredito(d), decidirUtilizacaoCredito(d)]); expect(a.ok, a.ok ? undefined : a.erro).toBe(true); expect(b).toEqual(a);
  const parcial = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
  expect(parcial.valorRecebido?.toFixed(2)).toBe("0.00"); expect(parcial.valorLiquidadoCredito.toFixed(2)).toBe("150.00"); expect(parcial.saldo?.toFixed(2)).toBe("150.00"); expect(parcial.status).toBe("PENDENTE");
  expect(await prisma.recebimento.count()).toBe(1);
  expect((await kpisFinanceiro()).aReceber).toEqual([{ moeda: "CRC", valor: 150 }]);
  expect(await consultarPropostasUsoCredito({ alunoId: input.alunoId, creditoId: credito.id })).toMatchObject({ ok: true, dado: { valorCredito: "50.00", propostas: [{ decisao: { aprovada: true } }] } });
  expect(await proporUtilizacaoCredito({ ...entrada, valor: "51.00", chaveIdempotencia: "usar-saldo-indisponivel" })).toMatchObject({ ok: false });
  await expect(prisma.cobranca.update({ where: { id: cobranca.id }, data: { valorLiquidadoCredito: 0, saldo: 300 } })).rejects.toThrow(/preservar|destinações|créditos/i);
  await expect(prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, chaveIdempotencia: "excesso-apos-credito", autorId: admin.id, valorRecebido: 151, forma: "DINHEIRO", dataPagamento: new Date(), evidencia: "Tentativa de exceder o saldo após crédito." }))).rejects.toThrow("excede");
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, chaveIdempotencia: "restante-apos-credito", autorId: admin.id, valorRecebido: 150, forma: "DINHEIRO", dataPagamento: new Date(), evidencia: "Complemento devido após o uso do crédito." }));
  const paga = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } }); expect(paga.valorRecebido?.toFixed(2)).toBe("150.00"); expect(paga.saldo?.toFixed(2)).toBe("0.00"); expect(pagamentoConfirmado(paga)).toBe(true);
  expect(await prisma.recebimento.count()).toBe(2); expect(await prisma.decisaoUsoCredito.count()).toBe(1);
});
it("quita integralmente com crédito sem inventar recebimento", async () => {
  const { credito, cobranca, entrada } = await creditoParaPropostaUso();
  await prisma.cobranca.update({ where: { id: cobranca.id }, data: { valorOriginal: 200, valorNegociado: 200, saldo: 200 } });
  const p = await proporUtilizacaoCredito({ ...entrada, valor: "200.00" }); if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  const financeiro = await criarUsuario(["FINANCEIRO"]); authMock.mockResolvedValue({ user: { id: financeiro.id } });
  const d = { propostaId: p.dado.id, aprovar: true, motivo: "Conferência integral do abatimento" };
  expect(await decidirUtilizacaoCredito(d)).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: financeiro.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  expect(await decidirUtilizacaoCredito(d)).toMatchObject({ ok: true });
  const paga = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } }); expect(paga.status).toBe("PAGO"); expect(paga.valorRecebido?.toFixed(2)).toBe("0.00"); expect(pagamentoConfirmado(paga)).toBe(true);
  expect(await prisma.recebimento.count({ where: { cobrancaId: cobranca.id } })).toBe(0);
  expect(await consultarPropostasUsoCredito({ alunoId: input.alunoId, creditoId: credito.id })).toMatchObject({ ok: true, dado: { valorCredito: "0.00" } });
  await expect(prisma.decisaoUsoCredito.deleteMany()).rejects.toThrow();
});
it("recusa aprovação com cobrança alterada e aceita rejeitar a proposta sem consumir saldo", async () => {
  const { credito, cobranca, entrada } = await creditoParaPropostaUso();
  const p = await proporUtilizacaoCredito(entrada); if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, chaveIdempotencia: "pagamento-apos-proposta", autorId: admin.id, valorRecebido: 50, forma: "DINHEIRO", dataPagamento: new Date(), evidencia: "Pagamento parcial após a proposta de uso." }));
  const d = { propostaId: p.dado.id, aprovar: true, motivo: "Conferência após pagamento parcial" };
  expect(await decidirUtilizacaoCredito(d)).toMatchObject({ ok: false, erro: expect.stringContaining("mudou") });
  expect(await decidirUtilizacaoCredito({ ...d, aprovar: false })).toMatchObject({ ok: true });
  expect(await consultarPropostasUsoCredito({ alunoId: input.alunoId, creditoId: credito.id })).toMatchObject({ ok: true, dado: { valorCredito: "200.00" } });
});

it.each([0, 100])("registra compra quitada com crédito e %s em dinheiro, preservando as origens", async (dinheiro) => {
  const { cobranca, entrada } = await creditoParaPropostaUso();
  await prisma.cobranca.update({ where: { id: cobranca.id }, data: { valorOriginal: 360, valorNegociado: 200 + dinheiro, valorRecebido: null, saldo: 200 + dinheiro } });
  const p = await proporUtilizacaoCredito({ ...entrada, valor: "200.00" });
  if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  const admin = await criarUsuario(["ADMINISTRADOR"]); authMock.mockResolvedValue({ user: { id: admin.id } });
  expect(await decidirUtilizacaoCredito({ propostaId: p.dado.id, aprovar: true, motivo: "Crédito destinado à nova compra" })).toMatchObject({ ok: true });
  if (dinheiro) await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: admin.id, valorRecebido: dinheiro, forma: "DINHEIRO", dataPagamento: new Date(), chaveIdempotencia: "complemento-compra-credito", evidencia: "Complemento em dinheiro para a compra de horas." }));
  const c = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
  const recebimentosAntes = await prisma.recebimento.findMany({ orderBy: { id: "asc" } });
  const pedido = { ...input, cobrancaId: c.id, versaoCobranca: c.versao, chaveIdempotencia: "compra-liquidada-credito" };
  const a = await registrarCompraHorasAntecipadas(pedido); expect(a.ok, a.ok ? undefined : a.erro).toBe(true);
  expect(await registrarCompraHorasAntecipadas(pedido)).toEqual(a);
  const compra = await prisma.compraHorasAntecipadas.findUniqueOrThrow({ where: { cobrancaId: c.id } });
  expect(compra.valorPagoAlocado.toFixed(2)).toBe((200 + dinheiro).toFixed(2));
  expect(compra.descontoOriginal.toFixed(2)).toBe((160 - dinheiro).toFixed(2));
  const contextoAcerto = await prisma.$transaction(tx => carregarContextoEncerramentoTx(tx, { alunoId: input.alunoId, matriculaId: input.matriculaId }));
  const origemAcerto = contextoAcerto.cobrancas.find(origem => origem.id === c.id);
  expect(origemAcerto).toMatchObject({ conferencias: [], valorLiquidadoCredito: "200.00", utilizacoesCredito: [{ propostaId: p.dado.id, valor: "200.00" }] });
  expect(origemAcerto?.valorRecebido).toBe(dinheiro ? dinheiro.toFixed(2) : null);
  const consulta = await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: input.matriculaId });
  expect(consulta).toMatchObject({ ok: true, dado: { compras: expect.arrayContaining([expect.objectContaining({ id: compra.id, liquidacao: { valorEmDinheiro: dinheiro.toFixed(2), valorEmCredito: "200.00", valorTotal: (200 + dinheiro).toFixed(2) } })]) } });
  if (consulta.ok) expect(consulta.dado?.compras.find(c => c.id === compra.id)).not.toHaveProperty("snapshot");
  expect(compra.snapshot).toMatchObject({ liquidacao: { valorEmDinheiro: dinheiro.toFixed(2), valorEmCredito: "200.00", valorTotal: (200 + dinheiro).toFixed(2), utilizacoes: [{ propostaId: p.dado.id, valor: "200.00" }] } });
  expect(await prisma.recebimento.findMany({ orderBy: { id: "asc" } })).toEqual(recebimentosAntes);
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).toEqual(c);
});

it("apura encerramento das horas com origens reais e desconta crédito já emitido", async () => {
  const { carregarHorasEncerramentoTx } = await import("./encerramento-horas-tx");
  const { credito } = await creditoParaPropostaUso();
  const antes = await prisma.creditoMatricula.findMany();
  const r = await prisma.$transaction(tx => carregarHorasEncerramentoTx(tx, input.alunoId, input.matriculaId));
  expect(r.pendencias).toEqual([]);
  expect(r.calculo).toMatchObject({ creditoApurado: "100.00", compras: [{ minutosPendentes: 60, minutosLiquidados: 120 }] });
  expect(r.origens[0].liquidacoesAnteriores).toEqual([{ id: credito.id, minutos: 120, valor: "200.00", referenciaAcerto: credito.origemLiberacaoId }]);
  expect(await prisma.creditoMatricula.findMany()).toEqual(antes);
  await expect(prisma.$transaction(tx => carregarHorasEncerramentoTx(tx, "outro-aluno", input.matriculaId))).rejects.toThrow("não encontrada");
});
it("mantém apuração de horas pendente enquanto houver reserva não resolvida", async () => {
  const { carregarHorasEncerramentoTx } = await import("./encerramento-horas-tx");
  await prepararReservaParaLiberacao();
  const r = await prisma.$transaction(tx => carregarHorasEncerramentoTx(tx, input.alunoId, input.matriculaId));
  expect(r.calculo).toBeNull(); expect(r.pendencias).toHaveLength(1); expect(r.origens[0].minutosReservados).toBe(120);
});

it("liquida horas e crédito juntos e impede reutilização da compra", async () => {
  const { solicitarEncerramentoMatriculas } = await import("./encerramento-solicitacao");
  const { salvarRascunhoAcertoEncerramento } = await import("./encerramento-rascunho");
  const { decidirAcertoEncerramento } = await import("./encerramento-decisao");
  const { carregarAcertoAprovadoParaEfetivacaoTx } = await import("./encerramento-efetivacao-estado");
  const { aplicarLiquidacaoHorasAcertoTx } = await import("./encerramento-aplicar-horas");
  const { aplicarCreditosAcertoTx } = await import("./encerramento-aplicar-creditos");
  const { carregarHorasEncerramentoTx } = await import("./encerramento-horas-tx");
  const compra = await registrarCompraHorasAntecipadas(input);
  if (!compra.ok || !compra.dado) throw new Error("Compra ausente");
  const admin = await criarUsuario(["ADMINISTRADOR"]), secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "America/Sao_Paulo" }, update: { fusoInstitucional: "America/Sao_Paulo" } });
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: input.matriculaId } });
  const condicoes = await prisma.condicoesEncerramentoMatricula.create({ data: { matriculaId: m.id, documentoId: m.contratoDocumentoId!, preparadorId: secretaria.id, decisorId: admin.id, status: "APROVADA", decididaEm: new Date(), motivoDecisao: "Conferência independente", versao: 1, motivo: "Condições transcritas",
    regras: { diaEncerramento: "INCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Condições do período", multa: { tipo: "SEM_PREVISAO", motivo: "Não consta multa" } } } });
  authMock.mockResolvedValue({ user: { id: secretaria.id } });
  const pedido = await solicitarEncerramentoMatriculas({ alunoId: input.alunoId, matriculaIds: [m.id], dataSolicitada: "2099-09-30", motivo: "Encerramento solicitado pelo aluno", evidenciaPedido: "Pedido institucional identificado", chaveIdempotencia: "encerramento-horas-001" });
  if (!pedido.ok || !pedido.dado) throw new Error("Pedido ausente");
  authMock.mockResolvedValue({ user: { id: usuarioId } });
  const rascunho = await salvarRascunhoAcertoEncerramento({ alunoId: input.alunoId, solicitacaoId: pedido.dado.solicitacaoId, contratos: [{ matriculaId: m.id, condicoesId: condicoes.id, parcelas: [], multa: { tipo: "SEM_PREVISAO" }, outrasCobrancas: [{ cobrancaId: input.cobrancaId, versao: input.versaoCobranca, valorDevidoProposto: "300", motivo: "Preservar compra já liquidada", evidenciaContratual: "Contrato da compra conferido" }] }], chaveIdempotencia: "rascunho-horas-001", motivo: "Apuração das horas restantes", versaoAnterior: 0 });
  expect(rascunho.ok, rascunho.ok ? undefined : rascunho.erro).toBe(true);
  if (!rascunho.ok || !rascunho.dado) throw new Error("Rascunho ausente");
  authMock.mockResolvedValue({ user: { id: admin.id } });
  const decisao = await decidirAcertoEncerramento({ alunoId: input.alunoId, rascunhoId: rascunho.dado.id, aprovar: true, motivo: "Saldo de horas e crédito conferidos" });
  expect(decisao.ok, decisao.ok ? undefined : decisao.erro).toBe(true);
  if (!decisao.ok || !decisao.dado) throw new Error("Decisão ausente");
  const antes = await prisma.recebimento.findMany();
  const aplicar = (credito: boolean, liquidacao: boolean, falha = false) => prisma.$transaction(async tx => {
    if (credito && liquidacao) {
      const { efetivarAcertoEncerramentoTx } = await import("./encerramento-efetivar-tx");
      const resultado = await efetivarAcertoEncerramentoTx(tx, { alunoId: input.alunoId, decisaoId: decisao.dado!.id, executorId: usuarioId }, new Date("2099-09-30T12:00:00Z"));
      expect(resultado.liquidacoesHoras).toHaveLength(1);
      expect(resultado.creditos).toHaveLength(1);
      expect(resultado.efetivado).toBe(true);
      if (falha) throw new Error("FALHA_APOS_LIQUIDACAO");
      return;
    }
    const acerto = await carregarAcertoAprovadoParaEfetivacaoTx(tx, { alunoId: input.alunoId, decisaoId: decisao.dado!.id, executorId: usuarioId }, new Date("2099-09-30T12:00:00Z"));
    if (liquidacao) await aplicarLiquidacaoHorasAcertoTx(tx, acerto);
    if (credito) await aplicarCreditosAcertoTx(tx, acerto);
    if (falha) throw new Error("FALHA_APOS_LIQUIDACAO");
    await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  });
  await expect(aplicar(false, true)).rejects.toThrow("crédito na mesma transação");
  await expect(aplicar(true, false)).rejects.toThrow("liquidação na mesma transação");
  await expect(aplicar(true, true, true)).rejects.toThrow("FALHA_APOS_LIQUIDACAO");
  expect(await prisma.liquidacaoHorasAcerto.count()).toBe(0);
  expect(await prisma.creditoMatricula.count()).toBe(0);
  const { efetivarAcertoEncerramento } = await import("./encerramento-efetivar");
  const publicar = { alunoId: input.alunoId, decisaoId: decisao.dado.id };
  authMock.mockResolvedValue({ user: { id: usuarioId } });
  expect(await efetivarAcertoEncerramento(publicar)).toMatchObject({ ok: false, erro: expect.stringContaining("ainda não chegou") });
  expect(await efetivarAcertoEncerramento({ ...publicar, executorId: admin.id } as typeof publicar)).toMatchObject({ ok: false });
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2099-09-30T12:00:00Z"));
  try {
    const [primeira, segunda] = await Promise.all([efetivarAcertoEncerramento(publicar), efetivarAcertoEncerramento(publicar)]);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    expect(segunda).toEqual(primeira);
  } finally { vi.useRealTimers(); }
  const { consultarRascunhoAcertoEncerramento } = await import("./encerramento-rascunho");
  expect(await consultarRascunhoAcertoEncerramento({ alunoId: input.alunoId, solicitacaoId: pedido.dado.solicitacaoId })).toMatchObject({ ok: true, dado: { podeEfetivar: false, podeDecidir: false, efetivacao: { decisaoId: decisao.dado.id, aplicadaEm: "2099-09-30T12:00:00.000Z" } } });
  const liquidada = await prisma.liquidacaoHorasAcerto.findFirstOrThrow();
  expect(liquidada.minutos).toBe(180); expect(liquidada.valor.toFixed(2)).toBe("300.00");
  expect(await prisma.recebimento.findMany()).toEqual(antes);
  await expect(prisma.liquidacaoHorasAcerto.delete({ where: { id: liquidada.id } })).rejects.toThrow();
  await aplicar(true, true);
  expect(await prisma.efetivacaoAcertoEncerramento.count()).toBe(1);
  const { efetivarAcertoEncerramentoTx } = await import("./encerramento-efetivar-tx");
  const repetir = (alunoId = input.alunoId) => prisma.$transaction(tx => efetivarAcertoEncerramentoTx(tx, { alunoId, decisaoId: decisao.dado!.id, executorId: usuarioId }, new Date("2099-10-01T12:00:00Z")));
  await expect(repetir("outro-aluno")).rejects.toThrow("não encontrado");
  await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: false } });
  await expect(repetir()).rejects.toThrow();
  await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: true } });
  const repetido = await repetir();
  await expect(prisma.efetivacaoAcertoEncerramento.delete({ where: { id: repetido.id } })).rejects.toThrow();
  expect(await prisma.movimentacaoAluno.count({ where: { matriculaId: m.id, tipo: "ENCERRAMENTO" } })).toBe(1);
  expect(await prisma.creditoMatricula.count()).toBe(1);
  expect((await prisma.solicitacaoEncerramentoMatriculas.findUniqueOrThrow({ where: { id: pedido.dado.solicitacaoId } })).status).toBe("CONCLUIDA");
  expect((await prisma.matricula.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("ENCERRADA");
  authMock.mockResolvedValue({ user: { id: usuarioId } });
  expect(await consultarComprasHorasAntecipadas({ alunoId: input.alunoId, matriculaId: m.id })).toMatchObject({ ok: true, dado: { compras: [{ minutosDisponiveis: 0, minutosConvertidosCredito: 180 }] } });
  const apurado = await prisma.$transaction(tx => carregarHorasEncerramentoTx(tx, input.alunoId, m.id));
  expect(apurado.calculo).toMatchObject({ creditoApurado: "0.00", compras: [{ minutosLiquidados: 180, minutosPendentes: 0 }] });
  const professor = await criarUsuario(["PROFESSOR"]);
  const encontro = await prisma.encontroAgenda.create({ data: { matriculaId: m.id, professorId: professor.id, preparadorId: usuarioId, inicio: new Date("2099-10-01T12:00:00Z"), fim: new Date("2099-10-01T13:00:00Z"), motivo: "Encontro para conferir saldo", chaveIdempotencia: "encontro-apos-acerto", entradaHash: "teste", fusoOrigem: "America/Sao_Paulo", status: "PREVISTO" } });
  expect(await reservarHorasCompradasParaEncontro({ compraId: compra.dado.id, encontroId: encontro.id, motivo: "Tentativa após liquidação", chaveIdempotencia: "reserva-apos-liquidacao" })).toMatchObject({ ok: false });
  await expect(prisma.reservaHorasCompradas.create({ data: { compraId: compra.dado.id, encontroId: encontro.id, autorId: usuarioId, minutos: 60, inicio: encontro.inicio, fim: encontro.fim, motivo: "Tentativa direta após liquidação", chaveIdempotencia: "sql-apos-liquidacao", entradaHash: "teste" } })).rejects.toThrow("Compra liquidada");
});

it("cancelamento do aluno não usa a liberação ou crédito próprios de cancelamento da escola", async () => {
  const c = await prepararReservaParaLiberacao();
  const cancelamentoId = await cancelarPelaEscola(c, "ALUNO");
  const d = { reservaId: c.reservaId, evidenciaEscolhaRemarcacao: "Escolha informada pelo aluno", motivo: "Pedido de ajuste após cancelamento", chaveIdempotencia: "origem-aluno-liberacao" };
  expect(await proporLiberacaoHorasRemarcacao(d)).toMatchObject({ ok: false, erro: expect.stringContaining("da escola") });
  expect(await proporLiberacaoHorasRemarcacao({ ...d, destino: "CREDITO" })).toMatchObject({ ok: false });
  await expect(prisma.propostaLiberacaoHoras.create({ data: { ...d, cancelamentoId, preparadorId: usuarioId, entradaHash: "direto", destino: "REMARCACAO" } })).rejects.toThrow(/origem ESCOLA/);
  expect(await prisma.propostaLiberacaoHoras.count()).toBe(0);
  expect(await prisma.creditoMatricula.count()).toBe(0);
});
