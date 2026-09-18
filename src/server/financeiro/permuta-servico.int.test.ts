import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel, TipoCobranca } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async importOriginal => {
  const original = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return {
    ...original,
    exigirSessao: sessao,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const usuario = await sessao();
      original.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { receberTx } from "./recebimentos";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import {
  listarCobrancasParaPermuta,
  confirmarServicoPermuta,
  consultarPermutas,
  decidirCompensacaoPermuta,
  prepararAcordoPermuta,
  proporCompensacaoPermuta,
} from "./permuta-servico";

let financeiro = "", pedagogico = "", aprovador = "", matricula = "", cobranca = "";
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  await truncarBanco();
  financeiro = (await criarUsuario([Papel.FINANCEIRO], "Financeiro P02")).id;
  pedagogico = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Pedagógico P02")).id;
  aprovador = (await criarUsuario([Papel.FINANCEIRO], "Aprovador P02")).id;
  await prisma.usuario.update({ where: { id: aprovador }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  const catalogo = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Lia", sobrenome: "Permuta", paisId: catalogo.pais.id } });
  matricula = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC" } })).id;
  cobranca = (await prisma.cobranca.create({ data: { matriculaId: matricula, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2099-09-01") } })).id;
});
afterEach(() => vi.restoreAllMocks());

it("registra acordo, comprovação, proposta e decisão independente com compensação sem criar recebimento", async () => {
  entrar(financeiro);
  const acordoEntrada = { matriculaId: matricula, vigenciaInicio: "2099-09-01", vigenciaFim: "2099-12-31", moeda: "CRC", unidade: "HORA" as const, quantidadePactuada: "2.00", valorPorUnidade: "50.00", contrapartida: "Aulas de reforço devidamente comprovadas", formulaDescricao: "2 horas de reforço × CRC 50,00", cobrancas: [{ cobrancaId: cobranca, valorMaximo: "100.00" }], chaveIdempotencia: "p02-acordo-0001" };
  const acordo = await prepararAcordoPermuta(acordoEntrada);
  if (!acordo.ok || !acordo.dado) throw new Error("Operação falhou");
  expect(acordo).toMatchObject({ ok: true, dado: { repetido: false } });
  expect(await prepararAcordoPermuta(acordoEntrada)).toMatchObject({ ok: true, dado: { id: acordo.dado?.id, repetido: true } });

  entrar(pedagogico);
  const confirmacaoEntrada = { acordoId: acordo.dado!.id, periodoInicio: "2099-09-01", periodoFim: "2099-09-30", quantidadeComprovada: "2.00", referenciaServico: "REFORCO-2099-09", evidencia: "Diário pedagógico com horas ministradas", chaveIdempotencia: "p02-confirmacao-0001" };
  const confirmacao = await confirmarServicoPermuta(confirmacaoEntrada);
  if (!confirmacao.ok || !confirmacao.dado) throw new Error("Operação falhou");
  expect(confirmacao).toMatchObject({ ok: true, dado: { repetido: false } });
  expect(await confirmarServicoPermuta(confirmacaoEntrada)).toMatchObject({ ok: true, dado: { id: confirmacao.dado?.id, repetido: true } });

  entrar(financeiro);
  await prisma.cobranca.update({ where: { id: cobranca }, data: { valorNegociado: 50, saldo: 50 } });
  const acimaDoSaldo = await proporCompensacaoPermuta({ confirmacaoId: confirmacao.dado.id, destinos: [{ cobrancaId: cobranca, valor: "100.00" }], chaveIdempotencia: "p02-acima-saldo" });
  expect(acimaDoSaldo).toMatchObject({ ok: false });
  expect(await prisma.propostaCompensacaoPermuta.count()).toBe(0);
  await prisma.cobranca.update({ where: { id: cobranca }, data: { valorNegociado: 100, saldo: 100 } });
  const propostaEntrada = { confirmacaoId: confirmacao.dado!.id, destinos: [{ cobrancaId: cobranca, valor: "100.00" }], chaveIdempotencia: "p02-proposta-0001" };
  const proposta = await proporCompensacaoPermuta(propostaEntrada);
  if (!proposta.ok || !proposta.dado) throw new Error("Operação falhou");
  expect(proposta).toMatchObject({ ok: true, dado: { efetivada: false, repetido: false } });
  expect(await proporCompensacaoPermuta(propostaEntrada)).toMatchObject({ ok: true, dado: { id: proposta.dado?.id, repetido: true, efetivada: false } });

  const persistida = await prisma.propostaCompensacaoPermuta.findUniqueOrThrow({ where: { id: proposta.dado.id } });
  expect(persistida.snapshot).toMatchObject({ destinos: [{ cobrancaId: cobranca, versao: expect.any(Number), saldo: "100.00", valor: "100.00" }] });
  entrar(aprovador);
  await prisma.cobranca.update({ where: { id: cobranca }, data: { valorNegociado: 90, saldo: 90 } });
  expect(await decidirCompensacaoPermuta({ propostaId: proposta.dado.id, aprovar: true, motivo: "Tentativa com saldo alterado" })).toMatchObject({ ok: false });
  expect(await prisma.decisaoCompensacaoPermuta.count()).toBe(0);
  await prisma.cobranca.update({ where: { id: cobranca }, data: { valorNegociado: 100, saldo: 100 } });
  const decisao = await decidirCompensacaoPermuta({ propostaId: proposta.dado!.id, aprovar: true, motivo: "Serviço, fórmula e destino conferidos por aprovador independente" });
  if (!decisao.ok || !decisao.dado) throw new Error("Operação falhou");
  expect(decisao).toMatchObject({ ok: true, dado: { efetivada: true, repetida: false } });
  expect(await decidirCompensacaoPermuta({ propostaId: proposta.dado!.id, aprovar: true, motivo: "Serviço, fórmula e destino conferidos por aprovador independente" })).toMatchObject({ ok: true, dado: { efetivada: true, repetida: true } });

  const atual = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca } });
  expect(atual.saldo?.toFixed(2)).toBe("0.00");
  expect(atual.valorCompensadoPermuta.toFixed(2)).toBe("100.00");
  expect(await prisma.aplicacaoCompensacaoPermuta.count()).toBe(1);
  expect(atual.valorLiquidadoCredito.toFixed(2)).toBe("0.00");
  expect(await prisma.recebimento.count()).toBe(0);
  entrar(pedagogico);
  const pedagogia = await consultarPermutas();
  if (!pedagogia.ok || !pedagogia.dado) throw new Error("Operação falhou");
  expect(pedagogia).toMatchObject({ ok: true, dado: [{ moeda: null, valorPorUnidade: null, valorTotalPactuado: null, formulaDescricao: null, cobrancas: [], confirmacoes: [{ propostas: [] }] }] });
  await prisma.usuario.update({ where: { id: pedagogico }, data: { papeis: [Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO] } });
  const acumulado = await consultarPermutas();
  if (!acumulado.ok || !acumulado.dado) throw new Error("Operação falhou");
  expect(acumulado.dado?.[0]?.confirmacoes[0]?.propostas).toHaveLength(1);
  entrar(financeiro);
  const consulta = await consultarPermutas();
  if (!consulta.ok || !consulta.dado) throw new Error("Operação falhou");
  expect(consulta).toMatchObject({ ok: true });
  if (!consulta.ok || !consulta.dado) throw new Error("Consulta de permuta ausente");
  expect(consulta.dado[0]?.id).toBe(acordo.dado!.id);
  expect(consulta.dado[0]?.confirmacoes[0]?.id).toBe(confirmacao.dado!.id);
  expect(consulta.dado[0]?.confirmacoes[0]?.propostas[0]).toMatchObject({ id: proposta.dado!.id, decisao: { aprovada: true } });
});

it("rejeita proponente como decisor e revalida a capacidade revogada antes do replay", async () => {
  entrar(financeiro);
  const acordo = await prepararAcordoPermuta({ matriculaId: matricula, vigenciaInicio: "2099-09-01", vigenciaFim: "2099-12-31", moeda: "CRC", unidade: "HORA", quantidadePactuada: "2", valorPorUnidade: "50", contrapartida: "Aulas de reforço devidamente comprovadas", formulaDescricao: "2 horas de reforço × CRC 50,00", cobrancas: [{ cobrancaId: cobranca, valorMaximo: "100" }], chaveIdempotencia: "p02-acordo-0002" });
  if (!acordo.ok || !acordo.dado) throw new Error("Operação falhou");
  entrar(pedagogico);
  const confirmacao = await confirmarServicoPermuta({ acordoId: acordo.dado!.id, periodoInicio: "2099-09-01", periodoFim: "2099-09-30", quantidadeComprovada: "2", referenciaServico: "REFORCO-2099-10", evidencia: "Diário pedagógico com horas ministradas", chaveIdempotencia: "p02-confirmacao-0002" });
  if (!confirmacao.ok || !confirmacao.dado) throw new Error("Operação falhou");
  entrar(financeiro);
  const proposta = await proporCompensacaoPermuta({ confirmacaoId: confirmacao.dado!.id, destinos: [{ cobrancaId: cobranca, valor: "100" }], chaveIdempotencia: "p02-proposta-0002" });
  if (!proposta.ok || !proposta.dado) throw new Error("Operação falhou");
  expect(await decidirCompensacaoPermuta({ propostaId: proposta.dado!.id, aprovar: true, motivo: "Tentativa de autoaprovação deve falhar" })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: pedagogico }, data: { papeis: [] } });
  entrar(pedagogico);
  expect(await confirmarServicoPermuta({ acordoId: acordo.dado!.id, periodoInicio: "2099-10-01", periodoFim: "2099-10-31", quantidadeComprovada: "1", referenciaServico: "REFORCO-2099-11", evidencia: "Diário posterior de serviço prestado", chaveIdempotencia: "p02-confirmacao-revogada" })).toMatchObject({ ok: false });
});


it("lista apenas mensalidades disponíveis e bloqueia consulta pedagógica financeira", async () => {
  await prisma.cobranca.create({ data: { matriculaId: matricula, tipo: TipoCobranca.MATRICULA, moeda: "CRC", valorOriginal: 70, valorNegociado: 70, saldo: 70, vencimento: new Date("2099-09-01") } });
  entrar(financeiro);
  const resultado = await listarCobrancasParaPermuta();
  expect(resultado).toMatchObject({ ok: true, dado: [{ id: cobranca, matriculaId: matricula, moeda: "CRC", saldo: "100.00" }] });
  if (!resultado.ok) throw new Error("Consulta indisponível");
  expect(resultado.dado).toHaveLength(1);
  entrar(pedagogico);
  expect(await listarCobrancasParaPermuta()).toMatchObject({ ok: false });
});

it("compensa serviço parcial e recebe apenas o saldo restante sem criar crédito fictício", async () => {
  entrar(financeiro);
  const acordo = await prepararAcordoPermuta({ matriculaId: matricula, vigenciaInicio: "2099-09-01", vigenciaFim: "2099-12-31", moeda: "CRC", unidade: "HORA", quantidadePactuada: "2", valorPorUnidade: "50", contrapartida: "Aulas prestadas à escola", formulaDescricao: "Horas comprovadas multiplicadas por cinquenta", cobrancas: [{ cobrancaId: cobranca, valorMaximo: "100" }], chaveIdempotencia: "parcial-acordo" });
  if (!acordo.ok || !acordo.dado) throw new Error("Acordo ausente");
  entrar(pedagogico);
  const confirmacao = await confirmarServicoPermuta({ acordoId: acordo.dado.id, periodoInicio: "2099-09-01", periodoFim: "2099-09-30", quantidadeComprovada: "1", referenciaServico: "PARCIAL-1", evidencia: "Uma hora comprovada no diário", chaveIdempotencia: "parcial-servico" });
  if (!confirmacao.ok || !confirmacao.dado) throw new Error("Confirmação ausente");
  entrar(financeiro);
  const proposta = await proporCompensacaoPermuta({ confirmacaoId: confirmacao.dado.id, destinos: [{ cobrancaId: cobranca, valor: "50" }], chaveIdempotencia: "parcial-proposta" });
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta ausente");
  entrar(aprovador);
  expect(await decidirCompensacaoPermuta({ propostaId: proposta.dado.id, aprovar: true, motivo: "Serviço parcial conferido" })).toMatchObject({ ok: true, dado: { efetivada: true } });
  const parcial = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca } });
  expect(parcial.saldo?.toFixed(2)).toBe("50.00");
  expect(parcial.valorRecebido).toBeNull();
  expect(await prisma.recebimento.count()).toBe(0);
  const receber = () => prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca, chaveIdempotencia: "caixa-apos-permuta", autorId: financeiro, valorRecebido: 50, forma: "TRANSFERENCIA", dataPagamento: new Date("2026-09-18T12:00:00Z"), evidencia: "Recebimento do saldo remanescente" }));
  await receber(); await receber();
  const final = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca } });
  expect(final.saldo?.toFixed(2)).toBe("0.00");
  expect(final.valorRecebido?.toFixed(2)).toBe("50.00");
  expect(final.valorCompensadoPermuta.toFixed(2)).toBe("50.00");
  expect(final.valorLiquidadoCredito.toFixed(2)).toBe("0.00");
  expect(await prisma.recebimento.count()).toBe(1);
  expect(await prisma.creditoMatricula.count()).toBe(0);
  const aplicacao = await prisma.aplicacaoCompensacaoPermuta.findFirstOrThrow();
  await expect(prisma.aplicacaoCompensacaoPermuta.delete({ where: { id: aplicacao.id } })).rejects.toThrow();
});
