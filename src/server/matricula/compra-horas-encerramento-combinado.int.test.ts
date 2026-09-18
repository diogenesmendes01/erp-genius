import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async original => {
  const real = await original<typeof import("@/server/_shared")>();
  return {
    ...real,
    exigirSessaoComPapel: async (...papeis: import("@prisma/client").Papel[]) => {
      const session = await authMock();
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, nome: true, papeis: true, ativo: true } });
      if (!usuario.ativo) throw new real.ErroPermissao();
      real.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { receberTx } from "@/server/financeiro/recebimentos";
import { proporUtilizacaoCredito } from "@/server/financeiro/uso-credito-proposta";
import { decidirUtilizacaoCredito } from "@/server/financeiro/uso-credito-decisao";
import { registrarCompraHorasAntecipadas } from "./compra-horas";
import { reservarHorasCompradasParaEncontro } from "./reserva-horas-compradas";
import { conferirRealizacaoHoras } from "./consumo-horas";
import { proporCancelamentoParticular, decidirCancelamentoParticular } from "@/server/agenda/cancelamento-particular";
import { proporLiberacaoHorasRemarcacao, decidirLiberacaoHorasRemarcacao } from "./liberacao-horas";
import { prepararCondicoesEncerramento, decidirCondicoesEncerramento } from "./condicoes-encerramento";
import { solicitarEncerramentoMatriculas } from "./encerramento-solicitacao";
import { salvarRascunhoAcertoEncerramento } from "./encerramento-rascunho";
import { decidirAcertoEncerramento } from "./encerramento-decisao";
import { efetivarAcertoEncerramento } from "./encerramento-efetivar";

let financeiroId: string;
let secretariaId: string;
let adminId: string;
let alunoId: string;
let matriculaId: string;
let documentoId: string;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function criarCobrancaHora(valor: string, chave: string) {
  return prisma.cobranca.create({ data: {
    matriculaId,
    tipo: "HORA_PARTICULAR",
    moeda: "CRC",
    valorOriginal: valor,
    valorNegociado: valor,
    valorRecebido: 0,
    saldo: valor,
    status: "PENDENTE",
    vencimento: new Date("2099-09-01T00:00:00.000Z"),
    codigo: chave,
  } });
}

async function quitarEmDinheiro(cobrancaId: string, valor: string, chave: string) {
  return prisma.$transaction(tx => receberTx(tx, {
    cobrancaId,
    autorId: financeiroId,
    valorRecebido: Number(valor),
    forma: "TRANSFERENCIA",
    dataPagamento: new Date("2099-08-15T12:00:00.000Z"),
    evidencia: "Comprovante financeiro conferido para compra antecipada.",
    chaveIdempotencia: chave,
  }));
}

