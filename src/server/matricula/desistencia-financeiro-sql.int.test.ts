import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormaPagamento, Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const autenticacao = await authMock();
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: autenticacao.user.id } });
    if (!usuario.ativo) throw new atual.ErroAutenticacao();
    return usuario;
  };
  return { ...atual, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); atual.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";
import { decidirCancelamentoFinanceiroDesistenciaPreparacao, proporCancelamentoFinanceiroDesistenciaPreparacao } from "./desistencia-financeira";

let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let financeiro: typeof secretaria;
let aprovador: typeof secretaria;
let semAlcada: typeof secretaria;
let matriculaId: string;
let outraMatriculaId: string;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const motivoPedido = "Solicitação de desistência registrada antes da ativação contratual.";
const evidenciaPedido = "Atendimento identificado e disponível para a conferência da equipe responsável.";
const motivoFinanceiro = "Cancelamento integral conferido sem recebimento, crédito ou outro acerto.";
const evidenciaFinanceira = "Valores e vínculos da cobrança foram conferidos antes da decisão independente.";
const motivoDecisao = "Decisão financeira independente registrada para a preparação conferida.";

async function criarMatricula(alunoId: string) {
  const catalogo = await prisma.produto.findFirstOrThrow();
  const pais = await prisma.pais.findFirstOrThrow();
  return prisma.matricula.create({ data: { alunoId, produtoId: catalogo.id, paisId: pais.id, moeda: "CRC", status: "AGUARDANDO" } });
}

async function criarCobranca(matricula = matriculaId) {
  return prisma.cobranca.create({ data: {
    matriculaId: matricula, tipo: TipoCobranca.MATRICULA, moeda: "CRC", valorOriginal: 100,
    valorNegociado: 100, saldo: 100, vencimento: new Date("2099-12-01T12:00:00.000Z"),
  } });
}

async function pedido(matricula = matriculaId, chave = "principal") {
  entrar(secretaria.id);
  const consulta = await consultarDesistenciaPreparacao({ matriculaId: matricula });
  if (!consulta.ok || !consulta.dado) throw new Error("Conferência ausente.");
  const resultado = await registrarPedidoDesistenciaPreparacao({ matriculaId: matricula, estadoHash: consulta.dado.estadoHash,
    motivo: motivoPedido, evidenciaPedido, chaveIdempotencia: `pedido-sql-${chave}` });
  if (!resultado.ok || !resultado.dado) throw new Error("Pedido ausente.");
  return prisma.pedidoDesistenciaPreparacao.findUniqueOrThrow({ where: { id: resultado.dado.id } });
}

