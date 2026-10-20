import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Cobranca } from "@prisma/client";

// Ref. #247: o vencimento é um dia civil. A mensalidade só entra em atraso quando o dia civil da ESCOLA passa
// do dia do vencimento, e a data digitada vira o meio-dia da escola. Relógio fixo (`vi.setSystemTime`, só o
// Date); verde com TZ=UTC e TZ=America/Sao_Paulo. Escola em America/Sao_Paulo (−03).

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import type { Resultado } from "@/server/_shared";
import { pausarAluno } from "@/server/alunos/acoes";
import { listarAlunos } from "@/server/alunos/consultas";
import { ajustarCobranca } from "@/server/ajustes/acoes";
import { decidirRetomada, solicitarRetomada } from "@/server/retomada/acoes";

const VENCIMENTO_MEIO_DIA = new Date("2026-06-23T15:00:00.000Z"); // 23/06, meio-dia de Brasília
const VENCIMENTO_LEGADO = new Date("2026-06-23T00:00:00.000Z"); // 23/06, meia-noite UTC (legado)
const ANTES = new Date("2026-06-20T15:00:00.000Z"); // 20/06, meio-dia de Brasília
const NO_DIA_2130 = new Date("2026-06-24T00:30:00.000Z"); // 23/06, 21h30 de Brasília (já 24/06 em UTC)
const SEGUINTE_0030 = new Date("2026-06-24T03:30:00.000Z"); // 24/06, 00h30 de Brasília
const VESPERA_2130 = new Date("2026-06-23T00:30:00.000Z"); // 22/06, 21h30 de Brasília

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
let sec: Usuario;
let fin: Usuario;
let alunoId: string;
let matriculaId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

function sucesso<T>(resultado: Resultado<T>) {
  expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
  if (!resultado.ok) throw new Error(resultado.erro);
  return resultado.dado!;
}

function mensalidade(vencimento: Date, extra: Partial<Pick<Cobranca, "id">> = {}) {
  return prisma.cobranca.create({ data: {
    ...extra, matriculaId, tipo: "MENSALIDADE", status: "PENDENTE", moeda: "CRC", competencia: "2026-06", vencimento,
    valorOriginal: 100, valorNegociado: 100, valorRecebido: 0, saldo: 100,
  } });
}

beforeEach(async () => {
  vi.useRealTimers();
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
  sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  fin = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  await prisma.usuario.update({ where: { id: fin.id }, data: { limiteDescontoMensalidadePct: 100 } });
  const catalogo = await seedCatalogoMinimo();
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Pessoa", sobrenome: "Atraso", paisId: catalogo.pais.id, status: "ATIVO" } })).id;
  matriculaId = (await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", mesesPlano: 6,
  } })).id;
});

afterEach(() => vi.useRealTimers());

describe("lista de alunos: atrasado só depois do dia do vencimento na escola", () => {
  const atrasado = async (agora: Date) => {
    vi.setSystemTime(agora);
    const [linha] = await listarAlunos({ id: fin.id, nome: "Financeiro", papeis: [Papel.FINANCEIRO] });
    return linha.financeiro;
  };

  it("às 21h30 de Brasília do dia do vencimento não está atrasado; à 00h30 do dia seguinte está", async () => {
    await mensalidade(VENCIMENTO_MEIO_DIA);
    expect(await atrasado(NO_DIA_2130)).toMatchObject({ atrasado: false, proximoVencimento: VENCIMENTO_MEIO_DIA });
    expect(await atrasado(SEGUINTE_0030)).toMatchObject({ atrasado: true, proximoVencimento: null });
  });

  it("vencimento legado à meia-noite UTC: às 21h30 da véspera em Brasília ainda não venceu", async () => {
    await mensalidade(VENCIMENTO_LEGADO);
    expect((await atrasado(VESPERA_2130))!.atrasado).toBe(false);
    expect((await atrasado(NO_DIA_2130))!.atrasado).toBe(false);
    expect((await atrasado(SEGUINTE_0030))!.atrasado).toBe(true);
  });
});

describe("pausa: cancela a mensalidade ainda não atrasada e preserva a atrasada", () => {
  const pausar = async (agora: Date) => {
    vi.setSystemTime(agora);
    entrar(sec.id);
    sucesso(await pausarAluno(alunoId, { motivo: "Pausa a pedido do aluno" }));
  };

  it("às 21h30 de Brasília do dia do vencimento a mensalidade ainda não venceu e é cancelada pela pausa", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    await pausar(NO_DIA_2130);
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "CANCELADA", canceladaPorPausaId: expect.any(String) });
  });

  it("à 00h30 de Brasília do dia seguinte a mensalidade está atrasada e a pausa a preserva", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    await pausar(SEGUINTE_0030);
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "PENDENTE", canceladaPorPausaId: null });
  });
});

