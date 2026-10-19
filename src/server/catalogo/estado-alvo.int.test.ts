import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, TipoCobranca } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { definirIdiomaAtivo, definirPrecoAtivo } from "./acoes";

// B4 (#175 C2): os alternadores de idioma e preço recebem o estado-alvo. Dois operadores com a mesma tela velha
// não desfazem um ao outro: quem confirma o estado em que o registro já está não muda nada nem grava evento.

beforeEach(async () => { await truncarBanco(); });

const eventos = (agregadoId: string) => prisma.evento.findMany({ where: { agregadoId }, orderBy: { criadoEm: "asc" } });

describe("definirIdiomaAtivo — estado-alvo explícito", () => {
  it("dois operadores ativam com a tela velha: o segundo não desativa nem grava evento", async () => {
    const [a, b] = [await criarUsuario([Papel.GERENTE_PEDAGOGICO], "A"), await criarUsuario([Papel.GERENTE_PEDAGOGICO], "B")];
    const idioma = await prisma.idioma.create({ data: { nome: "Francês", ativo: false } });

    authMock.mockResolvedValue({ user: { id: a.id } });
    expect((await definirIdiomaAtivo(idioma.id, true)).ok).toBe(true);
    authMock.mockResolvedValue({ user: { id: b.id } });
    expect((await definirIdiomaAtivo(idioma.id, true)).ok).toBe(true);

    expect((await prisma.idioma.findUniqueOrThrow({ where: { id: idioma.id } })).ativo).toBe(true);
    const evs = await eventos(idioma.id);
    expect(evs.map((e) => [e.tipo, e.autorId])).toEqual([["IdiomaAtivado", a.id]]);
  });

  it("desativar já desativado é no-op; desativar o ativo grava o evento", async () => {
    const gp = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
    authMock.mockResolvedValue({ user: { id: gp.id } });
    const idioma = await prisma.idioma.create({ data: { nome: "Alemão" } });
    expect((await definirIdiomaAtivo(idioma.id, false)).ok).toBe(true);
    expect((await definirIdiomaAtivo(idioma.id, false)).ok).toBe(true);
    expect((await prisma.idioma.findUniqueOrThrow({ where: { id: idioma.id } })).ativo).toBe(false);
    const evs = await eventos(idioma.id);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ tipo: "IdiomaDesativado", payload: { de: true, para: false } });
  });

  it("estado-alvo ausente ou não booleano é recusado sem gravar", async () => {
    const gp = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
    authMock.mockResolvedValue({ user: { id: gp.id } });
    const idioma = await prisma.idioma.create({ data: { nome: "Italiano" } });
    const r = await definirIdiomaAtivo(idioma.id, undefined as unknown as boolean);
    expect(r.ok).toBe(false);
    expect((await prisma.idioma.findUniqueOrThrow({ where: { id: idioma.id } })).ativo).toBe(true);
    expect(await eventos(idioma.id)).toHaveLength(0);
  });
});

describe("definirPrecoAtivo — estado-alvo explícito", () => {
  it("dois operadores reativam o mesmo preço com a tela velha: o segundo não desativa nem grava evento", async () => {
    const { precoMensalidade } = await seedCatalogoMinimo();
    const [a, b] = [await criarUsuario([Papel.ADMINISTRADOR], "A"), await criarUsuario([Papel.ADMINISTRADOR], "B")];
    await prisma.precoReferencia.update({ where: { id: precoMensalidade.id }, data: { ativo: false } });

    authMock.mockResolvedValue({ user: { id: a.id } });
    expect((await definirPrecoAtivo(precoMensalidade.id, true)).ok).toBe(true);
    authMock.mockResolvedValue({ user: { id: b.id } });
    expect((await definirPrecoAtivo(precoMensalidade.id, true)).ok).toBe(true);

    expect((await prisma.precoReferencia.findUniqueOrThrow({ where: { id: precoMensalidade.id } })).ativo).toBe(true);
    expect((await eventos(precoMensalidade.id)).map((e) => [e.tipo, e.autorId])).toEqual([["PrecoReativado", a.id]]);
  });

  it("confirmar a reativação de um preço que já está ativo não o desativa nem mexe no histórico", async () => {
    const { precoMensalidade } = await seedCatalogoMinimo();
    const adm = await criarUsuario([Papel.ADMINISTRADOR]);
    authMock.mockResolvedValue({ user: { id: adm.id } });
    // A tela velha mostra o preço inativo, mas ele já está ativo: confirmar "reativar" é no-op.
    const irmao = await prisma.precoReferencia.create({
      data: { paisId: precoMensalidade.paisId, produtoId: precoMensalidade.produtoId, modalidadeId: precoMensalidade.modalidadeId, tipoCobranca: TipoCobranca.MENSALIDADE, valor: 1, moeda: precoMensalidade.moeda, ativo: false },
    });
    expect((await definirPrecoAtivo(precoMensalidade.id, true)).ok).toBe(true);
    expect((await prisma.precoReferencia.findUniqueOrThrow({ where: { id: precoMensalidade.id } })).ativo).toBe(true);
    expect((await prisma.precoReferencia.findUniqueOrThrow({ where: { id: irmao.id } })).ativo).toBe(false);
    expect(await eventos(precoMensalidade.id)).toHaveLength(0);
  });

  it("desativar duas vezes grava um evento só e o preço continua desativado", async () => {
    const { precoMensalidade } = await seedCatalogoMinimo();
    const adm = await criarUsuario([Papel.ADMINISTRADOR]);
    authMock.mockResolvedValue({ user: { id: adm.id } });
    expect((await definirPrecoAtivo(precoMensalidade.id, false)).ok).toBe(true);
    expect((await definirPrecoAtivo(precoMensalidade.id, false)).ok).toBe(true);
    expect((await prisma.precoReferencia.findUniqueOrThrow({ where: { id: precoMensalidade.id } })).ativo).toBe(false);
    expect((await eventos(precoMensalidade.id)).map((e) => e.tipo)).toEqual(["PrecoDesativado"]);
  });

  it("reativar de fato ainda aposenta o irmão ativo da mesma combinação", async () => {
    const { precoMensalidade } = await seedCatalogoMinimo();
    const adm = await criarUsuario([Papel.ADMINISTRADOR]);
    authMock.mockResolvedValue({ user: { id: adm.id } });
    const antigo = await prisma.precoReferencia.create({
      data: { paisId: precoMensalidade.paisId, produtoId: precoMensalidade.produtoId, modalidadeId: precoMensalidade.modalidadeId, tipoCobranca: TipoCobranca.MENSALIDADE, valor: 1, moeda: precoMensalidade.moeda, ativo: false },
    });
    expect((await definirPrecoAtivo(antigo.id, true)).ok).toBe(true);
    expect((await prisma.precoReferencia.findUniqueOrThrow({ where: { id: antigo.id } })).ativo).toBe(true);
    expect((await prisma.precoReferencia.findUniqueOrThrow({ where: { id: precoMensalidade.id } })).ativo).toBe(false);
  });
});
