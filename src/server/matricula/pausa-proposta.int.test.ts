import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
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
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { preservarConclusaoAssinaturaTx } from "@/server/contratos/conclusao-assinatura-tx";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { confirmarAceiteOriginal, consultarAceiteOriginal } from "@/server/contratos/aceite";
import { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } from "./pausa-proposta";
import { aplicarPausaMatriculasTx } from "./pausa-execucao";
import { aplicarMovimentacaoContratual } from "./aplicar-movimentacao";
import { pausarAluno, encerrarAluno } from "@/server/alunos/acoes";
import { concluirMatricula } from "./acoes";
import { preverRetomadaMatriculas } from "./retomada-previa";
import { solicitarRetomadaMatriculas, decidirRetomadaMatriculas } from "./retomada-proposta";
import { aplicarRetomadaMatriculasTx } from "./retomada-execucao";
import { listarPropostasMovimentacao, obterDetalhesMovimentacao } from "./movimentacoes-consultas";
import { carregarTrilhasVencimentoCivil, incluirFonteVencimentoCivil, referenciaVencimentoCivil } from "@/server/financeiro/vencimento-civil";
import { prepararLoteMigracao } from "@/server/migracao/acoes";
import { aplicarVinculoMigracao } from "@/server/migracao/aplicar-vinculo";
import { ensaiarVinculoMigracao, revisarCorrespondenciaProdutoMigracao, revisarCorrespondenciaStatusMatriculaMigracao, revisarCorrespondenciaTurmaMigracao } from "@/server/migracao/ensaio-vinculo";
import { proporEntradaFinanceiraHistoricaMigracao, decidirEntradaFinanceiraHistoricaMigracao } from "@/server/migracao/entrada-financeira-historica";
let alunoId: string, matriculaId: string, outraId: string, secId: string, finId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const input = () => ({ matriculaIds: [matriculaId], dataEfetiva: "2026-09-15", motivo: "Pausa solicitada pelo aluno", chaveIdempotencia: "pausa-selecao-001" });
const decisao = { aprovar: true, motivo: "Condições e períodos conferidos" };

/**
 * A fonte civil dos quatro cenários de retomada é uma obrigação M01 real:
 * vínculo conferido, mapa de origem criado pela aplicação e decisão financeira
 * independente. Os demais testes preservam a fixture enxuta original.
 */
