import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return {
    ...real,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const sessao = await authMock();
      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: sessao.user.id },
        select: { id: true, nome: true, papeis: true, ativo: true },
      });
      if (!usuario.ativo) throw new real.ErroPermissao();
      real.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { registrarRecebimentoDestinado } from "@/server/financeiro/acoes";
import { decidirUtilizacaoCredito } from "@/server/financeiro/uso-credito-decisao";
import { proporUtilizacaoCredito } from "@/server/financeiro/uso-credito-proposta";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedRelatoOfertaConfirmado } from "@/test/indisponibilidade-oferta";
import { decidirCompensacaoCobertura, prepararCompensacaoCobertura } from "./compensacao-cobertura";
import { decidirAcertoEncerramento } from "./encerramento-decisao";
import { efetivarAcertoEncerramento } from "./encerramento-efetivar";
import { preverComponenteMensalEncerramento } from "./encerramento-previa";
import { salvarRascunhoAcertoEncerramento } from "./encerramento-rascunho";
import { solicitarEncerramentoMatriculas } from "./encerramento-solicitacao";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

let alunoId: string;
let matriculaAId: string;
let matriculaBId: string;
let secretariaId: string;
let financeiroId: string;
let aprovadorId: string;

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria CT10 completa")).id;
  financeiroId = (await criarUsuario([Papel.FINANCEIRO], "Financeiro CT10 completa")).id;
  aprovadorId = (await criarUsuario([Papel.ADMINISTRADOR], "Aprovador CT10 completa")).id;
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" },
    create: { id: "escola", fusoInstitucional: "America/Sao_Paulo" },
    update: { fusoInstitucional: "America/Sao_Paulo" },
  });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "CT10 completo", paisId: catalogo.pais.id } });
  alunoId = aluno.id;
  matriculaAId = (await prisma.matricula.create({
    data: { alunoId, paisId: catalogo.pais.id, produtoId: catalogo.produto.id, moeda: "CRC", status: "ATIVA" },
  })).id;
  matriculaBId = (await prisma.matricula.create({
    data: { alunoId, paisId: catalogo.pais.id, produtoId: catalogo.produto.id, moeda: "CRC", status: "ATIVA" },
  })).id;
});

