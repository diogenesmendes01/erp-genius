import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    // Sessão simulada; permissões continuam sendo lidas do banco real em cada chamada.
    const session = await authMock();
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, nome: true, papeis: true, ativo: true } });
    if (!u.ativo) throw new real.ErroPermissao();
    real.exigirPapel(u, ...papeis);
    return u;
  } };
});
import { prisma } from "@/lib/prisma";
import { receberTx } from "@/server/financeiro/recebimentos";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } from "./pausa-proposta";
import { aplicarPausaMatriculasTx } from "./pausa-execucao";
import { aplicarMovimentacaoContratual } from "./aplicar-movimentacao";
import { pausarAluno, encerrarAluno } from "@/server/alunos/acoes";
import { preverRetomadaMatriculas } from "./retomada-previa";
import { solicitarRetomadaMatriculas, decidirRetomadaMatriculas } from "./retomada-proposta";
import { aplicarRetomadaMatriculasTx } from "./retomada-execucao";
import { listarPropostasMovimentacao, obterDetalhesMovimentacao } from "./movimentacoes-consultas";
let alunoId: string, matriculaId: string, outraId: string, secId: string, finId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const input = () => ({ matriculaIds: [matriculaId], dataEfetiva: "2026-09-15", motivo: "Pausa solicitada pelo aluno", chaveIdempotencia: "pausa-selecao-001" });
const decisao = { aprovar: true, motivo: "Condições e períodos conferidos" };
beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { fusoInstitucional: "America/Sao_Paulo" } });
  secId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR])).id;
  finId = (await criarUsuario([Papel.FINANCEIRO])).id;
  entrar(secId);
  const c = await seedCatalogoMinimo();
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Pausa", paisId: c.pais.id } })).id;
  const base = { alunoId, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", status: "ATIVA" as const, referenciaCobertura: "MES_CIVIL" as const };
  matriculaId = (await prisma.matricula.create({ data: base })).id;
  outraId = (await prisma.matricula.create({ data: base })).id;
});
async function solicitar() {
  const r = await solicitarPausaMatriculas(alunoId, input());
  if (!r.ok) throw new Error(r.erro);
  return r.dado!.propostaId;
}
describe("proposta de pausa com contratos imutáveis e decisão independente", () => {
  it("preserva no banco a proposta, os itens e o histórico de retomada", async () => {
    const pausa = await solicitar();
    entrar(finId);
    expect((await decidirPropostaPausaMatriculas(pausa, decisao)).ok).toBe(true);
    await prisma.$transaction(tx => aplicarPausaMatriculasTx(tx, pausa, finId, new Date("2026-09-16T12:00:00Z")));
    entrar(secId);
    const solicitada = await solicitarRetomadaMatriculas(alunoId, { retorno: "2026-12-10", motivo: "Retomada a conferir com histórico", chaveIdempotencia: "retomada-integridade-526",
      matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } }] });
    if (!solicitada.ok || !solicitada.dado) throw new Error(JSON.stringify(solicitada));
    const id = solicitada.dado.propostaId;
    const proposta = await prisma.propostaRetomadaMatriculas.findUniqueOrThrow({ where: { id } });
    const item = await prisma.itemPropostaRetomadaMatriculas.findFirstOrThrow({ where: { propostaId: id } });
    for (const data of [{ snapshot: {} }, { entrada: {} }, { motivo: "Motivo substituído indevidamente" }, { estadoHash: "alterado" }]) {
      await expect(prisma.propostaRetomadaMatriculas.update({ where: { id }, data })).rejects.toThrow();
    }
    await expect(prisma.propostaRetomadaMatriculas.delete({ where: { id } })).rejects.toThrow();
    await expect(prisma.itemPropostaRetomadaMatriculas.delete({ where: { id: item.id } })).rejects.toThrow();
    await expect(prisma.itemPropostaRetomadaMatriculas.update({ where: { id: item.id }, data: { matriculaId: outraId } })).rejects.toThrow();
    await expect(prisma.itemPropostaRetomadaMatriculas.create({ data: { propostaId: id, alunoId, matriculaId: outraId } })).rejects.toThrow();
    await expect(prisma.propostaRetomadaMatriculas.update({ where: { id }, data: { status: "APLICADA", aplicadaEm: new Date() } })).rejects.toThrow();
    const professor = await criarUsuario([Papel.PROFESSOR]);
    await expect(prisma.propostaRetomadaMatriculas.update({ where: { id }, data: {
      status: "APROVADA", decisorId: professor.id, motivoDecisao: "Aprovação sem papel financeiro", decididoEm: new Date(),
    } })).rejects.toThrow();
    expect(await prisma.propostaRetomadaMatriculas.findUniqueOrThrow({ where: { id } })).toEqual(proposta);
    await expect(prisma.$transaction(async tx => {
      await tx.propostaRetomadaMatriculas.update({ where: { id }, data: {
        status: "APROVADA", decisorId: finId, motivoDecisao: "Decisão sem histórico", decididoEm: new Date(),
      } });
      await tx.$executeRaw`SET CONSTRAINTS exigir_evento_transicao_retomada_matriculas IMMEDIATE`;
    })).rejects.toThrow();
    expect(await prisma.propostaRetomadaMatriculas.findUniqueOrThrow({ where: { id } })).toEqual(proposta);
    await expect(prisma.$transaction(async tx => {
      await tx.propostaRetomadaMatriculas.update({ where: { id }, data: {
        status: "APROVADA", decisorId: finId, motivoDecisao: "Decisão com autor divergente", decididoEm: new Date(),
      } });
      await tx.evento.create({ data: { tipo: "RetomadaMatriculasDecidida", agregadoTipo: "Aluno", agregadoId: alunoId,
        autorId: secId, payload: { propostaId: id, statusAnterior: "PENDENTE", status: "APROVADA", motivo: "Decisão com autor divergente" } } });
      await tx.$executeRaw`SET CONSTRAINTS exigir_evento_transicao_retomada_matriculas IMMEDIATE`;
    })).rejects.toThrow();
    expect(await prisma.evento.count({ where: { tipo: "RetomadaMatriculasDecidida", agregadoId: alunoId } })).toBe(0);
    entrar(finId);
    expect((await decidirRetomadaMatriculas(id, decisao)).ok).toBe(true);
    await expect(prisma.propostaRetomadaMatriculas.update({ where: { id }, data: {
      status: "REJEITADA", decisorId: finId, motivoDecisao: "Rejeição sem novo evento", decididoEm: new Date(),
    } })).rejects.toThrow();
    await expect(prisma.propostaRetomadaMatriculas.update({ where: { id }, data: {
      status: "APLICADA", aplicadaEm: new Date(),
    } })).rejects.toThrow();
    expect((await prisma.propostaRetomadaMatriculas.findUniqueOrThrow({ where: { id } })).status).toBe("APROVADA");
    expect((await decidirRetomadaMatriculas(id, { aprovar: false, motivo: "Nova conferência necessária antes da aplicação" })).ok).toBe(true);
    const eventos = await prisma.evento.findMany({ where: { tipo: "RetomadaMatriculasDecidida", agregadoId: alunoId }, orderBy: { criadoEm: "asc" } });
    expect(eventos).toHaveLength(2);
    expect(eventos.map(e => e.payload)).toEqual(expect.arrayContaining([expect.objectContaining({ status: "APROVADA" }), expect.objectContaining({ status: "REJEITADA" })]));
    await expect(prisma.evento.update({ where: { id: eventos[0].id }, data: { payload: {} } })).rejects.toThrow();
    await expect(prisma.evento.delete({ where: { id: eventos[0].id } })).rejects.toThrow();
    await expect(prisma.propostaRetomadaMatriculas.update({ where: { id }, data: { status: "PENDENTE", decisorId: null, motivoDecisao: null, decididoEm: null } })).rejects.toThrow();
  });
  it.each([40, 100])("ação pública preserva recebimento de %s na pausa e retomada sem duplicar", async (recebido) => {
    const quitada = recebido === 100;
    const paga = await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", status: "PENDENTE", valorOriginal: 100, valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "CRC",
      vencimento: new Date("2000-02-05"), pagoEm: new Date("1999-12-28"), coberturaInicio: new Date("2000-02-01"), coberturaFim: new Date("2000-02-29") } });
    const recebimento = await prisma.$transaction(tx => receberTx(tx, { cobrancaId: paga.id, chaveIdempotencia: "antecipacao-teste-001", autorId: finId, valorRecebido: recebido, forma: "DINHEIRO", dataPagamento: paga.pagoEm!, evidencia: "Antecipação conferida para pausa e retomada." }));
    const r = await solicitarPausaMatriculas(alunoId, { ...input(), dataEfetiva: "2000-01-01" });
    if (!r.ok) throw new Error(r.erro);
    const pedido = { alunoId, propostaId: r.dado!.propostaId, tipo: "PAUSA" as const };
    expect((await aplicarMovimentacaoContratual(pedido)).ok).toBe(false);
    entrar(finId);
    expect((await decidirPropostaPausaMatriculas(pedido.propostaId, decisao)).ok).toBe(true);
    expect((await aplicarMovimentacaoContratual({ ...pedido, alunoId: "outro-aluno" })).ok).toBe(false);
    expect(await aplicarMovimentacaoContratual(pedido)).toMatchObject({ ok: true, dado: { status: "APLICADA" } });
    expect((await aplicarMovimentacaoContratual(pedido)).ok).toBe(true);
    expect(await prisma.movimentacaoAluno.count({ where: { matriculaId, tipo: "PAUSA" } })).toBe(1);
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: paga.id } })).toMatchObject({ status: quitada ? "PAGO" : "CANCELADA", suspensaPorItemPausaId: expect.any(String), pagoEm: quitada ? paga.pagoEm : null, saldo: quitada ? 0 : 60 });
    entrar(secId);
    const retorno = await solicitarRetomadaMatriculas(alunoId, { retorno: "2000-01-02", motivo: "Retorno solicitado e conferido", chaveIdempotencia: "retorno-publico-001",
      matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } }] });
    if (!retorno.ok) throw new Error(retorno.erro);
    entrar(finId);
    expect((await decidirRetomadaMatriculas(retorno.dado!.propostaId, decisao)).ok).toBe(true);
    const { carregarReferenciaRetomadaAplicadaTx } = await import("./continuidade-retomada-tx");
    const referenciaRetomada = (idMatricula = matriculaId, inicio = "2000-01-02") => prisma.$transaction(tx =>
      carregarReferenciaRetomadaAplicadaTx(tx, { matriculaId: idMatricula, cobrancaId: paga.id,
        inicio: new Date(inicio), fim: new Date("2000-01-31") }));
    expect(await referenciaRetomada()).toBeNull();
    expect(await aplicarMovimentacaoContratual({ alunoId, propostaId: retorno.dado!.propostaId, tipo: "RETOMADA" })).toMatchObject({ ok: true, dado: { status: "APLICADA" } });
    expect(await referenciaRetomada()).toMatchObject({ propostaId: retorno.dado!.propostaId });
    expect(await referenciaRetomada(outraId)).toBeNull();
    expect(await referenciaRetomada(matriculaId, "2000-01-03")).toBeNull();
    const { planejarContinuidadeMensalAposRetomada } = await import("./continuidade-mensal");
    expect(planejarContinuidadeMensalAposRetomada({
      continuidadeContratada: { contratada: true, clausula: "Continuidade mensal contratada", evidenciaId: "contrato-teste" },
      regraCobertura: { referencia: "MES_CIVIL" }, referenciaVencimento: "MES_COBERTURA",
      diaVencimento: 5, antecedenciaDias: 10, valorOriginal: "100", valorNegociado: "100", moeda: "CRC",
      vigenteDesde: "2000-01-01", ajusteVencimento: "MANTER_DATA", dataPlanejamento: "2000-02-01",
      ultimaCobertura: { inicio: "2000-01-02", fim: "2000-01-31" },
    })).toMatchObject({ cobertura: { inicio: "2000-02-01", fim: "2000-02-29" }, vencimento: "2000-02-05" });
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: outraId } })).status).toBe("ATIVA");
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: alunoId } })).status).toBe("ATIVO");
    expect(await prisma.recebimento.findUniqueOrThrow({ where: { id: recebimento.id } })).toEqual(recebimento);
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: paga.id } })).toMatchObject({ status: quitada ? "PAGO" : "ATRASADO", saldo: paga.saldo, valorRecebido: paga.valorRecebido, pagoEm: paga.pagoEm,
      coberturaInicio: new Date("2000-01-02"), coberturaFim: new Date("2000-01-31"), suspensaPorItemPausaId: null });
    expect(await prisma.recebimento.count()).toBe(1);
  });

  it("repete solicitação concorrente uma vez e aprova sem executar a pausa", async () => {
    const resultados = await Promise.all([solicitar(), solicitar()]);
    expect(resultados[0]).toBe(resultados[1]);
    expect(await prisma.propostaPausaMatriculas.count()).toBe(1);
    expect(await prisma.itemPropostaPausa.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "PausaMatriculasSolicitada" } })).toBe(1);
    entrar(finId);
    for (let i = 0; i < 2; i++) expect((await decidirPropostaPausaMatriculas(resultados[0], decisao)).ok).toBe(true);
    expect(await prisma.evento.count({ where: { tipo: "PropostaPausaMatriculasDecidida" } })).toBe(1);
    expect((await prisma.matricula.findMany()).every((m) => m.status === "ATIVA")).toBe(true);
    expect((await prisma.propostaPausaMatriculas.findUniqueOrThrow({ where: { id: resultados[0] } })).status).toBe("APROVADA");
  });
  it("acúmulo de papéis não permite decidir a própria proposta", async () => {
    const id = await solicitar();
    expect((await decidirPropostaPausaMatriculas(id, decisao)).ok).toBe(false);
    expect((await decidirPropostaPausaMatriculas(id, { ...decisao, aprovar: false })).ok).toBe(false);
  });
  it("consulta operacional distingue autor/aprovador e não retorna conteúdo financeiro", async () => {
    const id = await solicitar();
    const propria = await listarPropostasMovimentacao({ alunoId, tipo: "PAUSA" });
    expect(propria).toMatchObject({ ok: true, dado: { propostas: [{ id, podeDecidir: false, matriculas: [{ id: matriculaId }] }] } });
    expect(JSON.stringify(propria)).not.toMatch(/estadoHash|entradaHash|snapshot|valorRecebido|chaveIdempotencia/);
    expect(await obterDetalhesMovimentacao({ alunoId, tipo: "PAUSA", propostaId: id })).toMatchObject({ ok: true, dado: {
      id, historicoIncompleto: false, detalhes: { tipo: "PAUSA", impactos: { dataEfetiva: "2026-09-15", matriculas: [{ matriculaId }] } },
    } });
    expect(await obterDetalhesMovimentacao({ alunoId: "outro", tipo: "PAUSA", propostaId: id })).toMatchObject({ ok: true, dado: null });
    entrar(finId);
    expect(await listarPropostasMovimentacao({ alunoId, tipo: "PAUSA" })).toMatchObject({ ok: true, dado: { propostas: [{ id, podeDecidir: true }] } });
    expect(await listarPropostasMovimentacao({ alunoId: "outro", tipo: "PAUSA", cursor: id })).toMatchObject({ ok: true, dado: { propostas: [] } });
    entrar((await criarUsuario([Papel.VENDEDOR])).id);
    expect((await listarPropostasMovimentacao({ alunoId, tipo: "PAUSA" })).ok).toBe(false);
    expect((await obterDetalhesMovimentacao({ alunoId, tipo: "PAUSA", propostaId: id })).ok).toBe(false);
  });
  it("duas solicitações distintas concorrentes não reservam o mesmo contrato", async () => {
    const respostas = await Promise.all([
      solicitarPausaMatriculas(alunoId, input()),
      solicitarPausaMatriculas(alunoId, { ...input(), chaveIdempotencia: "solicitacao-concorrente-002" }),
    ]);
    expect(respostas.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.propostaPausaMatriculas.count()).toBe(1);
    expect(await prisma.itemPropostaPausa.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "PausaMatriculasSolicitada" } })).toBe(1);
  });
  it("alterar contrato excluído não invalida a seleção nem altera seus dados na decisão", async () => {
    const id = await solicitar();
    const excluido = await prisma.matricula.update({ where: { id: outraId }, data: { diaVencimento: 20 } });
    entrar(finId);
    expect((await decidirPropostaPausaMatriculas(id, decisao)).ok).toBe(true);
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outraId } })).toEqual(excluido);
  });
  it("recebimento registrado após a proposta exige nova conferência e permanece preservado", async () => {
    const cobranca = await prisma.cobranca.create({ data: {
      matriculaId, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100,
      saldo: 100, valorRecebido: 0, moeda: "CRC", vencimento: new Date("2026-10-05"),
      coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31"),
    } });
    const id = await solicitar();
    const recebida = await prisma.cobranca.update({ where: { id: cobranca.id }, data: {
      valorRecebido: 100, saldo: 0, status: "PAGO", versao: { increment: 1 },
    } });
    entrar(finId);
    const resposta = await decidirPropostaPausaMatriculas(id, decisao);
    expect(resposta.ok).toBe(false);
    if (!resposta.ok) expect(resposta.erro).toContain("impactos mudaram");
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } })).toEqual(recebida);
    expect((await prisma.propostaPausaMatriculas.findUniqueOrThrow({ where: { id } })).status).toBe("PENDENTE");
    expect(await prisma.evento.count({ where: { tipo: "PropostaPausaMatriculasDecidida" } })).toBe(0);
  });
  it("banco também impede decisão pelo próprio solicitante", async () => {
    const id = await solicitar();
    await expect(prisma.propostaPausaMatriculas.update({ where: { id }, data: {
      status: "APROVADA", decisorId: secId, motivoDecisao: "Aprovação direta inválida", decididoEm: new Date(),
    } })).rejects.toThrow();
    expect((await prisma.propostaPausaMatriculas.findUniqueOrThrow({ where: { id } })).status).toBe("PENDENTE");
  });
  it("mudança do fuso invalida a conferência e ausência de fuso impede aprovação", async () => {
    const id = await solicitar();
    await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "America/Costa_Rica" } });
    entrar(finId);
    expect((await decidirPropostaPausaMatriculas(id, decisao)).ok).toBe(false);
    expect((await decidirPropostaPausaMatriculas(id, { ...decisao, aprovar: false })).ok).toBe(true);
    await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: null } });
    entrar(secId);
    const nova = await solicitarPausaMatriculas(alunoId, { ...input(), chaveIdempotencia: "pausa-sem-fuso-002" });
    if (!nova.ok) throw new Error(nova.erro);
    entrar(finId);
    expect((await decidirPropostaPausaMatriculas(nova.dado!.propostaId, decisao)).ok).toBe(false);
  });
  it("não reutiliza chave com outra seleção ou condição e impede propostas sobrepostas", async () => {
    await solicitar();
    const antes = await prisma.matricula.findMany({ where: { alunoId }, orderBy: { id: "asc" } });
    const pausaGlobal = await pausarAluno(alunoId, { motivo: "Pausa pelo caminho antigo" });
    expect(pausaGlobal).toMatchObject({ ok: false, erro: expect.stringContaining("fluxo contratual") });
    expect(await encerrarAluno(alunoId, { motivo: "Desistiu" })).toMatchObject({ ok: false, erro: expect.stringContaining("fluxo contratual") });
    expect(await prisma.matricula.findMany({ where: { alunoId }, orderBy: { id: "asc" } })).toEqual(antes);
    expect(await prisma.movimentacaoAluno.count({ where: { alunoId } })).toBe(0);
    expect((await solicitarPausaMatriculas(alunoId, { ...input(), matriculaIds: [outraId] })).ok).toBe(false);
    expect((await solicitarPausaMatriculas(alunoId, { ...input(), motivo: "Outro motivo informado" })).ok).toBe(false);
    expect((await solicitarPausaMatriculas(alunoId, { ...input(), chaveIdempotencia: "outra-chave-001" })).ok).toBe(false);
    expect(await prisma.itemPropostaPausa.count()).toBe(1);
  });
  it("mudança de um contrato invalida aprovação do conjunto sem aplicar parcialmente", async () => {
    const r = await solicitarPausaMatriculas(alunoId, { ...input(), matriculaIds: [outraId, matriculaId] });
    if (!r.ok) throw new Error(r.erro);
    await prisma.matricula.update({ where: { id: outraId }, data: { diaVencimento: 20 } });
    entrar(finId);
    expect((await decidirPropostaPausaMatriculas(r.dado!.propostaId, decisao)).ok).toBe(false);
    expect((await prisma.propostaPausaMatriculas.findUniqueOrThrow({ where: { id: r.dado!.propostaId } })).status).toBe("PENDENTE");
    expect((await prisma.matricula.findMany()).every((m) => m.status === "ATIVA")).toBe(true);
  });
  it("pendências impedem aprovação, mas podem ser rejeitadas sem alterar contrato", async () => {
    await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: null } });
    const id = await solicitar();
    entrar(finId);
    expect((await decidirPropostaPausaMatriculas(id, decisao)).ok).toBe(false);
    expect((await decidirPropostaPausaMatriculas(id, { ...decisao, aprovar: false })).ok).toBe(true);
  });
  it("revogação do solicitante impede aprovar e não impede outro autorizado de rejeitar", async () => {
    const id = await solicitar();
    await prisma.usuario.update({ where: { id: secId }, data: { ativo: false } });
    entrar(finId);
    expect((await decidirPropostaPausaMatriculas(id, decisao)).ok).toBe(false);
    expect((await decidirPropostaPausaMatriculas(id, { ...decisao, aprovar: false })).ok).toBe(true);
  });
  it("FK composta impede inserir matrícula de outro aluno na seleção", async () => {
    const id = await solicitar();
    const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
    const pessoa = await prisma.aluno.create({ data: { primeiroNome: "Outra pessoa", paisId: m.paisId } });
    const contrato = await prisma.matricula.create({ data: { alunoId: pessoa.id, paisId: m.paisId, produtoId: m.produtoId, moeda: m.moeda } });
    await expect(prisma.itemPropostaPausa.create({ data: { propostaId: id, matriculaId: contrato.id, alunoId } })).rejects.toThrow();
  });
});

