import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async original => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: async (...papeis: import("@prisma/client").Papel[]) => {
    const session = await authMock(); const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id } });
    if (!usuario.ativo) throw new real.ErroPermissao(); real.exigirPapel(usuario, ...papeis); return usuario;
  } };
});
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { receberTx } from "@/server/financeiro/recebimentos";
import { prepararCondicoesHoras, decidirCondicoesHoras } from "./condicoes-horas";
import { registrarCompraHorasAntecipadas, consultarComprasHorasAntecipadas } from "./compra-horas";
import { reservarHorasCompradasParaEncontro } from "./reserva-horas-compradas";
import { registrarOcorrenciaParticular } from "./ocorrencia-particular";
import { preverConferenciaOcorrenciaHoras } from "./ocorrencia-financeira-previa";
import { conferirOcorrenciaHoras } from "./ocorrencia-financeira-conferir";
import { carregarApuracaoHorasTx } from "./fechamento-horas-tx";
import { carregarHorasEncerramentoTx } from "./encerramento-horas-tx";
import { proporCancelamentoParticular, decidirCancelamentoParticular } from "@/server/agenda/cancelamento-particular";

let alunoId: string, matriculaId: string, documentoId: string, financeiroId: string, secretariaId: string, adminId: string;
const regras = { valorHora: "125.00", moeda: "CRC", unidadeMinutos: 60 as const, vigenteDesde: "2026-01-01T00:00:00Z", antecedenciaCancelamentoMinutos: 90, clausulaPreco: "Preço da hora", clausulaCancelamento: "Antecedência contratada" };
const login = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  vi.useRealTimers(); await truncarBanco(); const catalogo = await seedCatalogoMinimo();
  financeiroId = (await criarUsuario(["FINANCEIRO"])).id; secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id; adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Horas por ocorrência", paisId: catalogo.pais.id } }); alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: { alunoId, paisId: catalogo.pais.id, produtoId: catalogo.produto.id, moeda: "CRC", status: "ATIVA" } }); matriculaId = matricula.id;
  const documento = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato por hora", url: "/api/files/horas-ocorrencia.pdf" } }); documentoId = documento.id;
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true, contratoDocumentoId: documentoId, confirmacaoContratoPorId: secretariaId, confirmacaoContratoEm: new Date("2026-09-01T12:00:00Z") } });
  login(secretariaId); const condicoes = await prepararCondicoesHoras({ matriculaId, documentoId, regras, motivo: "Condições por hora conferidas" });
  if (!condicoes.ok || !condicoes.dado) throw new Error("Condições ausentes");
  login(adminId); expect(await decidirCondicoesHoras({ id: condicoes.dado.id, aprovar: true, motivo: "Condições aprovadas independentemente" })).toMatchObject({ ok: true });
  const cobranca = await prisma.cobranca.create({ data: { matriculaId, tipo: "HORA_PARTICULAR", moeda: "CRC", valorOriginal: 360, valorNegociado: 300, valorRecebido: 0, saldo: 300, status: "PENDENTE", vencimento: new Date("2026-09-10T00:00:00Z") } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, chaveIdempotencia: "q92-recebimento-original", autorId: financeiroId, valorRecebido: 300, moeda: "CRC", forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-10T12:00:00Z"), evidencia: "Recebimento original da compra antecipada" }));
});

