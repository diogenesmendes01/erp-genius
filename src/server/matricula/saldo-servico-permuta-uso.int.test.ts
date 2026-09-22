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
import { decidirDestinacaoExcedentePermuta, prepararDestinacaoExcedentePermuta, registrarConcordanciaExcedentePermuta } from "./excedente-permuta-destinacao";
import { consultarUsosSaldoServicoPermuta, decidirUsoSaldoServicoPermuta, proporUsoSaldoServicoPermuta } from "./saldo-servico-permuta-uso";

let financeiroId = "", aprovadorId = "", pedagogicoId = "", matriculaId = "", cobrancaId = "", aplicacaoPermutaId = "", saldoId = "";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

// Mensalidade de 100 liquidada com 50 de caixa e 50 de permuta; acerto para 70 destina 20 a saldo de serviços e 10 a crédito.
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
  entrar(financeiroId);
  const destinacao = await prepararDestinacaoExcedentePermuta({ matriculaId, cobrancaId, valorDevidoAcordado: "70.00", distribuicao: [{ origemId: aplicacaoPermutaId, valor: "30.00" }],
    itens: [{ tipo: "SALDO_SERVICOS", valor: "20.00" }, { tipo: "CREDITO_FINANCEIRO", valor: "10.00" }], motivo: "Acerto reduziu a mensalidade para setenta; excedente negociado com o aluno.", chaveIdempotencia: "q171-destinacao-base" });
  if (!destinacao.ok || !destinacao.dado) throw new Error(JSON.stringify(destinacao));
  for (const parte of ["ALUNO_OU_RESPONSAVEL", "ESCOLA"] as const) expect(await registrarConcordanciaExcedentePermuta({ propostaId: destinacao.dado.id, parte, nomeDeclarante: parte === "ESCOLA" ? "Direção da escola" : "Excedente Q171", meio: "WhatsApp", evidencia: "Mensagem confirmando o destino combinado para o excedente." })).toMatchObject({ ok: true });
  entrar(aprovadorId);
  expect(await decidirDestinacaoExcedentePermuta({ propostaId: destinacao.dado.id, aprovada: true, motivo: "Fontes, acordo e concordâncias conferidos." })).toMatchObject({ ok: true, dado: { aprovada: true } });
  saldoId = (await prisma.saldoServicoPermuta.findFirstOrThrow()).id;
});

const novaCobranca = (tipo: TipoCobranca, valor: number, moeda = "CRC") => prisma.cobranca.create({ data: { matriculaId, tipo, moeda, valorOriginal: valor, valorNegociado: valor, saldo: valor, vencimento: new Date("2099-11-01T00:00:00Z") } });
const propor = (extra: Record<string, unknown> = {}) => proporUsoSaldoServicoPermuta({ saldoId, cobrancaId, valor: "15.00", motivo: "Abater a próxima mensalidade com o saldo de serviços combinado.", chaveIdempotencia: "q171-uso-1", ...extra });