async function criarCreditoAprovadoPorCancelamento() {
  const cobranca = await criarCobrancaHora("300.00", "hora-fonte-credito-q97");
  await quitarEmDinheiro(cobranca.id, "300.00", "pagamento-fonte-credito-q97");
  const atual = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
  entrar(financeiroId);
  const compra = await registrarCompraHorasAntecipadas({
    alunoId,
    matriculaId,
    cobrancaId: cobranca.id,
    versaoCobranca: atual.versao,
    minutosComprados: 180,
    evidenciaCondicoes: "Condições originais da compra de horas fonte conferidas.",
    chaveIdempotencia: "compra-fonte-credito-q97",
  });
  if (!compra.ok || !compra.dado) throw new Error(compra.ok ? "Compra fonte ausente" : compra.erro);

  const professor = await criarUsuario(["PROFESSOR"]);
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const encontro = await prisma.encontroAgenda.create({ data: {
    matriculaId,
    professorId: professor.id,
    preparadorId: gestor.id,
    inicio: new Date("2099-09-05T12:00:00.000Z"),
    fim: new Date("2099-09-05T14:00:00.000Z"),
    fusoOrigem: "UTC",
    status: "PREVISTO",
    motivo: "Encontro cancelado pela escola que origina crédito aprovado.",
    chaveIdempotencia: "encontro-fonte-credito-q97",
    entradaHash: "fixture-fonte-credito-q97",
  } });
  const reserva = await reservarHorasCompradasParaEncontro({
    compraId: compra.dado.id,
    encontroId: encontro.id,
    motivo: "Reservar horas antecipadas antes do cancelamento pela escola.",
    chaveIdempotencia: "reserva-fonte-credito-q97",
  });
  if (!reserva.ok || !reserva.dado) throw new Error(reserva.ok ? "Reserva fonte ausente" : reserva.erro);

  entrar(professor.id);
  const cancelamento = await proporCancelamentoParticular({
    encontroId: encontro.id,
    motivo: "A escola não poderá realizar o encontro contratado.",
    chaveIdempotencia: "cancelamento-fonte-credito-q97",
  });
  if (!cancelamento.ok || !cancelamento.dado) throw new Error(cancelamento.ok ? "Cancelamento ausente" : cancelamento.erro);
  entrar(gestor.id);
  expect(await decidirCancelamentoParticular({
    propostaId: cancelamento.dado.id,
    aprovar: true,
    motivo: "Cancelamento pela escola conferido pela gestão pedagógica.",
  })).toMatchObject({ ok: true });

  entrar(financeiroId);
  const proposta = await proporLiberacaoHorasRemarcacao({
    reservaId: reserva.dado.id,
    destino: "CREDITO",
    evidenciaEscolhaRemarcacao: "Aluno escolheu crédito para o encontro cancelado pela escola.",
    motivo: "Converter a reserva cancelada em crédito financeiro rastreável.",
    chaveIdempotencia: "proposta-fonte-credito-q97",
  });
  if (!proposta.ok || !proposta.dado) throw new Error(proposta.ok ? "Proposta de crédito ausente" : proposta.erro);
  entrar(adminId);
  expect(await decidirLiberacaoHorasRemarcacao({
    propostaId: proposta.dado.id,
    aprovar: true,
    motivo: "Crédito do cancelamento aprovado por pessoa independente.",
  })).toMatchObject({ ok: true });
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { origemLiberacao: { propostaId: proposta.dado.id } } });
  return { credito, cobrancaId: cobranca.id, compraId: compra.dado.id };
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  financeiroId = (await criarUsuario(["FINANCEIRO"])).id;
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Q97 combinado", paisId: catalogo.pais.id } });
  alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
  matriculaId = matricula.id;
  const documento = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato de compra antecipada", url: "/api/files/q97-combinado.pdf" } });
  documentoId = documento.id;
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true, contratoDocumentoId: documentoId, confirmacaoContratoPorId: secretariaId, confirmacaoContratoEm: new Date("2099-08-01T12:00:00.000Z") } });
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "UTC" }, update: { fusoInstitucional: "UTC" } });
  entrar(financeiroId);
});