async function prepararMatriculaM01ComMensalidade(dataCivil: string, cobertura: { inicio: string; fim: string }, valor = "100") {
  const catalogo = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId }, include: { produto: true } });
  const origem = `M01-RETOMADA-${randomUUID()}`;
  const alunoOrigemId = `aluno-${randomUUID()}`;
  const matriculaOrigemId = `matricula-${randomUUID()}`;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.produto.idiomaId, codigo: `A${Date.now()}-${Math.floor(Math.random() * 1000)}`, ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.produto.modalidadeId, nivelId: nivel.id, codigo: `M01-${randomUUID()}` } });
  entrar(secId);
  const vinculo = await prepararLoteMigracao({ origem, chaveLote: `vinculo-${randomUUID()}`, linhas: [{
    linhaOrigem: "vinculo!2", tipoEntrada: "VINCULO_MATRICULA",
    aluno: { id: alunoOrigemId, nome: "Aluno retomada", email: "retomada@example.test", documento: "DOC-RETOMADA", pais: "CR", fuso: "America/Costa_Rica" },
    turma: { id: "turma-retomada", codigo: turma.codigo },
    matricula: { id: matriculaOrigemId, produtoOrigem: "produto-retomada", situacao: "ATIVA", inicio: cobertura.inicio, moeda: "CRC", pais: "CR" },
    alocacao: { inicio: cobertura.inicio }, consentimentoOrigem: "fonte-fixture",
  }] });
  if (!vinculo.ok || !vinculo.dado) throw new Error(vinculo.ok ? "Vínculo M01 sem retorno" : vinculo.erro);
  const linhaVinculo = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: vinculo.dado.loteId } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Pausa M01", paisId: catalogo.paisId } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { origem, alunoOrigemId, alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({ origem, produtoOrigemId: "produto-retomada", produtoId: catalogo.produtoId, paisId: catalogo.paisId, moeda: "CRC", ativa: true });
  await revisarCorrespondenciaTurmaMigracao({ origem, turmaOrigemId: "turma-retomada", turmaId: turma.id, ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem, statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const ensaio = await ensaiarVinculoMigracao({ linhaId: linhaVinculo.id });
  if (!ensaio.ok) throw new Error(ensaio.erro);
  const ensaioSalvo = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linhaVinculo.id } });
  const aplicacaoVinculo = await aplicarVinculoMigracao({ linhaId: linhaVinculo.id, ensaioId: ensaioSalvo.id, entradaHash: linhaVinculo.entradaHash, contextoHash: ensaioSalvo.contextoHash, fusoReferencia: "America/Costa_Rica", semanticaFim: "LIMITE_EXCLUSIVO", inicioAlocacao: cobertura.inicio, fimAlocacao: null, diaVencimento: 10, mesesPlano: 1, evidenciaContrato: { fonte: "contrato" }, evidenciaPagamento: { fonte: "pagamento" }, fatos: [{ tipo: "ATIVACAO", data: cobertura.inicio, evidencia: { fonte: "ativo" } }] });
  if (!aplicacaoVinculo.ok || !aplicacaoVinculo.dado) throw new Error(aplicacaoVinculo.ok ? "Aplicação M01 sem retorno" : aplicacaoVinculo.erro);
  alunoId = aluno.id;
  matriculaId = aplicacaoVinculo.dado.matriculaId;
  await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL" } });

  const financeiro = await prepararLoteMigracao({ origem, chaveLote: `financeiro-${randomUUID()}`, linhas: [{
    linhaOrigem: "financeiro!2", tipoEntrada: "FINANCEIRO_HISTORICO",
    aluno: { id: alunoOrigemId, nome: "Aluno retomada", email: "retomada@example.test", documento: "DOC-RETOMADA", pais: "CR", fuso: "America/Costa_Rica" },
    matricula: { id: matriculaOrigemId, produtoOrigem: "produto-retomada", situacao: "ATIVA", inicio: cobertura.inicio, moeda: "CRC", pais: "CR" },
    financeiro: { id: `financeiro-${randomUUID()}`, tipo: "MENSALIDADE", valor, moeda: "CRC", situacao: "PENDENTE" }, consentimentoOrigem: "fonte-fixture",
  }] });
  if (!financeiro.ok || !financeiro.dado) throw new Error(financeiro.ok ? "Financeiro M01 sem retorno" : financeiro.erro);
  const linhaFinanceira = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: financeiro.dado.loteId } });
  entrar(finId);
  const proposta = await proporEntradaFinanceiraHistoricaMigracao({ linhaId: linhaFinanceira.id, tipoCobranca: "MENSALIDADE", valor, moeda: "CRC", vencimento: dataCivil, competencia: dataCivil.slice(0, 7), pagador: { tipo: "ALUNO", dados: { nome: "Pagador retomada", paisId: catalogo.paisId } }, evidencia: { planilha: "financeiro!2" }, chaveIdempotencia: randomUUID() });
  if (!proposta.ok || !proposta.dado) throw new Error(proposta.ok ? "Proposta M01 sem retorno" : proposta.erro);
  entrar(secId);
  const decisaoM01 = await decidirEntradaFinanceiraHistoricaMigracao({ propostaId: proposta.dado.id, aprovada: true, motivo: "Obrigação histórica conferida independentemente.", chaveIdempotencia: randomUUID() });
  if (!decisaoM01.ok || !decisaoM01.dado) throw new Error(decisaoM01.ok ? "Decisão M01 sem retorno" : decisaoM01.erro);
  return prisma.cobranca.update({ where: { id: decisaoM01.dado.cobrancaId }, data: { coberturaInicio: new Date(`${cobertura.inicio}T00:00:00Z`), coberturaFim: new Date(`${cobertura.fim}T00:00:00Z`) } });
}
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
    const paga = await prisma.cobranca.update({ where: { id: (await prepararMatriculaM01ComMensalidade("2000-02-05", { inicio: "2000-02-01", fim: "2000-02-29" })).id }, data: { pagoEm: new Date("1999-12-28") } });
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
    const aposPausa = await prisma.cobranca.findUniqueOrThrow({ where: { id: paga.id } });
    expect(aposPausa).toMatchObject({ status: quitada ? "PAGO" : "CANCELADA", suspensaPorItemPausaId: expect.any(String), pagoEm: quitada ? paga.pagoEm : null });
    expect(aposPausa.saldo?.toFixed(2)).toBe(quitada ? "0.00" : "60.00");
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
    const aposRetomada = await prisma.cobranca.findUniqueOrThrow({ where: { id: paga.id } });
    expect(aposRetomada).toMatchObject({ status: quitada ? "PAGO" : "ATRASADO", pagoEm: quitada ? paga.pagoEm : null,
      coberturaInicio: new Date("2000-01-02"), coberturaFim: new Date("2000-01-31"), suspensaPorItemPausaId: null });
    expect(aposRetomada.saldo?.toFixed(2)).toBe(quitada ? "0.00" : "60.00");
    expect(aposRetomada.valorRecebido?.toFixed(2)).toBe(`${recebido}.00`);
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
    await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: finId, chaveIdempotencia: "pausa-pagamento-posterior", valorRecebido: 100, forma: "DINHEIRO", dataPagamento: new Date("2026-10-06T12:00:00Z"), evidencia: "Pagamento posterior à proposta de pausa." }));
    const recebida = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
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
    const c = await prepararMatriculaM01ComMensalidade("2026-10-05", { inicio: "2026-10-01", fim: "2026-10-31" });
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
    const c = await prepararMatriculaM01ComMensalidade("2026-10-05", { inicio: "2026-10-01", fim: "2026-10-31" });
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
  it("persiste a âncora versionada ao reprogramar a mesma data civil e a recupera na próxima consulta", async () => {
    await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "Pacific/Kiritimati" } });
    const cobrancaInicial = await prepararMatriculaM01ComMensalidade("2099-03-01", { inicio: "2099-03-01", fim: "2099-03-31" });
    const pausa = await aprovar();
    await executar(pausa);
    entrar(secId);
    const proposta = await solicitarRetomadaMatriculas(alunoId, {
      retorno: "2099-03-15", motivo: "Reprogramação civil confirmada para a mesma data.", chaveIdempotencia: "retomada-mesma-data-versionada",
      matriculas: [{ matriculaId, vencimentos: { opcao: "REPROGRAMAR_PARCELAS", datas: [{ cobrancaId: cobrancaInicial.id, vencimento: "2099-03-01" }] } }],
    });
    if (!proposta.ok || !proposta.dado) throw new Error(proposta.ok ? "Retomada sem retorno" : proposta.erro);
    entrar(finId);
    expect((await decidirRetomadaMatriculas(proposta.dado.propostaId, decisao)).ok).toBe(true);
    await prisma.$transaction((tx) => aplicarRetomadaMatriculasTx(tx, proposta.dado!.propostaId, secId, new Date("2099-03-15T12:00:00Z")));

    const propostaAplicada = await prisma.propostaRetomadaMatriculas.findUniqueOrThrow({ where: { id: proposta.dado.propostaId } });
    expect(propostaAplicada.snapshot).toMatchObject({ matriculas: [{ periodos: [expect.objectContaining({ cobrancaId: cobrancaInicial.id, vencimento: "2099-03-01", versaoCobrancaAntes: cobrancaInicial.versao + 1 })] }] });
    const cobranca = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaInicial.id }, select: { id: true, vencimento: true, versao: true, ...incluirFonteVencimentoCivil } });
    const trilhas = await carregarTrilhasVencimentoCivil(prisma, [cobranca.id], [matriculaId]);
    expect(referenciaVencimentoCivil({ ...cobranca, aplicacoesAditivoVencimento: trilhas.vencimentosPorCobranca.get(cobranca.id), aplicacoesM01: trilhas.m01PorCobranca.get(cobranca.id), retomadasReprogramadas: trilhas.retomadasReprogramadas })).toEqual({ estado: "CONFIRMADO", dataCivil: "2099-03-01", fuso: null, origem: "RETOMADA_REPROGRAMADA" });
  });
  it("recupera a data civil UTC+14 da emissão real sem inferir o fuso atual", async () => {
    // Esta fixture percorre contratação, condições e emissão pública. Ela grava
    // 2099-10-05T12:00 Pacific/Kiritimati como 2099-10-04T22Z.
    await truncarBanco();
    const fixture = await prepararFixtureSubstituicaoContratual(authMock, { semSubstituicao: true, primeiraMensalidadeExigida: true, ambiente: "PRODUCAO", fusoInstitucional: "Pacific/Kiritimati" });
    const processo = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: fixture.processoId }, include: { artefato: { include: { conferencia: true } }, tentativas: { orderBy: { numero: "desc" }, take: 1 } } });
    const participantes = (processo.artefato.conferencia.snapshot as { participantes: Array<{ papel: "ALUNO"; identidade: unknown }> }).participantes;
    const tentativa = processo.tentativas[0];
    if (!tentativa) throw new Error("Tentativa de assinatura ausente.");
    const conclusao = await prisma.$transaction((tx) => preservarConclusaoAssinaturaTx(tx, { processoId: processo.id, referenciaExterna: fixture.referenciaExternaFonte, originalHash: processo.artefato.pdfHash, concluidaEm: tentativa.iniciadaEm.toISOString(), pdfAssinado: Buffer.from("%PDF-assinado-fixture-UTC14"), evidencias: Buffer.from("assinatura simulada exclusivamente para teste UTC+14"), assinaturas: participantes.map((p) => ({ papel: p.papel, identidadeHash: hashPrevia(p.identidade), referenciaAssinatura: `assinatura-${p.papel}`, assinadaEm: tentativa.iniciadaEm.toISOString() })) }));
    entrar(fixture.secretariaId);
    const aceite = await consultarAceiteOriginal({ matriculaId: fixture.matriculaId, conclusaoId: conclusao.id });
    if (!aceite.ok || !aceite.dado?.revisao) throw new Error("Revisão de aceite UTC+14 ausente.");
    expect(await confirmarAceiteOriginal({ matriculaId: fixture.matriculaId, conclusaoId: conclusao.id, revisaoHash: aceite.dado.revisao.hash, evidenciasConferidas: true, motivo: "Aceite conferido para validar vencimento civil UTC+14.", chaveIdempotencia: "aceite-utc14" })).toMatchObject({ ok: true });
    const caixa = await criarUsuario([Papel.FINANCEIRO]);
    for (const cobrancaPendente of await prisma.cobranca.findMany({ where: { matriculaId: fixture.matriculaId } })) {
      await prisma.$transaction((tx) => receberTx(tx, { cobrancaId: cobrancaPendente.id, autorId: caixa.id, valorRecebido: (cobrancaPendente.saldo ?? cobrancaPendente.valorNegociado).toNumber(), forma: "TRANSFERENCIA", chaveIdempotencia: `pagamento-utc14-${cobrancaPendente.id}`, dataPagamento: new Date("2099-09-01T12:00:00Z"), evidencia: "Recebimento de teste conferido antes da ativação." }));
    }
    const matriculaPreparada = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId } });
    await prisma.politicaComissao.create({ data: { paisId: matriculaPreparada.paisId, produtoId: matriculaPreparada.produtoId, versao: 1, tipo: "PERCENTUAL", percentual: 10, moeda: matriculaPreparada.moeda, vigenteEm: new Date("2000-01-01T00:00:00Z"), criadaPorId: fixture.adminId } });
    entrar(fixture.adminId);
    expect(await concluirMatricula(fixture.matriculaId)).toMatchObject({ ok: true });
    const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: fixture.matriculaId } });
    expect(matricula.status).toBe("ATIVA");
    const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: fixture.matriculaId, tipo: "MENSALIDADE" }, select: { id: true, vencimento: true, versao: true, ...incluirFonteVencimentoCivil } });
    expect(cobranca.vencimento).toEqual(new Date("2099-10-04T22:00:00.000Z"));
    entrar(fixture.secretariaId);
    const pausa = await solicitarPausaMatriculas(matricula.alunoId, { matriculaIds: [fixture.matriculaId], dataEfetiva: "2099-09-15", motivo: "Pausa anterior à cobertura emitida para conferir referência civil.", chaveIdempotencia: "pausa-kiritimati-emissao" });
    if (!pausa.ok || !pausa.dado) throw new Error(pausa.ok ? "Pausa sem retorno" : pausa.erro);
    const pausaId = pausa.dado.propostaId;
    entrar(fixture.adminId);
    expect((await decidirPropostaPausaMatriculas(pausaId, decisao)).ok).toBe(true);
    await prisma.$transaction((tx) => aplicarPausaMatriculasTx(tx, pausaId, fixture.secretariaId, new Date("2099-09-15T12:00:00Z")));
    entrar(fixture.secretariaId);
    const previa = await preverRetomadaMatriculas(matricula.alunoId, { retorno: "2099-11-01", matriculas: [{ matriculaId: fixture.matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } }] });
    expect(previa).toMatchObject({ ok: true, dado: { matriculas: [expect.objectContaining({ pendencias: [], periodos: [expect.objectContaining({ cobrancaId: cobranca.id, vencimentoAnterior: "2099-10-05", vencimento: "2099-10-05" })] })] } });
  });
});

