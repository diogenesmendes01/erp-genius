import { beforeEach, expect, it, vi } from "vitest";
import { Papel, TipoCobranca, TipoDestinacaoRecebimento, UnidadePermutaServico } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { receberComDestinacoesTx } from "@/server/financeiro/recebimentos";
import { prepararAcordoPermuta, confirmarServicoPermuta, proporCompensacaoPermuta, decidirCompensacaoPermuta } from "@/server/financeiro/permuta-servico";
import { consultarDestinacoesExcedentePermuta, decidirDestinacaoExcedentePermuta, prepararDestinacaoExcedentePermuta, registrarConcordanciaExcedentePermuta } from "./excedente-permuta-destinacao";

let financeiroId = "", aprovadorId = "", pedagogicoId = "", matriculaId = "", cobrancaId = "", aplicacaoPermutaId = "";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

// Mensalidade de 100 liquidada com 50 de caixa e 50 de permuta comprovada.
beforeEach(async () => {
  await truncarBanco();
  financeiroId = (await criarUsuario([Papel.FINANCEIRO], "Financeiro Q171")).id;
  aprovadorId = (await criarUsuario([Papel.FINANCEIRO], "Aprovador Q171")).id;
  pedagogicoId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Pedagógico Q171")).id;
  await prisma.usuario.update({ where: { id: aprovadorId }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  const catalogo = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Excedente", sobrenome: "Q171", paisId: catalogo.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  cobrancaId = (await prisma.cobranca.create({ data: { matriculaId, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2099-10-01T00:00:00Z") } })).id;
  await prisma.$transaction((tx) => receberComDestinacoesTx(tx, {
    titularMatriculaId: matriculaId, chaveIdempotencia: "q171-caixa-para-cobranca", autorId: financeiroId, valorRecebido: 50, forma: "DINHEIRO", moeda: "CRC", dataPagamento: new Date("2099-09-01T12:00:00Z"),
    destinos: [{ tipo: TipoDestinacaoRecebimento.COBRANCA, cobrancaId, valor: 50, evidencia: "Caixa identificado para a mensalidade Q171.", chaveIdempotencia: "q171-caixa-destino" }],
  }));
  entrar(financeiroId);
  const acordo = await prepararAcordoPermuta({ matriculaId, vigenciaInicio: "2099-10-01", vigenciaFim: "2099-10-31", moeda: "CRC", unidade: UnidadePermutaServico.HORA, quantidadePactuada: "1.00", valorPorUnidade: "50.00", contrapartida: "Serviço pedagógico efetivamente prestado à escola.", formulaDescricao: "Uma hora comprovada equivale a cinquenta colones.", cobrancas: [{ cobrancaId, valorMaximo: "50.00" }], chaveIdempotencia: "q171-acordo-permuta" });
  if (!acordo.ok || !acordo.dado) throw new Error(JSON.stringify(acordo));
  entrar(pedagogicoId);
  const confirmacao = await confirmarServicoPermuta({ acordoId: acordo.dado.id, periodoInicio: "2099-10-01", periodoFim: "2099-10-01", quantidadeComprovada: "1.00", referenciaServico: "Q171-SERVICO-1", evidencia: "Diário pedagógico confirma a hora prestada à escola.", chaveIdempotencia: "q171-confirmacao-permuta" });
  if (!confirmacao.ok || !confirmacao.dado) throw new Error(JSON.stringify(confirmacao));
  entrar(financeiroId);
  const proposta = await proporCompensacaoPermuta({ confirmacaoId: confirmacao.dado.id, destinos: [{ cobrancaId, valor: "50.00" }], chaveIdempotencia: "q171-proposta-permuta" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(aprovadorId);
  expect(await decidirCompensacaoPermuta({ propostaId: proposta.dado.id, aprovar: true, motivo: "Acordo, confirmação, proposta e destino conferidos." })).toMatchObject({ ok: true });
  aplicacaoPermutaId = (await prisma.aplicacaoCompensacaoPermuta.findFirstOrThrow({ where: { cobrancaId } })).id;
});

const preparar = (extra: Record<string, unknown> = {}) => prepararDestinacaoExcedentePermuta({ matriculaId, cobrancaId, valorDevidoAcordado: "70.00", distribuicao: [{ origemId: aplicacaoPermutaId, valor: "30.00" }],
  itens: [{ tipo: "SALDO_SERVICOS", valor: "20.00" }, { tipo: "CREDITO_FINANCEIRO", valor: "10.00" }], motivo: "Acerto reduziu a mensalidade para setenta; excedente negociado com o aluno.", chaveIdempotencia: "q171-destinacao-1", ...extra });
const concordar = (propostaId: string, parte: "ALUNO_OU_RESPONSAVEL" | "ESCOLA") => registrarConcordanciaExcedentePermuta({ propostaId, parte, nomeDeclarante: parte === "ESCOLA" ? "Direção da escola" : "Excedente Q171", meio: "WhatsApp", evidencia: "Mensagem confirmando o destino combinado para o excedente." });

