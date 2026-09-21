import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = await sessao(); original.exigirPapel(u, ...papeis); return u;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { salvarConfiguracaoOperacional } from "./acoes";
import { salvarPrazosEntregaReposicao, salvarPrazosPortalAluno } from "@/server/portal-aluno/configuracao";

let adm: Awaited<ReturnType<typeof criarUsuario>>;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const configuracao = () => prisma.configuracaoOperacional.findUnique({ where: { id: "escola" } });

beforeEach(async () => {
  await truncarBanco();
  adm = await criarUsuario([Papel.ADMINISTRADOR]);
  entrar(adm.id);
});

describe("configuração operacional: defaults, permissão e auditoria", () => {
  it("configura os dois prazos da entrega com auditoria e recusa valores inválidos ou Secretaria", async () => {
    const prazos = { prazoPrimeiraEntregaReposicaoMinutos: 180, prazoRespostaCorrecaoReposicaoMinutos: 90 };
    expect((await salvarPrazosEntregaReposicao(prazos)).ok).toBe(true);
    expect(await configuracao()).toMatchObject(prazos);
    expect((await eventosDo("ConfiguracaoOperacional", "escola")).some(e => e.tipo === "PrazosEntregaReposicaoConfigurados")).toBe(true);
    expect((await salvarPrazosEntregaReposicao({ ...prazos, prazoPrimeiraEntregaReposicaoMinutos: 0 })).ok).toBe(false);
    expect((await salvarPrazosEntregaReposicao({ ...prazos, prazoRespostaCorrecaoReposicaoMinutos: 525601 })).ok).toBe(false);
    expect(await configuracao()).toMatchObject(prazos);
    entrar((await criarUsuario([Papel.SECRETARIA_ACADEMICA])).id);
    expect((await salvarPrazosEntregaReposicao({ ...prazos, prazoRespostaCorrecaoReposicaoMinutos: 120 })).ok).toBe(false);
    expect(await configuracao()).toMatchObject(prazos);
  });

  it("configura todos os prazos do portal sem alterar opções existentes e exige Administração", async () => {
    await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 72 });
    const prazos = { prazoSessaoPortalAlunoMinutos: 60, prazoConvitePortalAlunoMinutos: 120,
      prazoRecuperacaoPortalAlunoMinutos: 30, prazoValidacaoEmailPortalAlunoMinutos: 45 };
    expect((await salvarPrazosPortalAluno(prazos)).ok).toBe(true);
    expect(await configuracao()).toMatchObject({ ...prazos, exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 72 });
    expect((await eventosDo("ConfiguracaoOperacional", "escola")).some(e => e.tipo === "PrazosPortalAlunoConfigurados")).toBe(true);
    expect((await salvarPrazosPortalAluno({ ...prazos, prazoConvitePortalAlunoMinutos: 0 })).ok).toBe(false);
    expect((await salvarPrazosPortalAluno({ ...prazos, prazoSessaoPortalAlunoMinutos: 525601 })).ok).toBe(false);
    expect(await configuracao()).toMatchObject(prazos);
    entrar((await criarUsuario([Papel.SECRETARIA_ACADEMICA])).id);
    expect((await salvarPrazosPortalAluno({ ...prazos, prazoSessaoPortalAlunoMinutos: 90 })).ok).toBe(false);
    expect(await configuracao()).toMatchObject(prazos);
  });
  it("configura fuso sem inferência e preserva ao editar outras opções", async () => {
    const dados = { exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 48 };
    expect((await salvarConfiguracaoOperacional({ ...dados, fusoInstitucional: "America/Costa_Rica" })).ok).toBe(true);
    expect((await configuracao())?.fusoInstitucional).toBe("America/Costa_Rica");
    expect((await salvarConfiguracaoOperacional(dados)).ok).toBe(true);
    expect((await configuracao())?.fusoInstitucional).toBe("America/Costa_Rica");
    expect((await salvarConfiguracaoOperacional({ ...dados, fusoInstitucional: "Fuso/Invalido" })).ok).toBe(false);
    expect((await configuracao())?.fusoInstitucional).toBe("America/Costa_Rica");
  });
  it("prazo de reserva não tem padrão, aceita configuração e preserva quando omitido", async () => {
    const dados = { exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 48 };
    await salvarConfiguracaoOperacional(dados);
    expect((await configuracao())?.prazoReservaMinutos).toBeNull();
    for (const prazoReservaMinutos of [0, -1, 1.5, 2147483648]) expect((await salvarConfiguracaoOperacional({ ...dados, prazoReservaMinutos })).ok).toBe(false);
    expect((await salvarConfiguracaoOperacional({ ...dados, prazoReservaMinutos: 120 })).ok).toBe(true);
    await salvarConfiguracaoOperacional(dados);
    expect((await configuracao())?.prazoReservaMinutos).toBe(120);
    await expect(prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { prazoReservaMinutos: 0 } })).rejects.toThrow();
    expect((await salvarConfiguracaoOperacional({ ...dados, prazoReservaMinutos: null })).ok).toBe(true);
    expect((await configuracao())?.prazoReservaMinutos).toBeNull();
  });

  it("banco assume 48h e primeira mensalidade opcional quando a configuração nasce sem valores", async () => {
    const inicial = await prisma.configuracaoOperacional.create({ data: {} });
    expect(inicial.id).toBe("escola");
    expect(inicial.prazoConferenciaHoras).toBe(48);
    expect(inicial.exigirPrimeiraMensalidade).toBe(false);
  });

  it("administrador altera as duas opções e audita os valores anteriores, novos e o autor", async () => {
    expect((await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 72 })).ok).toBe(true);
    const primeiro = await configuracao();
    expect(primeiro).toMatchObject({ exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 72, alteradaPorId: adm.id });
    const direcao = await criarUsuario([Papel.ADMINISTRADOR]); entrar(direcao.id);
    expect((await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 24 })).ok).toBe(true);
    expect(await configuracao()).toMatchObject({ exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 24, alteradaPorId: direcao.id });
    const eventos = await eventosDo("ConfiguracaoOperacional", "escola");
    expect(eventos).toHaveLength(2);
    expect(eventos[0]).toMatchObject({ tipo: "ConfiguracaoOperacionalAlterada", autorId: adm.id, payload: {
      de: { exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 48 }, para: { exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 72 },
    } });
    expect(eventos[1]).toMatchObject({ autorId: direcao.id, payload: {
      de: { exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 72 }, para: { exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 24 },
    } });
  });

  it.each([Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_COMERCIAL, Papel.GERENTE_PEDAGOGICO, Papel.VENDEDOR, Papel.PROFESSOR])("%s não administra configuração por chamada direta", async (papel) => {
    const u = await criarUsuario([papel]); entrar(u.id);
    expect((await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 720 })).ok).toBe(false);
    expect(await configuracao()).toBeNull();
    expect(await eventosDo("ConfiguracaoOperacional", "escola")).toHaveLength(0);
  });

  it("revogar papel ou desativar depois do login impede mudança e não grava auditoria de sucesso", async () => {
    await prisma.usuario.update({ where: { id: adm.id }, data: { papeis: [Papel.FINANCEIRO] } });
    expect((await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 72 })).ok).toBe(false);
    await prisma.usuario.update({ where: { id: adm.id }, data: { papeis: [Papel.ADMINISTRADOR], ativo: false } });
    expect((await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 72 })).ok).toBe(false);
    expect(await configuracao()).toBeNull();
    expect(await eventosDo("ConfiguracaoOperacional", "escola")).toHaveLength(0);
  });

  it("aceita somente booleano e prazo inteiro de 1 a 720 horas", async () => {
    type Input = Parameters<typeof salvarConfiguracaoOperacional>[0];
    for (const prazoConferenciaHoras of [0, -1, 721, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect((await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: false, prazoConferenciaHoras })).ok).toBe(false);
    }
    for (const exigirPrimeiraMensalidade of ["true", "false", 1, null, undefined]) {
      expect((await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade, prazoConferenciaHoras: 48 } as unknown as Input)).ok).toBe(false);
    }
    expect(await configuracao()).toBeNull(); expect(await eventosDo("ConfiguracaoOperacional", "escola")).toHaveLength(0);
    for (const prazoConferenciaHoras of [1, 720]) {
      expect((await salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: false, prazoConferenciaHoras })).ok).toBe(true);
      expect((await configuracao())?.prazoConferenciaHoras).toBe(prazoConferenciaHoras);
    }
  });

  it("alterações simultâneas criam um singleton e preservam a cadeia anterior→novo na auditoria", async () => {
    const resultados = await Promise.all([
      salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: true, prazoConferenciaHoras: 24 }),
      salvarConfiguracaoOperacional({ exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 72 }),
    ]);
    expect(resultados.every((r) => r.ok)).toBe(true);
    expect(await prisma.configuracaoOperacional.count()).toBe(1);
    const eventos = await eventosDo("ConfiguracaoOperacional", "escola");
    expect(eventos).toHaveLength(2);
    // O timestamp SQL pode representar o início da transação que aguardou o lock;
    // verificamos a cadeia pelos valores auditados, sem presumir ordem dos workers.
    const payloads = eventos.map((e) => e.payload as { de: { prazoConferenciaHoras: number }; para: unknown });
    const primeiro = payloads.find((p) => p.de.prazoConferenciaHoras === 48)!;
    const segundo = payloads.find((p) => p !== primeiro)!;
    expect(primeiro.de).toEqual({ exigirPrimeiraMensalidade: false, prazoConferenciaHoras: 48, fusoInstitucional: null, prazoReservaMinutos: null });
    expect(segundo.de).toEqual(primeiro.para);
    expect(await configuracao()).toMatchObject(segundo.para as object);
  });
});

