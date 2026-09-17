import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

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
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario; } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarRecebimentoDestinado } from "./acoes";
import { consultarHistoricoRecebimentos } from "./recebimentos-historico";
import { podeLerArquivo } from "@/server/uploads/autorizacao";
import { consultarHistoricoRecebimentos } from "./recebimentos-historico";
import { proporUtilizacaoCredito } from "./uso-credito-proposta";
import { decidirUtilizacaoCredito } from "./uso-credito-decisao";
import { proporDevolucaoCredito, decidirDevolucaoCredito } from "./devolucao-credito";

let financeiroId = "", matriculaId = "", moeda = "CRC", c1 = "", c2 = "";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  await truncarBanco();
  financeiroId = (await criarUsuario([Papel.FINANCEIRO], "Caixa Q87")).id;
  const catalogo = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", sobrenome: "Q87", paisId: catalogo.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda } })).id;
  c1 = (await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", moeda, valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2099-10-01") } })).id;
  c2 = (await prisma.cobranca.create({ data: { matriculaId, tipo: "MENSALIDADE", moeda, valorOriginal: 80, valorNegociado: 80, saldo: 80, vencimento: new Date("2099-11-01") } })).id;
  entrar(financeiroId);
});

const entrada = (chaveIdempotencia = "q87-recebimento-destinado-0001") => ({
  titularMatriculaId: matriculaId, chaveIdempotencia, valorRecebido: 150, moeda, forma: "DINHEIRO" as const,
  dataPagamento: new Date("2099-09-10T12:00:00Z"), comentario: "Conferência de caixa Q87", destinos: [
    { tipo: "COBRANCA" as const, cobrancaId: c1, valor: 100, evidencia: "Recibo identifica a mensalidade de outubro.", chaveIdempotencia: `cobranca:${c1}` },
    { tipo: "COBRANCA" as const, cobrancaId: c2, valor: 30, evidencia: "Recibo identifica a antecipação de novembro.", chaveIdempotencia: `cobranca:${c2}` },
    { tipo: "CREDITO_SEM_DESTINO" as const, valor: 20, evidencia: "Saldo antecipado sem cobrança definida.", chaveIdempotencia: "credito-sem-destino" },
  ],
});

it("divide um fato de caixa em dois períodos e crédito explícito, sem duplicar o caixa no replay", async () => {
  const [primeiro, repetido] = await Promise.all([registrarRecebimentoDestinado(entrada()), registrarRecebimentoDestinado(entrada())]);
  expect(primeiro.ok && repetido.ok).toBe(true);
  if (!primeiro.ok || !repetido.ok) throw new Error("Recebimento não criado");
  expect(primeiro.dado?.recebimentoId).toBe(repetido.dado?.recebimentoId);
  expect(await prisma.recebimento.count()).toBe(1);
  const recebimento = await prisma.recebimento.findUniqueOrThrow({ where: { id: primeiro.dado!.recebimentoId }, include: { destinacoes: { orderBy: { chaveIdempotencia: "asc" } } } });
  expect(recebimento).toMatchObject({ cobrancaId: null, titularMatriculaId: matriculaId, moeda, valor: expect.anything() });
  expect(recebimento.destinacoes).toHaveLength(3);
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c1 } })).saldo!.toFixed(2)).toBe("0.00");
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c2 } })).saldo!.toFixed(2)).toBe("50.00");
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { matriculaId } });
  expect(credito.valorInicial.toFixed(2)).toBe("20.00");
});