it("CT10 completo: encerra um contrato com desconto, multa, caixa, crédito e dias compensados sem tocar o outro", async () => {
  // Contrato e condições são fixtures sintéticas já conferidas; emissão e assinatura não pertencem a este cenário de acerto.
  const documento = await prisma.documento.create({
    data: { matriculaId: matriculaAId, nome: "Contrato CT10 completo", categoria: "CONTRATO", url: "/api/files/ct10-completo.pdf" },
  });
  await prisma.matricula.update({
    where: { id: matriculaAId },
    data: {
      contratoOk: true,
      contratoDocumentoId: documento.id,
      confirmacaoContratoEm: new Date("2099-09-01T09:00:00Z"),
      confirmacaoContratoPorId: secretariaId,
    },
  });
  const condicoes = await prisma.condicoesEncerramentoMatricula.create({
    data: {
      matriculaId: matriculaAId,
      documentoId: documento.id,
      preparadorId: secretariaId,
      decisorId: aprovadorId,
      status: "APROVADA",
      decididaEm: new Date("2099-09-01T10:00:00Z"),
      motivo: "Condições de encerramento transcritas do contrato sintético",
      motivoDecisao: "Conferência independente das condições contratuais",
      versao: 1,
      regras: {
        diaEncerramento: "INCLUIR",
        metodoDesconto: "ANTES_DO_PROPORCIONAL",
        condicoesDescontos: "Desconto contratual aplicável antes do proporcional",
        multa: {
          tipo: "VALOR_FIXO",
          valor: "80.00",
          clausulaId: "CT10-7",
          condicoesAplicacao: "Encerramento antecipado previsto no contrato",
        },
      },
    },
  });
  const mensalidade = await prisma.cobranca.create({
    data: {
      matriculaId: matriculaAId,
      tipo: "MENSALIDADE",
      moeda: "CRC",
      valorOriginal: 500,
      valorNegociado: 400,
      saldo: 400,
      vencimento: new Date("2099-09-05T00:00:00Z"),
      coberturaInicio: new Date("2099-09-01T00:00:00Z"),
      coberturaFim: new Date("2099-09-30T00:00:00Z"),
    },
  });
  const cobrancaB = await prisma.cobranca.create({
    data: {
      matriculaId: matriculaBId,
      tipo: "MENSALIDADE",
      moeda: "CRC",
      valorOriginal: 333,
      valorNegociado: 333,
      saldo: 333,
      vencimento: new Date("2099-09-05T00:00:00Z"),
    },
  });
  entrar(financeiroId);
  const creditoBOrigem = await registrarRecebimentoDestinado({
    titularMatriculaId: matriculaBId,
    chaveIdempotencia: "ct10-completo-credito-b-001",
    valorRecebido: 25,
    moeda: "CRC",
    forma: "TRANSFERENCIA",
    dataPagamento: new Date("2099-09-09T12:00:00Z"),
    comentario: "Crédito próprio do contrato B que o acerto de A não pode alterar.",
    destinos: [{
      tipo: "CREDITO_SEM_DESTINO",
      valor: 25,
      evidencia: "Antecipação do contrato B preservada fora do acerto selecionado.",
      chaveIdempotencia: "ct10-completo-credito-b-destino-001",
    }],
  });
  expect(creditoBOrigem.ok, creditoBOrigem.ok ? undefined : creditoBOrigem.erro).toBe(true);
  const matriculaBAntes = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaBId } });
  const cobrancaBAntes = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaB.id } });
  const creditoBAntes = await prisma.creditoMatricula.findFirstOrThrow({ where: { matriculaId: matriculaBId } });

  const caixa = await registrarRecebimentoDestinado({
    titularMatriculaId: matriculaAId,
    chaveIdempotencia: "ct10-completo-caixa-001",
    valorRecebido: 80,
    moeda: "CRC",
    forma: "DINHEIRO",
    dataPagamento: new Date("2099-09-10T12:00:00Z"),
    comentario: "Recebimento original da mensalidade antes do acerto.",
    destinos: [{
      tipo: "COBRANCA",
      cobrancaId: mensalidade.id,
      valor: 80,
      evidencia: "Caixa conferido para a mensalidade do contrato A.",
      chaveIdempotencia: "ct10-completo-caixa-destino-001",
    }],
  });
  expect(caixa.ok, caixa.ok ? undefined : caixa.erro).toBe(true);
  const creditoOrigem = await registrarRecebimentoDestinado({
    titularMatriculaId: matriculaAId,
    chaveIdempotencia: "ct10-completo-credito-001",
    valorRecebido: 50,
    moeda: "CRC",
    forma: "TRANSFERENCIA",
    dataPagamento: new Date("2099-09-11T12:00:00Z"),
    comentario: "Antecipação comprovada convertida em crédito antes do acerto.",
    destinos: [{
      tipo: "CREDITO_SEM_DESTINO",
      valor: 50,
      evidencia: "Antecipação do titular com crédito ainda sem cobrança definida.",
      chaveIdempotencia: "ct10-completo-credito-destino-001",
    }],
  });
  expect(creditoOrigem.ok, creditoOrigem.ok ? undefined : creditoOrigem.erro).toBe(true);
  const credito = await prisma.creditoMatricula.findFirstOrThrow({
    where: { matriculaId: matriculaAId, origemDestinacaoRecebimentoId: { not: null } },
  });
  const uso = await proporUtilizacaoCredito({
    creditoId: credito.id,
    cobrancaId: mensalidade.id,
    valor: "50.00",
    concordancia: "Titular autorizou o abatimento do crédito na mensalidade encerrada.",
    motivo: "Usar antecipação disponível antes de conferir o encerramento.",
    chaveIdempotencia: "ct10-completo-uso-credito-001",
  });
  expect(uso.ok, uso.ok ? undefined : uso.erro).toBe(true);
  if (!uso.ok || !uso.dado) throw new Error(uso.ok ? "Uso de crédito ausente" : uso.erro);
  entrar(aprovadorId);
  expect(await decidirUtilizacaoCredito({
    propostaId: uso.dado.id,
    aprovar: true,
    motivo: "Crédito e cobrança conferidos independentemente para o acerto.",
  })).toMatchObject({ ok: true, dado: { aprovada: true } });

  await seedRelatoOfertaConfirmado(matriculaAId, "2099-09-10", "2099-09-10");
  await seedRelatoOfertaConfirmado(matriculaAId, "2099-09-20", "2099-09-20");
  const mensalidadeComCredito = await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } });
  entrar(financeiroId);
  const compensacao = await prepararCompensacaoCobertura({
    matriculaId: matriculaAId,
    cobrancaId: mensalidade.id,
    versaoCobranca: mensalidadeComCredito.versao,
    dias: ["2099-09-10", "2099-09-20"],
    motivo: "Compensar os dois dias com indisponibilidade confirmada.",
    evidenciaCondicoes: "Contrato permite recomposição proporcional da cobertura.",
    chaveIdempotencia: "ct10-completo-compensacao-001",
  });
  expect(compensacao.ok, compensacao.ok ? undefined : compensacao.erro).toBe(true);
  if (!compensacao.ok || !compensacao.dado) throw new Error(compensacao.ok ? "Compensação ausente" : compensacao.erro);
  entrar(aprovadorId);
  expect(await decidirCompensacaoCobertura({
    id: compensacao.dado.id,
    aprovar: true,
    motivo: "Dias confirmados e cobertura de origem conferidos independentemente.",
  })).toMatchObject({ ok: true, dado: { status: "APROVADA" } });

  entrar(secretariaId);
  const pedido = await solicitarEncerramentoMatriculas({
    alunoId,
    matriculaIds: [matriculaAId],
    dataSolicitada: "2099-09-15",
    motivo: "Aluno solicitou o encerramento do contrato A.",
    evidenciaPedido: "Solicitação identificada e vinculada ao contrato selecionado.",
    chaveIdempotencia: "ct10-completo-pedido-001",
  });
  expect(pedido.ok, pedido.ok ? undefined : pedido.erro).toBe(true);
  if (!pedido.ok || !pedido.dado) throw new Error(pedido.ok ? "Pedido ausente" : pedido.erro);
  const cobrancaConferida = await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } });
  const contrato = {
    matriculaId: matriculaAId,
    condicoesId: condicoes.id,
    parcelas: [{
      cobrancaId: mensalidade.id,
      versao: cobrancaConferida.versao,
      valorBase: "500.00",
      descontoValido: "100.00",
      evidenciaCondicoes: "Desconto e período conferidos no contrato aplicável.",
    }],
    multa: {
      tipo: "APLICAR" as const,
      vencimento: "2099-10-05",
      evidenciaAplicabilidade: "Cláusula CT10-7 aplicável ao encerramento antecipado.",
    },
  };
  entrar(financeiroId);
  const previa = await preverComponenteMensalEncerramento({
    alunoId,
    solicitacaoId: pedido.dado.solicitacaoId,
    contratos: [contrato],
  });
  expect(previa.ok, previa.ok ? undefined : previa.erro).toBe(true);
  if (!previa.ok || !previa.dado) throw new Error(previa.ok ? "Prévia ausente" : previa.erro);
  expect(previa.dado.contratos[0].calculo).toMatchObject({
    totalServico: "200.00",
    saldoDevidoSemCompensarCreditos: "150.00",
    creditoApuradoSemUtilizacao: "0.00",
    multa: { valor: "80.00" },
  });
  expect(previa.dado.contratos[0].lancamentos.plano).toMatchObject({
    totais: {
      saldoDevidoSemCompensarCreditos: "136.67",
      creditoApuradoSemUtilizacao: "0.00",
      multaContratual: "80.00",
    },
  });
  const rascunho = await salvarRascunhoAcertoEncerramento({
    alunoId,
    solicitacaoId: pedido.dado.solicitacaoId,
    versaoAnterior: 0,
    chaveIdempotencia: "ct10-completo-rascunho-001",
    motivo: "Memória completa de caixa, crédito, compensação e multa conferida.",
    contratos: [contrato],
  });
  expect(rascunho.ok, rascunho.ok ? undefined : rascunho.erro).toBe(true);
  if (!rascunho.ok || !rascunho.dado) throw new Error(rascunho.ok ? "Rascunho ausente" : rascunho.erro);
  entrar(aprovadorId);
  const decisao = await decidirAcertoEncerramento({
    alunoId,
    rascunhoId: rascunho.dado.id,
    aprovar: true,
    motivo: "Acerto financeiro completo conferido por pessoa independente.",
  });
  expect(decisao.ok, decisao.ok ? undefined : decisao.erro).toBe(true);
  if (!decisao.ok || !decisao.dado) throw new Error(decisao.ok ? "Decisão ausente" : decisao.erro);

  const recebimentosAntes = await prisma.recebimento.findMany({ orderBy: { id: "asc" } });
  const destinacoesAntes = await prisma.destinacaoRecebimento.findMany({ orderBy: { id: "asc" } });
  const creditosAntes = await prisma.creditoMatricula.findMany({ orderBy: { id: "asc" } });
  const propostaUsoAntes = await prisma.propostaUsoCredito.findUniqueOrThrow({ where: { id: uso.dado.id } });
  const decisaoUsoAntes = await prisma.decisaoUsoCredito.findFirstOrThrow({ where: { propostaId: uso.dado.id } });

  entrar(financeiroId);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2099-09-15T12:00:00Z"));
  try {
    const primeira = await efetivarAcertoEncerramento({ alunoId, decisaoId: decisao.dado.id });
    const replay = await efetivarAcertoEncerramento({ alunoId, decisaoId: decisao.dado.id });
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    expect(replay).toEqual(primeira);
  } finally {
    vi.useRealTimers();
  }

  const mensalidadeFinal = await prisma.cobranca.findUniqueOrThrow({ where: { id: mensalidade.id } });
  expect(mensalidadeFinal.valorOriginal.toFixed(2)).toBe("500.00");
  expect(mensalidadeFinal.valorNegociado.toFixed(2)).toBe("186.67");
  expect(mensalidadeFinal.valorRecebido?.toFixed(2)).toBe("80.00");
  expect(mensalidadeFinal.valorLiquidadoCredito.toFixed(2)).toBe("50.00");
  expect(mensalidadeFinal.saldo?.toFixed(2)).toBe("56.67");
  expect(await prisma.recebimento.findMany({ orderBy: { id: "asc" } })).toEqual(recebimentosAntes);
  expect(await prisma.destinacaoRecebimento.findMany({ orderBy: { id: "asc" } })).toEqual(destinacoesAntes);
  expect(await prisma.creditoMatricula.findMany({ orderBy: { id: "asc" } })).toEqual(creditosAntes);
  expect(await prisma.propostaUsoCredito.findUniqueOrThrow({ where: { id: uso.dado.id } })).toEqual(propostaUsoAntes);
  expect(await prisma.decisaoUsoCredito.findFirstOrThrow({ where: { propostaId: uso.dado.id } })).toEqual(decisaoUsoAntes);
  const multa = await prisma.cobranca.findFirstOrThrow({ where: { acertoMultaDecisaoId: decisao.dado.id } });
  expect(multa).toMatchObject({ matriculaId: matriculaAId, tipo: "MULTA_ENCERRAMENTO" });
  expect(multa.valorNegociado.toFixed(2)).toBe("80.00");
  const destinos = await prisma.destinacaoDiaAcerto.findMany({
    where: { decisaoId: decisao.dado.id },
    include: { dia: true },
    orderBy: { dia: { diaOrigem: "asc" } },
  });
  expect(destinos.map((d) => ({ dia: d.dia.diaOrigem.toISOString().slice(0, 10), tratamento: d.tratamento }))).toEqual([
    { dia: "2099-09-10", tratamento: "COMPENSACAO" },
    { dia: "2099-09-20", tratamento: "PROPORCIONAL" },
  ]);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaAId } })).toMatchObject({ status: "ENCERRADA" });
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaBId } })).toEqual(matriculaBAntes);
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaB.id } })).toEqual(cobrancaBAntes);
  expect(await prisma.creditoMatricula.findFirstOrThrow({ where: { id: creditoBAntes.id } })).toEqual(creditoBAntes);
});