it("Q171: saldo de serviços abate cobrança aberta da mesma matrícula e moeda, por proposta e aprovação independente, como aplicação de permuta", async () => {
  const proxima = await novaCobranca(TipoCobranca.MENSALIDADE, 40);
  const material = await novaCobranca(TipoCobranca.MATERIAL, 30);
  const usd = await novaCobranca(TipoCobranca.HORA_PARTICULAR, 30, "USD");
  const base = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outraMatricula = await prisma.matricula.create({ data: { alunoId: base.alunoId, produtoId: base.produtoId, paisId: base.paisId, moeda: "CRC", status: "ATIVA" } });
  const alheia = await prisma.cobranca.create({ data: { matriculaId: outraMatricula.id, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 40, valorNegociado: 40, saldo: 40, vencimento: new Date("2099-11-01T00:00:00Z") } });
  entrar(financeiroId);
  expect(await propor({ cobrancaId: material.id })).toMatchObject({ ok: false, erro: expect.stringContaining("apenas mensalidade") });
  expect(await propor({ cobrancaId: usd.id })).toMatchObject({ ok: false, erro: expect.stringContaining("USD") });
  expect(await propor({ cobrancaId: alheia.id })).toMatchObject({ ok: false, erro: expect.stringContaining("mesma matrícula") });
  expect(await propor({ cobrancaId: proxima.id, valor: "25.00" })).toMatchObject({ ok: false, erro: expect.stringContaining("saldo de serviços disponível (20.00 CRC)") });
  // Mesmo fora da ação, o banco recusa uso acima do disponível.
  await expect(prisma.propostaUsoSaldoServicoPermuta.create({ data: { saldoId, matriculaId, cobrancaId: proxima.id, versaoCobranca: proxima.versao, moeda: "CRC", valor: 25, motivo: "Direto no banco", preparadorId: financeiroId, chaveIdempotencia: "q171-uso-banco", entradaHash: "x" } })).rejects.toThrow(/dispon/);
  const proposta = await propor({ cobrancaId: proxima.id });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(await propor({ cobrancaId: proxima.id })).toEqual(proposta);
  // A proposta pendente reserva o saldo: só sobram 5.
  expect(await propor({ cobrancaId, valor: "10.00", chaveIdempotencia: "q171-uso-2" })).toMatchObject({ ok: false });
  expect(await decidirUsoSaldoServicoPermuta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Tentativa do próprio preparador." })).toMatchObject({ ok: false });
  await expect(prisma.decisaoUsoSaldoServicoPermuta.create({ data: { propostaId: proposta.dado.id, decisorId: financeiroId, aprovada: true, motivo: "Autoaprovação direta" } })).rejects.toThrow();
  entrar(aprovadorId);
  // Aprovação sem a aplicação na mesma transação é recusada pelo banco.
  await expect(prisma.decisaoUsoSaldoServicoPermuta.create({ data: { propostaId: proposta.dado.id, decisorId: aprovadorId, aprovada: true, motivo: "Aprovação sem aplicação" } })).rejects.toThrow(/mesma transa/);
  const decisao = await decidirUsoSaldoServicoPermuta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Saldo, cobrança e moeda conferidos." });
  if (!decisao.ok) throw new Error(JSON.stringify(decisao));
  expect(await decidirUsoSaldoServicoPermuta({ propostaId: proposta.dado.id, aprovada: true, motivo: "Saldo, cobrança e moeda conferidos." })).toEqual(decisao);
  const depois = await prisma.cobranca.findUniqueOrThrow({ where: { id: proxima.id } });
  expect(depois.valorCompensadoPermuta.toFixed(2)).toBe("15.00");
  expect(depois.saldo?.toFixed(2)).toBe("25.00");
  expect(depois.status).toBe("PENDENTE");
  const aplicacao = await prisma.aplicacaoCompensacaoPermuta.findFirstOrThrow({ where: { cobrancaId: proxima.id } });
  expect(aplicacao).toMatchObject({ destinoId: null, decisaoId: null });
  expect(aplicacao.usoSaldoServicoId).toBeTruthy();
  await expect(prisma.aplicacaoCompensacaoPermuta.create({ data: { usoSaldoServicoId: aplicacao.usoSaldoServicoId, cobrancaId: proxima.id, valor: 15 } })).rejects.toThrow();
  await expect(prisma.aplicacaoCompensacaoPermuta.deleteMany({ where: { id: aplicacao.id } })).rejects.toThrow();
  // Saldo nunca vira dinheiro: o uso não gera crédito financeiro (o único crédito é o da destinação).
  expect(await prisma.creditoMatricula.count()).toBe(1);
  const painel = await consultarUsosSaldoServicoPermuta({ matriculaId });
  expect(painel).toMatchObject({ ok: true, dado: { saldos: [{ id: saldoId, valorInicial: "20.00", usadoAprovado: "15.00", disponivel: "5.00" }], propostas: [{ estado: "APROVADA", valor: "15.00", decisao: { aplicacaoId: aplicacao.id } }] } });
  // O restante abate a taxa e quita a cobrança; o saldo então zera.
  const taxa = await novaCobranca(TipoCobranca.MATRICULA, 5);
  entrar(financeiroId);
  const segunda = await propor({ cobrancaId: taxa.id, valor: "5.00", chaveIdempotencia: "q171-uso-3" });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  entrar(aprovadorId);
  expect(await decidirUsoSaldoServicoPermuta({ propostaId: segunda.dado.id, aprovada: true, motivo: "Restante do saldo conferido." })).toMatchObject({ ok: true, dado: { aprovada: true } });
  expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: taxa.id } })).toMatchObject({ status: "PAGO" });
  expect(((await consultarUsosSaldoServicoPermuta({ matriculaId })) as { dado?: { saldos: unknown[] } }).dado?.saldos[0]).toMatchObject({ disponivel: "0.00", cobrancasAbativeis: [] });
});

it("Q171: rejeição devolve a reserva do saldo; cobrança alterada depois da proposta invalida a aprovação", async () => {
  const proxima = await novaCobranca(TipoCobranca.MENSALIDADE, 40);
  entrar(financeiroId);
  const primeira = await propor({ cobrancaId: proxima.id, valor: "20.00" });
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  entrar(aprovadorId);
  expect(await decidirUsoSaldoServicoPermuta({ propostaId: primeira.dado.id, aprovada: false, motivo: "Aluno pediu para guardar o saldo." })).toMatchObject({ ok: true, dado: { aprovada: false } });
  expect(await prisma.aplicacaoCompensacaoPermuta.count({ where: { cobrancaId: proxima.id } })).toBe(0);
  expect(((await consultarUsosSaldoServicoPermuta({ matriculaId })) as { dado?: { saldos: unknown[] } }).dado?.saldos[0]).toMatchObject({ disponivel: "20.00" });
  entrar(financeiroId);
  const segunda = await propor({ cobrancaId: proxima.id, valor: "20.00", chaveIdempotencia: "q171-uso-4" });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  const segundaId = segunda.dado.id;
  await prisma.$transaction((tx) => receberComDestinacoesTx(tx, {
    titularMatriculaId: matriculaId, chaveIdempotencia: "q171-caixa-depois", autorId: financeiroId, valorRecebido: 30, forma: "DINHEIRO", moeda: "CRC", dataPagamento: new Date("2099-10-15T12:00:00Z"),
    destinos: [{ tipo: TipoDestinacaoRecebimento.COBRANCA, cobrancaId: proxima.id, valor: 30, evidencia: "Caixa recebido depois da proposta de uso.", chaveIdempotencia: "q171-caixa-depois-destino" }],
  }));
  entrar(aprovadorId);
  expect(await decidirUsoSaldoServicoPermuta({ propostaId: segundaId, aprovada: true, motivo: "Tentativa após mudança da cobrança." })).toMatchObject({ ok: false, erro: expect.stringContaining("mudou") });
  await expect(prisma.$transaction(async (tx) => {
    const dec = await tx.decisaoUsoSaldoServicoPermuta.create({ data: { propostaId: segundaId, decisorId: aprovadorId, aprovada: true, motivo: "Aprovação direta após mudança" } });
    await tx.aplicacaoCompensacaoPermuta.create({ data: { usoSaldoServicoId: dec.id, cobrancaId: proxima.id, valor: 20 } });
  })).rejects.toThrow();
});