it("a guarda SQL recusa uma destinação de outro financeiro e faz rollback sem alterar o fato de caixa", async () => {
  const segundoFinanceiroId = (await criarUsuario([Papel.FINANCEIRO], "Outro caixa Q87")).id;
  const criado = await registrarRecebimentoDestinado(entrada("q87-autoria-destinacao-0001"));
  if (!criado.ok || !criado.dado) throw new Error(criado.ok ? "Recebimento ausente" : criado.erro);
  const recebimentoId = criado.dado.recebimentoId;
  const antes = await prisma.destinacaoRecebimento.count({ where: { recebimentoId } });

  await expect(prisma.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO "DestinacaoRecebimento" ("recebimentoId", "autorId", tipo, valor, evidencia, "chaveIdempotencia") VALUES (${recebimentoId}, ${segundoFinanceiroId}, 'CREDITO_SEM_DESTINO', 1, 'Tentativa de outro caixa materializar a destinação.', 'q87-destinacao-de-outro-autor')`;
  })).rejects.toThrow("A destinação deve preservar a autoria do recebimento original.");

  expect(await prisma.destinacaoRecebimento.count({ where: { recebimentoId } })).toBe(antes);
});

it("recusa cobrança de outro contrato ou moeda antes de criar caixa", async () => {
  const original = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outra = await prisma.matricula.create({ data: { alunoId: original.alunoId, produtoId: original.produtoId, paisId: original.paisId, moeda: "USD" } });
  const estrangeira = await prisma.cobranca.create({ data: { matriculaId: outra.id, tipo: "MENSALIDADE", moeda: "USD", valorOriginal: 10, valorNegociado: 10, saldo: 10, vencimento: new Date("2099-10-01") } });
  const r = await registrarRecebimentoDestinado({ ...entrada("q87-contrato-estrangeiro-0001"), destinos: [{ tipo: "COBRANCA", cobrancaId: estrangeira.id, valor: 150, evidencia: "Tentativa adversarial de misturar contrato e moeda.", chaveIdempotencia: `cobranca:${estrangeira.id}` }] });
  expect(r).toMatchObject({ ok: false });
  expect(await prisma.recebimento.count()).toBe(0);
});

it("não aceita URL arbitrária quando o recebimento inteiro vira crédito", async () => {
  const r = await registrarRecebimentoDestinado({ ...entrada("q87-credito-url-0001"), comprovanteUrl: "/api/files/nao-autorizado", destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 150, evidencia: "Antecipação sem cobrança e com origem identificada.", chaveIdempotencia: "credito-sem-destino" }] });
  expect(r).toMatchObject({ ok: false });
  expect(await prisma.recebimento.count()).toBe(0);
});

it("aceita comprovante autorizado por matrícula em crédito puro e preserva um único fato no replay", async () => {
  const url = "/api/files/q87-credito-comprovante.pdf";
  const matricula = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  await prisma.registroUpload.create({ data: { url, nome: "q87-credito-comprovante.pdf", mime: "application/pdf", tamanho: 10, autorId: financeiroId, alunoId: matricula.alunoId, matriculaId, categoriaDocumento: "COMPROVANTE" } });
  const dados = { ...entrada("q87-credito-transferencia-0001"), forma: "TRANSFERENCIA" as const, comprovanteUrl: url, comprovanteNome: "q87-credito-comprovante.pdf", destinos: [{ tipo: "CREDITO_SEM_DESTINO" as const, valor: 150, evidencia: "Antecipação comprovada sem cobrança definida.", chaveIdempotencia: "credito-sem-destino" }] };
  const [a, b] = await Promise.all([registrarRecebimentoDestinado(dados), registrarRecebimentoDestinado(dados)]);
  expect(a.ok && b.ok).toBe(true);
  expect(await prisma.recebimento.count()).toBe(1);
  const recebimento = await prisma.recebimento.findFirstOrThrow({ where: { chaveIdempotencia: dados.chaveIdempotencia } });
  const eventos = await prisma.evento.findMany({ where: { tipo: "RecebimentoRegistrado", agregadoTipo: "Recebimento", agregadoId: recebimento.id } });
  expect(eventos).toHaveLength(1);
  expect(eventos[0].payload).toMatchObject({ recebimentoId: recebimento.id, titularMatriculaId: matriculaId, comprovanteUrl: url, comprovanteNome: "q87-credito-comprovante.pdf" });
  expect(await consultarHistoricoRecebimentos({ matriculaId })).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ id: recebimento.id, comprovante: { url, nome: "q87-credito-comprovante.pdf" }, evidenciaCaixaRegistrada: true })] } });
  expect(await podeLerArquivo({ id: financeiroId, papeis: [Papel.FINANCEIRO] }, ["q87-credito-comprovante.pdf"])).toBe(true);
  const historico = await consultarHistoricoRecebimentos({ matriculaId });
  expect(historico).toMatchObject({ ok: true, dado: { itens: [{
    matriculaId,
    comprovante: { url, nome: "q87-credito-comprovante.pdf" },
    destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: "150.00", evidencia: "Antecipação comprovada sem cobrança definida." }],
  }] } });
});

it("usa e reserva devolução do crédito antecipado sem criar outro recebimento", async () => {
  const criado = await registrarRecebimentoDestinado({ ...entrada("q87-credito-q68-q69-0001"), destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 150, evidencia: "Antecipação para uso ou devolução posterior.", chaveIdempotencia: "credito-sem-destino" }] });
  if (!criado.ok) throw new Error(criado.erro);
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { matriculaId } });
  const uso = await proporUtilizacaoCredito({ creditoId: credito.id, cobrancaId: c1, valor: "100.00", concordancia: "Titular autorizou o abatimento da primeira mensalidade.", motivo: "Aplicar antecipação disponível", chaveIdempotencia: "q87-uso-credito-0001" });
  if (!uso.ok || !uso.dado) throw new Error(uso.ok ? "Uso ausente" : uso.erro);
  const admin = (await criarUsuario([Papel.ADMINISTRADOR], "Aprovador Q87")).id; entrar(admin);
  expect((await decidirUtilizacaoCredito({ propostaId: uso.dado.id, aprovar: true, motivo: "Crédito e cobrança conferidos por outra pessoa" })).ok).toBe(true);
  entrar(financeiroId);
  const devolucao = await proporDevolucaoCredito({ creditoId: credito.id, valor: "50.00", pedidoAluno: "Titular solicitou devolução do saldo remanescente", evidenciaPedido: "Protocolo de devolução do crédito antecipado", destino: "Conta bancária do titular conferida", motivo: "Devolver antecipação não utilizada", chaveIdempotencia: "q87-devolucao-credito-0001" });
  if (!devolucao.ok || !devolucao.dado) throw new Error(devolucao.ok ? "Devolução ausente" : devolucao.erro);
  entrar(admin);
  expect((await decidirDevolucaoCredito({ propostaId: devolucao.dado.id, aprovar: true, motivo: "Saldo remanescente conferido" })).ok).toBe(true);
  expect(await prisma.recebimento.count()).toBe(1);
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c1 } })).valorLiquidadoCredito.toFixed(2)).toBe("100.00");
  expect((await prisma.reservaDevolucaoCredito.findFirstOrThrow()).valor.toFixed(2)).toBe("50.00");
});