async function proposta(pedidoId: string, estadoHash: string, chave = "principal") {
  entrar(financeiro.id);
  const resultado = await proporCancelamentoFinanceiroDesistenciaPreparacao({ pedidoId, estadoHash, motivo: motivoFinanceiro,
    evidenciaCondicoes: evidenciaFinanceira, chaveIdempotencia: `proposta-sql-${chave}` });
  if (!resultado.ok || !resultado.dado) throw new Error("Proposta ausente.");
  return prisma.propostaFinanceiraDesistencia.findUniqueOrThrow({ where: { id: resultado.dado.id } });
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  [secretaria, financeiro, aprovador, semAlcada] = await Promise.all([
    criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro proponente"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro aprovador"),
    criarUsuario([Papel.FINANCEIRO], "Financeiro sem alçada"),
  ]);
  await prisma.usuario.update({ where: { id: aprovador.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Pessoa SQL", paisId: catalogo.pais.id } });
  matriculaId = (await criarMatricula(aluno.id)).id;
  outraMatriculaId = (await criarMatricula(aluno.id)).id;
});

describe("guards SQL do cancelamento financeiro da desistência", () => {
  it("nega decisão forjada autoaprovada e decisão de financeiro sem alçada", async () => {
    await criarCobranca();
    const p = await proposta((await pedido()).id, (await prisma.pedidoDesistenciaPreparacao.findFirstOrThrow()).estadoHash);

    await prisma.usuario.update({ where: { id: financeiro.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
    await expect(prisma.decisaoFinanceiraDesistencia.create({ data: {
      propostaId: p.id, decisorId: financeiro.id, aprovada: true, motivo: motivoDecisao,
    } })).rejects.toThrow(/outra pessoa/i);
    await expect(prisma.decisaoFinanceiraDesistencia.create({ data: {
      propostaId: p.id, decisorId: semAlcada.id, aprovada: true, motivo: motivoDecisao,
    } })).rejects.toThrow(/alçada|autoriza|financeir/i);
  });

  it("preserva proposta e decisão contra alteração ou exclusão direta", async () => {
    await criarCobranca();
    const pedidoAtual = await pedido();
    const p = await proposta(pedidoAtual.id, pedidoAtual.estadoHash);
    entrar(aprovador.id);
    const decidida = await decidirCancelamentoFinanceiroDesistenciaPreparacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: false, motivo: motivoDecisao });
    expect(decidida.ok).toBe(true);
    const decisao = await prisma.decisaoFinanceiraDesistencia.findUniqueOrThrow({ where: { propostaId: p.id } });

    await expect(prisma.propostaFinanceiraDesistencia.update({ where: { id: p.id }, data: { motivo: "Mudança direta da proposta financeira preservada." } })).rejects.toThrow(/preserv|imutável/i);
    await expect(prisma.propostaFinanceiraDesistencia.delete({ where: { id: p.id } })).rejects.toThrow(/preserv|imutável/i);
    await expect(prisma.decisaoFinanceiraDesistencia.update({ where: { id: decisao.id }, data: { motivo: "Mudança direta da decisão financeira preservada." } })).rejects.toThrow(/preserv|imutável/i);
    await expect(prisma.decisaoFinanceiraDesistencia.delete({ where: { id: decisao.id } })).rejects.toThrow(/preserv|imutável/i);
  });

  it("nega aplicação SQL com decisão aprovada vinculada a pedido de outra matrícula", async () => {
    await criarCobranca(matriculaId);
    const primeiro = await pedido(matriculaId, "primeiro");
    const p = await proposta(primeiro.id, primeiro.estadoHash, "primeiro");
    entrar(aprovador.id);
    const decisao = await decidirCancelamentoFinanceiroDesistenciaPreparacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: motivoDecisao });
    if (!decisao.ok || !decisao.dado) throw new Error("Decisão ausente.");
    const outro = await pedido(outraMatriculaId, "outra");

    await expect(prisma.efetivacaoPedidoDesistenciaPreparacao.create({ data: {
      pedidoId: outro.id, matriculaId: outraMatriculaId, executorId: secretaria.id, decisaoFinanceiraId: decisao.dado.id,
      motivo: "Tentativa de aplicar a decisão em matrícula diferente.", entradaHash: "a".repeat(64), estadoHash: outro.estadoHash,
    } })).rejects.toThrow(/decisão|pedido|matrícula/i);
  });

  it("permite rejeição de proposta obsoleta, mas não aprovação após informe de pagamento sem mudança de versão da cobrança", async () => {
    const cobranca = await criarCobranca();
    const pedidoAtual = await pedido();
    const p = await proposta(pedidoAtual.id, pedidoAtual.estadoHash, "fonte-pagamento");
    const versaoAntes = cobranca.versao;
    await prisma.pagamentoInformado.create({ data: {
      cobrancaId: cobranca.id, autorId: secretaria.id, chaveIdempotencia: "informe-sql-sem-versao", valor: 10, moeda: "CRC",
      forma: FormaPagamento.DINHEIRO, dataPagamento: new Date("2099-11-01T12:00:00.000Z"),
    } });
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } })).versao).toBe(versaoAntes);

    entrar(aprovador.id);
    expect((await decidirCancelamentoFinanceiroDesistenciaPreparacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: motivoDecisao })).ok).toBe(false);
    const rejeicao = await decidirCancelamentoFinanceiroDesistenciaPreparacao({ propostaId: p.id, propostaHash: p.entradaHash, aprovada: false, motivo: motivoDecisao });
    expect(rejeicao.ok).toBe(true);
    expect(await prisma.decisaoFinanceiraDesistencia.findUniqueOrThrow({ where: { propostaId: p.id } })).toMatchObject({ aprovada: false });
  });
});