it("Q97 encerra compra antecipada com quitação mista, consumo parcial e replay sem duplicar crédito", async () => {
  const fonteCredito = await criarCreditoAprovadoPorCancelamento();
  const creditoAnterior = fonteCredito.credito;
  expect(creditoAnterior.valorInicial.toFixed(2)).toBe("200.00");

  const cobrancaCompra = await criarCobrancaHora("300.00", "hora-compra-mista-q97");
  entrar(financeiroId);
  const uso = await proporUtilizacaoCredito({
    creditoId: creditoAnterior.id,
    cobrancaId: cobrancaCompra.id,
    valor: "150.00",
    concordancia: "Aluno concordou em usar parte do crédito prévio nesta nova compra.",
    motivo: "Destinar crédito aprovado para a compra antecipada atual.",
    chaveIdempotencia: "uso-credito-compra-mista-q97",
  });
  if (!uso.ok || !uso.dado) throw new Error(uso.ok ? "Uso de crédito ausente" : uso.erro);
  entrar(adminId);
  expect(await decidirUtilizacaoCredito({ propostaId: uso.dado.id, aprovar: true, motivo: "Uso de crédito conferido por aprovador financeiro independente." })).toMatchObject({ ok: true });

  await quitarEmDinheiro(cobrancaCompra.id, "150.00", "pagamento-compra-mista-q97");
  const cobrancaPaga = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaCompra.id } });
  expect(cobrancaPaga).toMatchObject({ status: "PAGO" });
  expect(cobrancaPaga.valorRecebido?.toFixed(2)).toBe("150.00");
  expect(cobrancaPaga.valorLiquidadoCredito.toFixed(2)).toBe("150.00");

  entrar(financeiroId);
  const compra = await registrarCompraHorasAntecipadas({
    alunoId,
    matriculaId,
    cobrancaId: cobrancaPaga.id,
    versaoCobranca: cobrancaPaga.versao,
    minutosComprados: 180,
    evidenciaCondicoes: "Compra de 180 minutos nas condições financeiras originais conferidas.",
    chaveIdempotencia: "compra-mista-q97",
  });
  if (!compra.ok || !compra.dado) throw new Error(compra.ok ? "Compra mista ausente" : compra.erro);
  const registrada = await prisma.compraHorasAntecipadas.findUniqueOrThrow({ where: { id: compra.dado.id } });
  expect(registrada.snapshot).toMatchObject({ liquidacao: { valorEmDinheiro: "150.00", valorEmCredito: "150.00", valorTotal: "300.00" } });

  const professor = await criarUsuario(["PROFESSOR"]);
  const encontro = await prisma.encontroAgenda.create({ data: {
    matriculaId,
    professorId: professor.id,
    preparadorId: secretariaId,
    inicio: new Date("2099-09-10T12:00:00.000Z"),
    fim: new Date("2099-09-10T13:00:00.000Z"),
    fusoOrigem: "UTC",
    status: "PREVISTO",
    motivo: "Encontro realizado que consome parte da compra antecipada.",
    chaveIdempotencia: "encontro-consumo-misto-q97",
    entradaHash: "fixture-consumo-misto-q97",
  } });
  entrar(financeiroId);
  const reserva = await reservarHorasCompradasParaEncontro({
    compraId: compra.dado.id,
    encontroId: encontro.id,
    motivo: "Reservar 60 minutos da compra antecipada para encontro real.",
    chaveIdempotencia: "reserva-consumo-misto-q97",
  });
  if (!reserva.ok || !reserva.dado) throw new Error(reserva.ok ? "Reserva de consumo ausente" : reserva.erro);
  await prisma.aulaDiario.create({ data: { encontroId: encontro.id, professorId: professor.id, ocorridaEm: encontro.inicio, conteudo: "Aula realizada com presença registrada.", registros: { create: { alunoId, nomeAluno: "Q97 combinado", presente: true } } } });
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2099-09-11T12:00:00.000Z"));
    const revisaoConsumo = await conferirRealizacaoHoras({ reservaId: reserva.dado.id });
    if (!revisaoConsumo.ok || !revisaoConsumo.dado?.estadoDiario) throw new Error(revisaoConsumo.ok ? "Revisão de consumo ausente" : revisaoConsumo.erro);
    expect(await conferirRealizacaoHoras({ reservaId: reserva.dado.id, estadoDiario: revisaoConsumo.dado.estadoDiario, motivo: "Consumo da presença efetivamente realizada." })).toMatchObject({ ok: true });
  } finally {
    vi.useRealTimers();
  }

  const outroContrato = await prisma.matricula.create({ data: { alunoId, produtoId: (await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).produtoId, paisId: (await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).paisId, moeda: "CRC", status: "ATIVA" } });
  entrar(secretariaId);
  const condicoes = await prepararCondicoesEncerramento({
    matriculaId,
    documentoId,
    motivo: "Condições originais da contratação conferidas para encerramento Q97.",
    regras: { diaEncerramento: "INCLUIR", metodoDesconto: "ANTES_DO_PROPORCIONAL", condicoesDescontos: "Condições contratuais preservadas.", multa: { tipo: "SEM_PREVISAO", motivo: "Contrato não prevê multa de encerramento." } },
  });
  if (!condicoes.ok || !condicoes.dado) throw new Error(condicoes.ok ? "Condições ausentes" : condicoes.erro);
  entrar(adminId);
  expect(await decidirCondicoesEncerramento({ id: condicoes.dado.id, aprovar: true, motivo: "Condições de encerramento aprovadas independentemente." })).toMatchObject({ ok: true });

  entrar(secretariaId);
  const pedido = await solicitarEncerramentoMatriculas({
    alunoId,
    matriculaIds: [matriculaId],
    dataSolicitada: "2099-09-30",
    motivo: "Aluno solicitou encerramento da contratação por horas.",
    evidenciaPedido: "Pedido de encerramento registrado pela Secretaria.",
    chaveIdempotencia: "pedido-q97-compra-mista",
  });
  if (!pedido.ok || !pedido.dado) throw new Error(pedido.ok ? "Pedido ausente" : pedido.erro);

  const atual = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaCompra.id } });
  const cobrancaFonte = await prisma.cobranca.findUniqueOrThrow({ where: { id: fonteCredito.cobrancaId } });
  entrar(financeiroId);
  const rascunho = await salvarRascunhoAcertoEncerramento({
    alunoId,
    solicitacaoId: pedido.dado.solicitacaoId,
    versaoAnterior: 0,
    motivo: "Apuração Q97 da compra antecipada quitada com dinheiro e crédito.",
    chaveIdempotencia: "rascunho-q97-compra-mista",
    contratos: [{
      matriculaId,
      condicoesId: condicoes.dado.id,
      parcelas: [],
      multa: { tipo: "SEM_PREVISAO" },
      outrasCobrancas: [{
        cobrancaId: atual.id,
        versao: atual.versao,
        valorDevidoProposto: "300.00",
        motivo: "Preservar a compra antecipada já integralmente liquidada.",
        evidenciaContratual: "Condições originais e quitação mista estão no histórico imutável.",
      }, {
        cobrancaId: cobrancaFonte.id,
        versao: cobrancaFonte.versao,
        valorDevidoProposto: "300.00",
        motivo: "Preservar a compra fonte do crédito já aplicado nesta contratação.",
        evidenciaContratual: "Cancelamento aprovado e origem do crédito permanecem rastreáveis.",
      }],
    }],
  });
  if (!rascunho.ok || !rascunho.dado) throw new Error(rascunho.ok ? "Rascunho ausente" : rascunho.erro);
  entrar(adminId);
  const decisao = await decidirAcertoEncerramento({ alunoId, rascunhoId: rascunho.dado.id, aprovar: true, motivo: "Saldo restante de horas e origens financeiras conferidos." });
  if (!decisao.ok || !decisao.dado) throw new Error(decisao.ok ? "Decisão ausente" : decisao.erro);

  entrar(financeiroId);
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date("2099-09-30T12:00:00.000Z"));
    const entrada = { alunoId, decisaoId: decisao.dado.id };
    const [primeira, repetida] = await Promise.all([efetivarAcertoEncerramento(entrada), efetivarAcertoEncerramento(entrada)]);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    expect(repetida).toEqual(primeira);
  } finally {
    vi.useRealTimers();
  }

  const liquidacao = await prisma.liquidacaoHorasAcerto.findUniqueOrThrow({ where: { compraId: compra.dado.id } });
  expect(liquidacao).toMatchObject({ decisaoId: decisao.dado.id, minutos: 120 });
  expect(liquidacao.valor.toFixed(2)).toBe("200.00");
  const liquidacaoFonte = await prisma.liquidacaoHorasAcerto.findUniqueOrThrow({ where: { compraId: fonteCredito.compraId } });
  expect(liquidacaoFonte).toMatchObject({ decisaoId: decisao.dado.id, minutos: 60 });
  expect(liquidacaoFonte.valor.toFixed(2)).toBe("100.00");
  const creditoQ97 = await prisma.creditoMatricula.findFirstOrThrow({ where: { origemAcerto: { decisaoId: decisao.dado.id, origemId: compra.dado.id } } });
  expect(creditoQ97).toMatchObject({ matriculaId, moeda: "CRC" });
  expect(creditoQ97.valorInicial.toFixed(2)).toBe("200.00");
  const creditoFonteQ97 = await prisma.creditoMatricula.findFirstOrThrow({ where: { origemAcerto: { decisaoId: decisao.dado.id, origemId: fonteCredito.compraId } } });
  expect(creditoFonteQ97.valorInicial.toFixed(2)).toBe("100.00");

  expect(await prisma.liquidacaoHorasAcerto.count({ where: { compraId: compra.dado.id } })).toBe(1);
  expect(await prisma.liquidacaoHorasAcerto.count({ where: { decisaoId: decisao.dado.id } })).toBe(2);
  expect(await prisma.creditoMatricula.count({ where: { origemAcerto: { decisaoId: decisao.dado.id } } })).toBe(2);
  const preservada = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaCompra.id } });
  expect(preservada.valorRecebido?.toFixed(2)).toBe("150.00");
  expect(preservada.valorLiquidadoCredito.toFixed(2)).toBe("150.00");
  expect(preservada.saldo?.toFixed(2)).toBe("0.00");
  expect(await prisma.destinacaoRecebimento.count({ where: { cobrancaId: cobrancaCompra.id, tipo: "COBRANCA", valor: "150.00" } })).toBe(1);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "ENCERRADA" });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outroContrato.id } })).toMatchObject({ status: "ATIVA" });
});