async function prepararReserva(tipo: "FALTA_ALUNO" | "CANCELAMENTO_ALUNO" | "CANCELAMENTO_ESCOLA", chave: string, antecedente = false) {
  login(financeiroId);
  const cobranca = await prisma.cobranca.create({ data: { matriculaId, tipo: "HORA_PARTICULAR", moeda: "CRC", valorOriginal: 360, valorNegociado: 300, valorRecebido: 0, saldo: 300, status: "PENDENTE", vencimento: new Date("2026-09-10T00:00:00Z") } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, chaveIdempotencia: `q92-recebimento-${chave}`, autorId: financeiroId, valorRecebido: 300, moeda: "CRC", forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-10T12:00:00Z"), evidencia: "Recebimento original da compra antecipada" }));
  const cobrancaAtual = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
  const compra = await registrarCompraHorasAntecipadas({ alunoId, matriculaId, cobrancaId: cobranca.id, versaoCobranca: cobrancaAtual.versao, minutosComprados: 180, evidenciaCondicoes: "Compra quitada antes do encontro", chaveIdempotencia: `q92-compra-${chave}` });
  if (!compra.ok || !compra.dado) throw new Error(compra.ok ? "Compra ausente" : compra.erro);
  const professor = await criarUsuario(["PROFESSOR"]);
  // Os três cenários são preparados antes deste horário comum. A espera
  // seguinte simula a passagem real do encontro, sem alterar fonte ou relógio.
  const inicio = new Date(Date.now() + 20_000), fim = new Date(inicio.getTime() + 60_000);
  const encontro = await prisma.encontroAgenda.create({ data: { matriculaId, professorId: professor.id, preparadorId: adminId, inicio, fim, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Encontro reservado para ocorrência", chaveIdempotencia: `q92-encontro-${chave}`, entradaHash: "fixture" } });
  const reserva = await reservarHorasCompradasParaEncontro({ compraId: compra.dado.id, encontroId: encontro.id, motivo: "Reserva da compra quitada", chaveIdempotencia: `q92-reserva-${chave}` });
  if (!reserva.ok || !reserva.dado) throw new Error("Reserva ausente");
  if (tipo.startsWith("CANCELAMENTO")) {
    login(professor.id); const proposta = await proporCancelamentoParticular({ encontroId: encontro.id, origem: tipo === "CANCELAMENTO_ALUNO" ? "ALUNO" : "ESCOLA", motivo: "Cancelamento proposto com origem registrada", chaveIdempotencia: `q92-cancelamento-${chave}` });
    if (!proposta.ok || !proposta.dado) throw new Error("Cancelamento ausente");
    login(adminId); expect(await decidirCancelamentoParticular({ propostaId: proposta.dado.id, aprovar: true, motivo: "Cancelamento aprovado" })).toMatchObject({ ok: true });
  }
  return { tipo, antecedente, compraId: compra.dado.id, encontro, reservaId: reserva.dado.id, professor };
}

async function registrarOcorrenciaDaReserva(c: Awaited<ReturnType<typeof prepararReserva>>) {
  login(c.professor.id); const ocorrencia = await registrarOcorrenciaParticular({ encontroId: c.encontro.id, versaoAnterior: 0, tipo: c.tipo,
    ...(c.tipo.startsWith("CANCELAMENTO") ? { comunicadoEm: new Date(c.encontro.inicio.getTime() - (c.antecedente ? 2 * 60 : 60) * 60_000).toISOString() } : {}), evidencia: "Ocorrência contratual registrada", chaveIdempotencia: `q92-ocorrencia-${c.reservaId}` });
  if (!ocorrencia.ok || !ocorrencia.dado) throw new Error("Ocorrência ausente");
  login(financeiroId); const condicoes = await prisma.condicoesHorasMatricula.findFirstOrThrow({ where: { matriculaId, status: "APROVADA" } });
  return { ...c, entrada: { alunoId, matriculaId, ocorrenciaId: ocorrencia.dado.id, condicoesId: condicoes.id } };
}

async function reservarOutraMatricula(chave: string) {
  const original = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId, paisId: original.paisId, produtoId: original.produtoId, moeda: "CRC", status: "ATIVA" } });
  const documento = await prisma.documento.create({ data: { matriculaId: outra.id, categoria: "CONTRATO", nome: "Contrato isolado", url: "/api/files/contrato-isolado.pdf" } });
  await prisma.matricula.update({ where: { id: outra.id }, data: { contratoOk: true, contratoDocumentoId: documento.id, confirmacaoContratoPorId: secretariaId, confirmacaoContratoEm: new Date("2026-09-01T12:00:00Z") } });
  const cobranca = await prisma.cobranca.create({ data: { matriculaId: outra.id, tipo: "HORA_PARTICULAR", moeda: "CRC", valorOriginal: 360, valorNegociado: 300, valorRecebido: 0, saldo: 300, status: "PENDENTE", vencimento: new Date("2026-09-10T00:00:00Z") } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, chaveIdempotencia: `q92-outra-recebimento-${chave}`, autorId: financeiroId, valorRecebido: 300, moeda: "CRC", forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-10T12:00:00Z"), evidencia: "Recebimento de outro contrato" }));
  login(financeiroId); const atual = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
  const compra = await registrarCompraHorasAntecipadas({ alunoId, matriculaId: outra.id, cobrancaId: cobranca.id, versaoCobranca: atual.versao, minutosComprados: 180, evidenciaCondicoes: "Compra isolada para teste de vínculo", chaveIdempotencia: `q92-outra-compra-${chave}` });
  if (!compra.ok || !compra.dado) throw new Error(compra.ok ? "Compra isolada ausente" : compra.erro);
  const professor = await criarUsuario(["PROFESSOR"]), inicio = new Date(Date.now() + 20_000), fim = new Date(inicio.getTime() + 60_000);
  const encontro = await prisma.encontroAgenda.create({ data: { matriculaId: outra.id, professorId: professor.id, preparadorId: adminId, inicio, fim, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Outro contrato reservado", chaveIdempotencia: `q92-outra-encontro-${chave}`, entradaHash: "fixture" } });
  const reserva = await reservarHorasCompradasParaEncontro({ compraId: compra.dado.id, encontroId: encontro.id, motivo: "Reserva de outro contrato", chaveIdempotencia: `q92-outra-reserva-${chave}` });
  if (!reserva.ok || !reserva.dado) throw new Error(reserva.ok ? "Reserva isolada ausente" : reserva.erro);
  return { matriculaId: outra.id, reservaId: reserva.dado.id };
}

it("consome falta e cancelamento tardio com reserva sem caixa e bloqueia escrita SQL", async () => {
  const agendadas = [
    await prepararReserva("FALTA_ALUNO", "falta"),
    await prepararReserva("CANCELAMENTO_ALUNO", "tardio"),
    await prepararReserva("FALTA_ALUNO", "sql"),
  ];
  await new Promise(resolve => setTimeout(resolve, Math.max(...agendadas.map(c => c.encontro.fim.getTime())) - Date.now() + 1_000));
  const [falta, tardio, sql] = [
    await registrarOcorrenciaDaReserva(agendadas[0]),
    await registrarOcorrenciaDaReserva(agendadas[1]),
    await registrarOcorrenciaDaReserva(agendadas[2]),
  ];
  const antes = { recebimentos: await prisma.recebimento.findMany(), cobrancas: await prisma.cobranca.findMany() };
  const consumos: Array<{ c: typeof falta; consumo: { id: string }; desfecho: string }> = [];
  for (const [c, desfecho, chave] of [[falta, "FALTA_COBRAVEL", "falta"], [tardio, "CANCELAMENTO_TARDIO", "tardio"]] as const) {
    const previa = await preverConferenciaOcorrenciaHoras(c.entrada); if (!previa.ok || !previa.dado) throw new Error("Prévia ausente");
    expect(previa.dado).toMatchObject({ classificacao: { desfecho }, valorApurado: "1.67", valorContratualInformativo: "2.08", reservaAntecipada: { reservaId: c.reservaId, compraId: c.compraId, minutos: 1, valorPagoAlocado: "300.00" }, pendencias: [] });
    const entrada = { ...c.entrada, estadoPrevia: previa.dado.estadoPrevia, motivo: "Ocorrência e compra original conferidas", chaveIdempotencia: `q92-conferencia-${chave}` };
    const [primeira, repetida] = await Promise.all([conferirOcorrenciaHoras(entrada), conferirOcorrenciaHoras(entrada)]);
    if (!primeira.ok || !primeira.dado) throw new Error(primeira.ok ? "Conferência sem resultado" : primeira.erro);
    expect(repetida).toEqual(primeira);
    const consumo = await prisma.consumoHorasCompradas.findUniqueOrThrow({ where: { reservaId: c.reservaId }, include: { conferenciaOcorrencia: true } });
    expect(consumo).toMatchObject({ estadoDiario: null, conferenciaOcorrencia: { id: primeira.dado.id, desfecho } });
    const consulta = await consultarComprasHorasAntecipadas({ alunoId, matriculaId });
    if (!consulta.ok || !consulta.dado) throw new Error(consulta.ok ? "Consulta sem resultado" : consulta.erro);
    expect(consulta.dado.compras.find(compra => compra.id === c.compraId)).toMatchObject({ minutosConsumidos: 1, minutosDisponiveis: 179, reservas: [{ id: c.reservaId, consumo: { conferenciaOcorrencia: { desfecho } } }] });
    consumos.push({ c, consumo, desfecho });
  }
  expect(await prisma.aulaDiario.count()).toBe(0); expect(await prisma.recebimento.findMany()).toEqual(antes.recebimentos); expect(await prisma.cobranca.findMany()).toEqual(antes.cobrancas);
  const previaSql = await preverConferenciaOcorrenciaHoras(sql.entrada); if (!previaSql.ok || !previaSql.dado) throw new Error("Prévia SQL ausente");
  const { estadoPrevia, ...snapshot } = previaSql.dado;
  await expect(prisma.$transaction(tx => tx.conferenciaOcorrenciaHoras.create({ data: { encontroId: sql.encontro.id, ocorrenciaId: sql.entrada.ocorrenciaId, condicoesId: sql.entrada.condicoesId, conferenteId: financeiroId, minutos: previaSql.dado!.minutos, valor: previaSql.dado!.valorApurado, moeda: previaSql.dado!.moeda, desfecho: previaSql.dado!.classificacao.desfecho, snapshot, estadoPrevia, motivo: "Inserção sem consumo atômico", chaveIdempotencia: "q92-sql-sem-consumo", entradaHash: "q92-sql" } }))).rejects.toThrow(/consumo atômico/);
  const confirmada = await conferirOcorrenciaHoras({ ...sql.entrada, estadoPrevia: previaSql.dado.estadoPrevia, motivo: "Conferência regular da reserva", chaveIdempotencia: "q92-conferencia-regular" });
  if (!confirmada.ok || !confirmada.dado) throw new Error(confirmada.ok ? "Conferência SQL sem resultado" : confirmada.erro);
  const consumoAntes = await prisma.consumoHorasCompradas.findUniqueOrThrow({ where: { reservaId: sql.reservaId } });
  consumos.push({ c: sql, consumo: consumoAntes, desfecho: "FALTA_COBRAVEL" });
  await expect(prisma.ocorrenciaParticular.create({ data: { encontroId: sql.encontro.id, matriculaId, autorId: sql.professor.id, versao: 2, tipo: "FALTA_ALUNO", inicio: sql.encontro.inicio, fim: sql.encontro.fim, evidencia: "Tentativa de alterar fonte já conferida", chaveIdempotencia: "q92-sql-revisao-posterior", entradaHash: "q92-sql-revisao" } })).rejects.toThrow(/conferido exige revisão dos efeitos financeiros/);
  expect(await prisma.ocorrenciaParticular.count({ where: { encontroId: sql.encontro.id } })).toBe(1);
  expect(await prisma.consumoHorasCompradas.findUniqueOrThrow({ where: { reservaId: sql.reservaId } })).toMatchObject({ id: consumoAntes.id, conferenciaOcorrenciaId: confirmada.dado.id });
  await expect(prisma.consumoHorasCompradas.create({ data: { reservaId: sql.reservaId, autorId: financeiroId, motivo: "Tentativa sem fonte válida" } })).rejects.toThrow(/exatamente diário ou conferência/);
  await expect(prisma.consumoHorasCompradas.create({ data: { reservaId: sql.reservaId, conferenciaOcorrenciaId: confirmada.dado.id, autorId: financeiroId, estadoDiario: "a".repeat(64), motivo: "Tentativa com as duas fontes" } })).rejects.toThrow(/exatamente diário ou conferência/);
  const conferenciaFalta = await prisma.conferenciaOcorrenciaHoras.findUniqueOrThrow({ where: { encontroId: falta.encontro.id } });
  const outra = await reservarOutraMatricula("vinculo-cruzado");
  await expect(prisma.consumoHorasCompradas.create({ data: { reservaId: outra.reservaId, conferenciaOcorrenciaId: conferenciaFalta.id, autorId: financeiroId, motivo: "Tentativa de usar conferência de outra matrícula" } })).rejects.toThrow(/reserva, compra e agenda compatíveis|conferência cobrável da reserva vigente/);
  expect(await prisma.consumoHorasCompradas.count({ where: { reservaId: outra.reservaId } })).toBe(0);
  const apuracao = await prisma.$transaction(tx => carregarApuracaoHorasTx(tx, { alunoId, matriculaId, periodo: { referencia: "q92-setembro", inicio: "2026-09-01T00:00:00Z", fimExclusivo: "2026-10-01T00:00:00Z" }, vencimento: "2026-10-10", escolha: "AGUARDAR" }));
  expect(apuracao).toMatchObject({ estado: "SEM_ITENS_A_FATURAR", totalApurado: "0.00", preservados: expect.arrayContaining(consumos.map(({ c, consumo }) => ({ encontroId: c.encontro.id, destinacao: { tipo: "ANTECIPACAO_CONFERIDA", registroId: consumo.id } }))) });
  const encerramento = await prisma.$transaction(tx => carregarHorasEncerramentoTx(tx, alunoId, matriculaId));
  for (const { c, consumo, desfecho } of consumos) {
    expect(encerramento.pendencias).toEqual([]);
    expect(encerramento.origens.find(origem => origem.compraId === c.compraId)).toMatchObject({ consumos: [{ id: consumo.id, minutos: 1, motivo: desfecho === "FALTA_COBRAVEL" ? "FALTA_COBRAVEL" : "CANCELAMENTO_TARDIO_COBRAVEL" }] });
  }
}, 120_000);

it("não consome reserva em cancelamento no prazo ou da escola", async () => {
  const noPrazo = await prepararReserva("CANCELAMENTO_ALUNO", "no-prazo", true);
  const escola = await prepararReserva("CANCELAMENTO_ESCOLA", "escola", true);
  const [ocorrenciaNoPrazo, ocorrenciaEscola] = [await registrarOcorrenciaDaReserva(noPrazo), await registrarOcorrenciaDaReserva(escola)];
  const antes = { cobrancas: await prisma.cobranca.findMany(), recebimentos: await prisma.recebimento.findMany() };
  for (const [c, desfecho, chave] of [[ocorrenciaNoPrazo, "CANCELAMENTO_NO_PRAZO", "no-prazo"], [ocorrenciaEscola, "CANCELAMENTO_ESCOLA", "escola"]] as const) {
    const previa = await preverConferenciaOcorrenciaHoras(c.entrada);
    if (!previa.ok || !previa.dado) throw new Error(previa.ok ? "Prévia sem resultado" : previa.erro);
    expect(previa.dado).toMatchObject({ classificacao: { desfecho }, pendencias: [expect.stringMatching(/reserva antecipada só é consumida/)] });
    expect(previa.dado.reservaAntecipada).toBeUndefined();
    const resultado = await conferirOcorrenciaHoras({ ...c.entrada, estadoPrevia: previa.dado.estadoPrevia, motivo: "Cancelamento não consome antecipação", chaveIdempotencia: `q92-bloqueio-${chave}` });
    expect(resultado).toMatchObject({ ok: false });
    expect(await prisma.conferenciaOcorrenciaHoras.count({ where: { encontroId: c.encontro.id } })).toBe(0);
    expect(await prisma.consumoHorasCompradas.count({ where: { reservaId: c.reservaId } })).toBe(0);
  }
  expect(await prisma.cobranca.findMany()).toEqual(antes.cobrancas);
  expect(await prisma.recebimento.findMany()).toEqual(antes.recebimentos);
});