describe("núcleo transacional de execução de pausa", () => {
  async function aprovar() {
    const id = await solicitar();
    entrar(finId);
    const r = await decidirPropostaPausaMatriculas(id, decisao);
    if (!r.ok) throw new Error(r.erro);
    return id;
  }
  const executar = (id: string, data = "2026-09-16") => prisma.$transaction((tx) => aplicarPausaMatriculasTx(tx, id, secId, new Date(`${data}T12:00:00Z`)));
  it("usa a data da escola na fronteira da meia-noite", async () => {
    await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "America/Costa_Rica" } });
    const id = await aprovar();
    await expect(prisma.$transaction((tx) => aplicarPausaMatriculasTx(tx, id, secId, new Date("2026-09-15T03:00:00Z")))).rejects.toThrow("ainda não chegou");
    await prisma.$transaction((tx) => aplicarPausaMatriculasTx(tx, id, secId, new Date("2026-09-15T06:00:00Z")));
    expect((await prisma.propostaPausaMatriculas.findUniqueOrThrow({ where: { id } })).aplicadaEm).toEqual(new Date("2026-09-15T06:00:00Z"));
  });

  it("suspende somente cobertura futura, preservando período iniciado e outro contrato", async () => {
    await prisma.matricula.updateMany({ where: { id: { in: [matriculaId, outraId] } }, data: { ativadaEm: new Date("2026-09-01T00:00:00Z") } });
    const contrato = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId }, include: { produto: true } });
    const nivel = await prisma.nivel.create({ data: { idiomaId: contrato.produto.idiomaId, codigo: "A1-pausa", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { modalidadeId: contrato.produto.modalidadeId, nivelId: nivel.id } });
    const outraTurma = await prisma.turma.create({ data: { modalidadeId: contrato.produto.modalidadeId, nivelId: nivel.id } });
    const vinculo = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turma.id, criadoEm: new Date("2026-09-01T12:00:00Z") } });
    const outroVinculo = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: outraId, turmaId: outraTurma.id, criadoEm: new Date("2026-09-01T12:00:00Z") } });
    const base = { tipo: "MENSALIDADE" as const, valorOriginal: 100, valorNegociado: 100, saldo: 100, valorRecebido: 0, moeda: "CRC" };
    const atual = await prisma.cobranca.create({ data: { ...base, matriculaId,
      coberturaInicio: new Date("2026-09-01"), coberturaFim: new Date("2026-09-30"), vencimento: new Date("2026-10-10"),
    } });
    const futura = await prisma.cobranca.create({ data: { ...base, matriculaId,
      coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31"), vencimento: new Date("2026-09-01"), status: "ATRASADO",
    } });
    const outra = await prisma.matricula.findUniqueOrThrow({ where: { id: outraId } });
    const id = await aprovar();
    await executar(id);
    await executar(id);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("PAUSADA");
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outraId } })).toEqual(outra);
    expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: vinculo.id } })).toEqual(vinculo);
    expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: outroVinculo.id } })).toEqual(outroVinculo);
    const { carregarChamadaTx } = await import("@/server/diario/chamada-tx");
    await prisma.$transaction(async tx => {
      const durantePausa = new Date("2026-09-16T12:00:00Z");
      expect((await carregarChamadaTx(tx, turma.id, durantePausa)).alunos).toEqual([]);
      expect((await carregarChamadaTx(tx, outraTurma.id, durantePausa)).alunos.map(a => a.alunoId)).toEqual([alunoId]);
    });
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: atual.id } })).toEqual(atual);
    const suspensa = await prisma.cobranca.findUniqueOrThrow({ where: { id: futura.id } });
    expect(suspensa).toMatchObject({ ...futura, status: "CANCELADA", versao: futura.versao + 1, suspensaPorItemPausaId: expect.any(String) });
    expect(await prisma.evento.count({ where: { tipo: "MatriculaPausada" } })).toBe(1);
    expect(await prisma.movimentacaoAluno.findMany({ where: { alunoId } })).toMatchObject([{ matriculaId, tipo: "PAUSA", usuarioId: secId }]);
    expect(await prisma.recebimento.count()).toBe(0);
    expect((await prisma.propostaPausaMatriculas.findUniqueOrThrow({ where: { id } })).aplicadaEm).not.toBeNull();
  });
  it("revalida alteração posterior à aprovação antes de modificar qualquer matrícula", async () => {
    const id = await aprovar();
    await prisma.matricula.update({ where: { id: matriculaId }, data: { diaVencimento: 10 } });
    await expect(executar(id)).rejects.toThrow("impactos mudaram");
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("ATIVA");
    expect((await prisma.propostaPausaMatriculas.findUniqueOrThrow({ where: { id } })).status).toBe("APROVADA");
    expect(await prisma.evento.count({ where: { tipo: "MatriculaPausada" } })).toBe(0);
    expect((await decidirPropostaPausaMatriculas(id, { aprovar: false, motivo: "Retirar aprovação para conferir os novos impactos" })).ok).toBe(true);
    entrar(secId);
    const nova = await solicitarPausaMatriculas(alunoId, { ...input(), chaveIdempotencia: "nova-conferencia-002" });
    expect(nova.ok).toBe(true);
  });
  it("não aplica proposta pendente, data futura nem autorização revogada", async () => {
    const id = await solicitar();
    await expect(executar(id)).rejects.toThrow("aprovada");
    entrar(finId);
    expect((await decidirPropostaPausaMatriculas(id, decisao)).ok).toBe(true);
    await expect(executar(id, "2026-09-14")).rejects.toThrow("ainda não chegou");
    await prisma.usuario.update({ where: { id: finId }, data: { ativo: false } });
    await expect(executar(id)).rejects.toThrow("autorização vigente");
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("ATIVA");
  });
  it("erro na transação desfaz estado, aplicação e auditoria juntos", async () => {
    const id = await aprovar();
    await expect(prisma.$transaction(async (tx) => {
      await aplicarPausaMatriculasTx(tx, id, secId, new Date("2026-09-16T12:00:00Z"));
      throw new Error("Falha posterior simulada");
    })).rejects.toThrow("Falha posterior");
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("ATIVA");
    expect((await prisma.propostaPausaMatriculas.findUniqueOrThrow({ where: { id } })).aplicadaEm).toBeNull();
    expect(await prisma.evento.count({ where: { tipo: "MatriculaPausada" } })).toBe(0);
  });
  it("banco impede vincular suspensão à proposta de outro contrato", async () => {
    const id = await aprovar();
    const item = await prisma.itemPropostaPausa.findFirstOrThrow({ where: { propostaId: id } });
    await expect(prisma.cobranca.create({ data: { matriculaId: outraId, suspensaPorItemPausaId: item.id,
      tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100, moeda: "CRC", vencimento: new Date("2026-10-01"),
    } })).rejects.toThrow();
  });
  it("prévia da retomada usa somente a suspensão selecionada e não modifica a cobrança", async () => {
    const c = await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100,
      saldo: 100, moeda: "CRC", vencimento: new Date("2026-10-05"), coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31"),
    } });
    const id = await aprovar();
    await executar(id);
    const antes = await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } });
    const r = await preverRetomadaMatriculas(alunoId, { retorno: "2026-12-10", matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } }] });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.erro);
    expect(r.dado!.matriculas).toHaveLength(1);
    expect(r.dado!.matriculas[0]).toMatchObject({ matriculaId, pausaId: id, pendencias: [], periodos: [{ cobrancaId: c.id,
      coberturaAnterior: { inicio: "2026-10-01", fim: "2026-10-31" }, cobertura: { inicio: "2026-12-10", fim: "2026-12-31" },
      vencimentoAnterior: "2026-10-05", vencimento: "2026-10-05",
    }] });
    expect(JSON.stringify(r)).not.toMatch(/valorOriginal|valorRecebido|saldo|moeda/);
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).toEqual(antes);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("PAUSADA");
  });
  it("retomada aponta pausa sem origem e rejeita titularidade ou papel inválido", async () => {
    const inputRetorno = { retorno: "2026-12-10", matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" as const } }] };
    const r = await preverRetomadaMatriculas(alunoId, inputRetorno);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.erro);
    expect(r.dado!.matriculas[0].pendencias).toEqual(expect.arrayContaining(["MATRICULA_NAO_PAUSADA", "PAUSA_CONTRATUAL_A_CONFERIR"]));
    expect((await preverRetomadaMatriculas("outra-pessoa", inputRetorno)).ok).toBe(false);
    const vendedor = await criarUsuario([Papel.VENDEDOR]);
    entrar(vendedor.id);
    expect((await preverRetomadaMatriculas(alunoId, inputRetorno)).ok).toBe(false);
  });
  it("persiste e aprova retomada independente, sem aplicação ou duplicação", async () => {
    const pausa = await aprovar();
    await executar(pausa);
    entrar(secId);
    const inputRetorno = { retorno: "2026-12-10", motivo: "Retorno solicitado pelo aluno", chaveIdempotencia: "retomada-contratos-001",
      matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" as const } }],
    };
    const r = await solicitarRetomadaMatriculas(alunoId, inputRetorno);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.erro);
    const id = r.dado!.propostaId;
    expect((await solicitarRetomadaMatriculas(alunoId, inputRetorno))).toEqual(r);
    expect((await decidirRetomadaMatriculas(id, decisao)).ok).toBe(false);
    entrar(finId);
    const d = await decidirRetomadaMatriculas(id, decisao);
    expect(d).toMatchObject({ ok: true, dado: { status: "APROVADA" } });
    expect((await decidirRetomadaMatriculas(id, decisao)).ok).toBe(true);
    expect(await prisma.propostaRetomadaMatriculas.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "RetomadaMatriculasDecidida" } })).toBe(1);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("PAUSADA");
  });
  it("mudança posterior e pendências impedem aprovação da retomada", async () => {
    const pausa = await aprovar();
    await executar(pausa);
    entrar(secId);
    const r = await solicitarRetomadaMatriculas(alunoId, { retorno: "2026-12-10", motivo: "Conferir retorno do aluno", chaveIdempotencia: "retomada-conferencia-001",
      matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } }],
    });
    if (!r.ok) throw new Error(r.erro);
    await prisma.matricula.update({ where: { id: matriculaId }, data: { diaVencimento: 15 } });
    entrar(finId);
    expect((await decidirRetomadaMatriculas(r.dado!.propostaId, decisao)).ok).toBe(false);
    expect((await decidirRetomadaMatriculas(r.dado!.propostaId, { ...decisao, aprovar: false })).ok).toBe(true);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("PAUSADA");
  });
  it("aplica retomada uma vez, preserva valores e reavalia restrição por vencimento mantido", async () => {
    const c = await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100,
      saldo: 100, moeda: "CRC", vencimento: new Date("2026-10-05T13:00:00Z"), coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31"),
    } });
    const outra = await prisma.matricula.findUniqueOrThrow({ where: { id: outraId } });
    const pausa = await aprovar();
    await executar(pausa);
    entrar(secId);
    const r = await solicitarRetomadaMatriculas(alunoId, { retorno: "2026-12-10", motivo: "Retorno após pausa aprovada", chaveIdempotencia: "retomada-execucao-001",
      matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } }],
    });
    if (!r.ok) throw new Error(r.erro);
    entrar(finId);
    expect((await decidirRetomadaMatriculas(r.dado!.propostaId, decisao)).ok).toBe(true);
    const aplicar = () => prisma.$transaction((tx) => aplicarRetomadaMatriculasTx(tx, r.dado!.propostaId, secId, new Date("2026-12-10T12:00:00Z")));
    await expect(prisma.$transaction((tx) => aplicarRetomadaMatriculasTx(tx, r.dado!.propostaId, secId, new Date("2026-12-09T12:00:00Z")))).rejects.toThrow("ainda não chegou");
    await expect(prisma.$transaction(async (tx) => {
      await aplicarRetomadaMatriculasTx(tx, r.dado!.propostaId, secId, new Date("2026-12-10T12:00:00Z"));
      throw new Error("Rollback da execução");
    })).rejects.toThrow("Rollback");
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("PAUSADA");
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("CANCELADA");
    expect(await prisma.evento.count({ where: { tipo: "MatriculaRetomada" } })).toBe(0);
    await aplicar();
    await aplicar();
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({
      valorOriginal: c.valorOriginal, valorNegociado: c.valorNegociado, saldo: c.saldo, vencimento: c.vencimento,
      coberturaInicio: new Date("2026-12-10"), coberturaFim: new Date("2026-12-31"),
      status: "ATRASADO", cicloRegua: 1, versao: c.versao + 2, suspensaPorItemPausaId: null,
    });
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).toMatchObject({ status: "ATIVA", acessoBloqueioAutomatico: true });
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outraId } })).toEqual(outra);
    expect(await prisma.evento.count({ where: { tipo: "MatriculaRetomada" } })).toBe(1);
    expect(await prisma.movimentacaoAluno.count({ where: { matriculaId, tipo: "REATIVACAO" } })).toBe(1);
    expect(await prisma.movimentacaoAluno.count({ where: { matriculaId: outraId } })).toBe(0);
    expect(await prisma.recebimento.count()).toBe(0);
  });
});