describe("ajuste de cobrança: status e data digitada no dia da escola", () => {
  const ajustar = async (agora: Date, cobrancaId: string, novoVencimento?: string) => {
    vi.setSystemTime(agora);
    entrar(fin.id);
    sucesso(await ajustarCobranca({ cobrancaId, tipo: "DESCONTO", valorPara: 90, motivo: "Desconto conferido", ...(novoVencimento ? { novoVencimento } : {}) }));
    return prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId } });
  };

  it("às 21h30 de Brasília do dia do vencimento continua PENDENTE", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    expect((await ajustar(NO_DIA_2130, c.id)).status).toBe("PENDENTE");
  });

  it("à 00h30 de Brasília do dia seguinte fica ATRASADO", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    expect((await ajustar(SEGUINTE_0030, c.id)).status).toBe("ATRASADO");
  });

  it("novo vencimento digitado vira o meio-dia da escola, não o do servidor", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    expect((await ajustar(ANTES, c.id, "2026-07-10")).vencimento).toEqual(new Date("2026-07-10T15:00:00.000Z"));
  });

  it("novo vencimento digitado para hoje, às 21h30 de Brasília, não nasce atrasado", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    const depois = await ajustar(NO_DIA_2130, c.id, "2026-06-23");
    expect(depois.vencimento).toEqual(VENCIMENTO_MEIO_DIA);
    expect(depois.status).toBe("PENDENTE");
  });
});

describe("retomada: status restaurado e datas digitadas no dia da escola", () => {
  async function pausarEPropor(input: Parameters<typeof solicitarRetomada>[1] = { opcao: "MANTER_VENCIMENTOS", motivo: "Retorno acordado com o aluno" }) {
    vi.setSystemTime(ANTES);
    entrar(sec.id);
    sucesso(await pausarAluno(alunoId, { motivo: "Pausa a pedido do aluno" }));
    return sucesso(await solicitarRetomada(alunoId, input)).propostaId;
  }
  const aprovar = async (agora: Date, propostaId: string) => {
    vi.setSystemTime(agora);
    entrar(fin.id);
    sucesso(await decidirRetomada(propostaId, { aprovar: true, motivo: "Calendário conferido" }));
  };

  it("MANTER aprovado às 21h30 de Brasília do dia do vencimento restaura PENDENTE", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    await aprovar(NO_DIA_2130, await pausarEPropor());
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PENDENTE");
  });

  it("MANTER aprovado à 00h30 de Brasília do dia seguinte restaura ATRASADO", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    await aprovar(SEGUINTE_0030, await pausarEPropor());
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("ATRASADO");
  });

  it("MANTER com vencimento legado à meia-noite UTC, aprovado às 21h30 da véspera, restaura PENDENTE", async () => {
    const c = await mensalidade(VENCIMENTO_LEGADO);
    await aprovar(VESPERA_2130, await pausarEPropor());
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PENDENTE");
  });

  it("REPROGRAMAR grava a data digitada ao meio-dia da escola e o replay reconhece a mesma proposta", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    const input = { opcao: "REPROGRAMAR_PARCELAS" as const, motivo: "Retorno acordado com o aluno", novosVencimentos: [{ cobrancaId: c.id, vencimento: "2026-07-10" }] };
    const propostaId = await pausarEPropor(input);
    expect(sucesso(await solicitarRetomada(alunoId, input)).propostaId).toBe(propostaId);
    await aprovar(ANTES, propostaId);
    expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).vencimento).toEqual(new Date("2026-07-10T15:00:00.000Z"));
  });

  it("proposta antiga, gravada ao meio-dia do servidor em UTC, continua reconhecida no replay e não é retroativa", async () => {
    const c = await mensalidade(VENCIMENTO_MEIO_DIA);
    const input = { opcao: "REPROGRAMAR_PARCELAS" as const, motivo: "Retorno acordado com o aluno", novosVencimentos: [{ cobrancaId: c.id, vencimento: "2026-06-23" }] };
    const propostaId = await pausarEPropor(input);
    // Dado anterior a esta correção: meio-dia do relógio do servidor (UTC em produção).
    const proposta = await prisma.propostaRetomada.findUniqueOrThrow({ where: { id: propostaId } });
    const snapshot = proposta.snapshot as { alvos: { cobrancaId: string; novoVencimento: string }[] };
    await prisma.propostaRetomada.update({ where: { id: propostaId }, data: { snapshot: { ...snapshot, alvos: [{ cobrancaId: c.id, novoVencimento: "2026-06-23T12:00:00.000Z" }] } } });
    vi.setSystemTime(ANTES);
    entrar(sec.id);
    expect(sucesso(await solicitarRetomada(alunoId, input)).propostaId).toBe(propostaId);
    await aprovar(NO_DIA_2130, propostaId);
    expect(await prisma.cobranca.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "PENDENTE", vencimento: new Date("2026-06-23T12:00:00.000Z") });
  });
});