it("Q171: destinação negociada exige fonte mista distribuída, concordância das duas partes e aprovador independente; cria saldo de serviços e crédito na mesma transação", async () => {
  entrar(financeiroId);
  // Fonte mista (caixa + permuta) sem distribuição acordada não é presumida.
  expect(await preparar({ distribuicao: undefined })).toMatchObject({ ok: false, erro: expect.stringContaining("distribuição") });
  expect(await preparar({ itens: [{ tipo: "SALDO_SERVICOS", valor: "25.00" }] })).toMatchObject({ ok: false, erro: expect.stringContaining("somar exatamente") });
  const proposta = await preparar();
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(proposta.dado.valorExcedente).toBe("30.00");
  expect(await preparar()).toEqual(proposta);
  expect(await preparar({ chaveIdempotencia: "q171-destinacao-paralela" })).toMatchObject({ ok: false });

  // Sem as duas concordâncias, nem a ação nem o banco aprovam.
  entrar(aprovadorId);
  expect(await decidirDestinacaoExcedentePermuta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Tentativa sem concordância registrada." })).toMatchObject({ ok: false, erro: expect.stringContaining("concordância") });
  const gravada = await prisma.propostaDestinacaoExcedentePermuta.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  await expect(prisma.decisaoDestinacaoExcedentePermuta.create({ data: { propostaId: gravada.id, decisorId: aprovadorId, aprovada: true, motivo: "Aprovação direta sem concordâncias", fotografiaHash: gravada.fotografiaHash } })).rejects.toThrow();
  entrar(financeiroId);
  expect(await concordar(proposta.dado.id, "ALUNO_OU_RESPONSAVEL")).toMatchObject({ ok: true });
  expect(await concordar(proposta.dado.id, "ESCOLA")).toMatchObject({ ok: true });
  // Autoaprovação negada na ação e no banco.
  expect(await decidirDestinacaoExcedentePermuta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Tentativa do próprio preparador." })).toMatchObject({ ok: false });
  await expect(prisma.decisaoDestinacaoExcedentePermuta.create({ data: { propostaId: gravada.id, decisorId: financeiroId, aprovada: true, motivo: "Autoaprovação direta no banco", fotografiaHash: gravada.fotografiaHash } })).rejects.toThrow();
  expect(await prisma.creditoMatricula.count()).toBe(0);

  const cobrancaAntes = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  entrar(aprovadorId);
  const decisao = await decidirDestinacaoExcedentePermuta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Fontes, acordo e concordâncias conferidos." });
  if (!decisao.ok) throw new Error(JSON.stringify(decisao));
  expect(await decidirDestinacaoExcedentePermuta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Fontes, acordo e concordâncias conferidos." })).toEqual(decisao);
  expect(await prisma.saldoServicoPermuta.findMany()).toMatchObject([{ matriculaId, moeda: "CRC" }]);
  expect((await prisma.saldoServicoPermuta.findFirstOrThrow()).valorInicial.toFixed(2)).toBe("20.00");
  const creditos = await prisma.creditoMatricula.findMany({ include: { origemExcedentePermuta: true } });
  expect(creditos).toHaveLength(1);
  expect(creditos[0]).toMatchObject({ matriculaId, moeda: "CRC", origemExcedentePermuta: { cobrancaId } });
  expect(creditos[0].valorInicial.toFixed(2)).toBe("10.00");
  // A destinação não altera a cobrança nem a compensação de permuta original.
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } })).toEqual(cobrancaAntes);
  await expect(prisma.saldoServicoPermuta.deleteMany()).rejects.toThrow();
  await expect(prisma.itemDestinacaoExcedentePermuta.updateMany({ data: { valor: 1 } })).rejects.toThrow();

  // O mesmo serviço não é destinado duas vezes: restam 20 da compensação de 50.
  entrar(financeiroId);
  expect(await preparar({ chaveIdempotencia: "q171-destinacao-2", valorDevidoAcordado: "45.00", distribuicao: [{ origemId: aplicacaoPermutaId, valor: "25.00" }, { origemId: (await prisma.destinacaoRecebimento.findFirstOrThrow({ where: { cobrancaId } })).id, valor: "30.00" }], itens: [{ tipo: "SALDO_SERVICOS", valor: "25.00" }] })).toMatchObject({ ok: false, erro: expect.stringContaining("já possui destinação de excedente aprovada") });
  const painel = await consultarDestinacoesExcedentePermuta({ matriculaId });
  expect(painel).toMatchObject({ ok: true, dado: { cobrancas: [{ id: cobrancaId, permuta: "50.00", emAndamento: false, destinada: true }], saldosServico: [{ valorInicial: "20.00" }],
    propostas: [{ estado: "APROVADA", valorExcedente: "30.00", partesPendentes: [], itens: expect.arrayContaining([{ tipo: "SALDO_SERVICOS", valor: "20.00" }, { tipo: "CREDITO_FINANCEIRO", valor: "10.00" }]) }] } });
});

it("Q171: rejeição não cria destino e libera nova proposta; cobrança alterada depois da proposta invalida a aprovação", async () => {
  entrar(financeiroId);
  const primeira = await preparar();
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  entrar(aprovadorId);
  expect(await decidirDestinacaoExcedentePermuta({ propostaId: primeira.dado.id, aprovada: false, motivo: "Acordo ainda não fechado com o aluno." })).toMatchObject({ ok: true, dado: { aprovada: false } });
  expect(await prisma.saldoServicoPermuta.count()).toBe(0);
  expect(await prisma.creditoMatricula.count()).toBe(0);
  entrar(financeiroId);
  const segunda = await preparar({ chaveIdempotencia: "q171-destinacao-apos-rejeicao" });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(await concordar(segunda.dado.id, "ALUNO_OU_RESPONSAVEL")).toMatchObject({ ok: true });
  expect(await concordar(segunda.dado.id, "ESCOLA")).toMatchObject({ ok: true });
  await prisma.$executeRaw`UPDATE "Cobranca" SET versao = versao + 1 WHERE id = ${cobrancaId}`;
  entrar(aprovadorId);
  expect(await decidirDestinacaoExcedentePermuta({ propostaId: segunda.dado.id, aprovada: true, motivo: "Tentativa com cobrança já alterada." })).toMatchObject({ ok: false });
  expect(await prisma.decisaoDestinacaoExcedentePermuta.count()).toBe(1);
});
