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

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import {
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
  pedagogico = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "PedagÃ³gico P02")).id;
  aprovador = (await criarUsuario([Papel.FINANCEIRO], "Aprovador P02")).id;
  await prisma.usuario.update({ where: { id: aprovador }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  const catalogo = await seedCatalogoMinimo();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Lia", sobrenome: "Permuta", paisId: catalogo.pais.id } });
  matricula = (await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC" } })).id;
  cobranca = (await prisma.cobranca.create({ data: { matriculaId: matricula, tipo: TipoCobranca.MENSALIDADE, moeda: "CRC", valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2099-09-01") } })).id;
});
afterEach(() => vi.restoreAllMocks());

it("registra acordo, comprovaÃ§Ã£o, proposta e decisÃ£o independente sem quitar a mensalidade", async () => {
  entrar(financeiro);
  const acordoEntrada = { matriculaId: matricula, vigenciaInicio: "2099-09-01", vigenciaFim: "2099-12-31", moeda: "CRC", unidade: "HORA" as const, quantidadePactuada: "2.00", valorPorUnidade: "50.00", contrapartida: "Aulas de reforÃ§o devidamente comprovadas", formulaDescricao: "2 horas de reforÃ§o Ã— CRC 50,00", cobrancas: [{ cobrancaId: cobranca, valorMaximo: "100.00" }], chaveIdempotencia: "p02-acordo-0001" };
  const acordo = await prepararAcordoPermuta(acordoEntrada);
  if (!acordo.ok || !acordo.dado) throw new Error("Opera��o falhou");
  expect(acordo).toMatchObject({ ok: true, dado: { repetido: false } });
  expect(await prepararAcordoPermuta(acordoEntrada)).toMatchObject({ ok: true, dado: { id: acordo.dado?.id, repetido: true } });

  entrar(pedagogico);
  const confirmacaoEntrada = { acordoId: acordo.dado!.id, periodoInicio: "2099-09-01", periodoFim: "2099-09-30", quantidadeComprovada: "2.00", referenciaServico: "REFORCO-2099-09", evidencia: "DiÃ¡rio pedagÃ³gico com horas ministradas", chaveIdempotencia: "p02-confirmacao-0001" };
  const confirmacao = await confirmarServicoPermuta(confirmacaoEntrada);
  if (!confirmacao.ok || !confirmacao.dado) throw new Error("Opera��o falhou");
  expect(confirmacao).toMatchObject({ ok: true, dado: { repetido: false } });
  expect(await confirmarServicoPermuta(confirmacaoEntrada)).toMatchObject({ ok: true, dado: { id: confirmacao.dado?.id, repetido: true } });

  entrar(financeiro);
  const propostaEntrada = { confirmacaoId: confirmacao.dado!.id, destinos: [{ cobrancaId: cobranca, valor: "100.00" }], chaveIdempotencia: "p02-proposta-0001" };
  const proposta = await proporCompensacaoPermuta(propostaEntrada);
  if (!proposta.ok || !proposta.dado) throw new Error("Opera��o falhou");
  expect(proposta).toMatchObject({ ok: true, dado: { efetivada: false, repetido: false } });
  expect(await proporCompensacaoPermuta(propostaEntrada)).toMatchObject({ ok: true, dado: { id: proposta.dado?.id, repetido: true, efetivada: false } });

  entrar(aprovador);
  const decisao = await decidirCompensacaoPermuta({ propostaId: proposta.dado!.id, aprovar: true, motivo: "ServiÃ§o, fÃ³rmula e destino conferidos por aprovador independente" });
  if (!decisao.ok || !decisao.dado) throw new Error("Opera��o falhou");
  expect(decisao).toMatchObject({ ok: true, dado: { efetivada: false, repetida: false } });
  expect(await decidirCompensacaoPermuta({ propostaId: proposta.dado!.id, aprovar: true, motivo: "ServiÃ§o, fÃ³rmula e destino conferidos por aprovador independente" })).toMatchObject({ ok: true, dado: { efetivada: false, repetida: true } });

  const atual = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca } });
  expect(atual.saldo?.toFixed(2)).toBe("100.00");
  expect(atual.valorLiquidadoCredito.toFixed(2)).toBe("0.00");
  expect(await prisma.recebimento.count()).toBe(0);
  entrar(pedagogico);
  const pedagogia = await consultarPermutas();
  if (!pedagogia.ok || !pedagogia.dado) throw new Error("Opera��o falhou");
  expect(pedagogia).toMatchObject({ ok: true, dado: [{ moeda: null, valorPorUnidade: null, valorTotalPactuado: null, formulaDescricao: null, cobrancas: [], confirmacoes: [{ propostas: [] }] }] });
  await prisma.usuario.update({ where: { id: pedagogico }, data: { papeis: [Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO] } });
  const acumulado = await consultarPermutas();
  if (!acumulado.ok || !acumulado.dado) throw new Error("Opera��o falhou");
  expect(acumulado.dado?.[0]?.confirmacoes[0]?.propostas).toHaveLength(1);
  entrar(financeiro);
  const consulta = await consultarPermutas();
  if (!consulta.ok || !consulta.dado) throw new Error("Opera��o falhou");
  expect(consulta).toMatchObject({ ok: true });
  if (!consulta.ok || !consulta.dado) throw new Error("Consulta de permuta ausente");
  expect(consulta.dado[0]?.id).toBe(acordo.dado!.id);
  expect(consulta.dado[0]?.confirmacoes[0]?.id).toBe(confirmacao.dado!.id);
  expect(consulta.dado[0]?.confirmacoes[0]?.propostas[0]).toMatchObject({ id: proposta.dado!.id, decisao: { aprovada: true } });
});

it("rejeita proponente como decisor e revalida a capacidade revogada antes do replay", async () => {
  entrar(financeiro);
  const acordo = await prepararAcordoPermuta({ matriculaId: matricula, vigenciaInicio: "2099-09-01", vigenciaFim: "2099-12-31", moeda: "CRC", unidade: "HORA", quantidadePactuada: "2", valorPorUnidade: "50", contrapartida: "Aulas de reforÃ§o devidamente comprovadas", formulaDescricao: "2 horas de reforÃ§o Ã— CRC 50,00", cobrancas: [{ cobrancaId: cobranca, valorMaximo: "100" }], chaveIdempotencia: "p02-acordo-0002" });
  if (!acordo.ok || !acordo.dado) throw new Error("Opera��o falhou");
  entrar(pedagogico);
  const confirmacao = await confirmarServicoPermuta({ acordoId: acordo.dado!.id, periodoInicio: "2099-09-01", periodoFim: "2099-09-30", quantidadeComprovada: "2", referenciaServico: "REFORCO-2099-10", evidencia: "DiÃ¡rio pedagÃ³gico com horas ministradas", chaveIdempotencia: "p02-confirmacao-0002" });
  if (!confirmacao.ok || !confirmacao.dado) throw new Error("Opera��o falhou");
  entrar(financeiro);
  const proposta = await proporCompensacaoPermuta({ confirmacaoId: confirmacao.dado!.id, destinos: [{ cobrancaId: cobranca, valor: "100" }], chaveIdempotencia: "p02-proposta-0002" });
  if (!proposta.ok || !proposta.dado) throw new Error("Opera��o falhou");
  expect(await decidirCompensacaoPermuta({ propostaId: proposta.dado!.id, aprovar: true, motivo: "Tentativa de autoaprovaÃ§Ã£o deve falhar" })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: pedagogico }, data: { papeis: [] } });
  entrar(pedagogico);
  expect(await confirmarServicoPermuta({ acordoId: acordo.dado!.id, periodoInicio: "2099-10-01", periodoFim: "2099-10-31", quantidadeComprovada: "1", referenciaServico: "REFORCO-2099-11", evidencia: "DiÃ¡rio posterior de serviÃ§o prestado", chaveIdempotencia: "p02-confirmacao-revogada" })).toMatchObject({ ok: false });
});

