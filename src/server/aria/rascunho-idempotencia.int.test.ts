import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (4º lote): salvar, publicar e descartar o rascunho da Aria são idempotentes por natureza. O reenvio depois de
// um resultado incerto chega com o token antigo do rascunho; em vez de "o rascunho mudou", o servidor reconhece o
// estado-alvo já alcançado e devolve o mesmo resultado sem gravar nem registrar outro Evento.

// Sessão: só `exigirSessao`/`exigirSessaoComPapel` são trocadas (mesmo motivo de
// comercial/criar-lead-idempotencia.int.test.ts); os papéis continuam lidos do banco.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return { ...o, exigirSessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const u = await exigirSessao(); o.exigirPapel(u, ...papeis); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { configPadrao } from "./config-schema";
import { descartarRascunho, publicarRascunho, rascunhoAtual, salvarRascunho } from "./versoes";

const comNome = (nome: string) => ({ ...configPadrao(), nome });
const contar = (tipo: string) => prisma.evento.count({ where: { tipo, agregadoTipo: "VersaoAgenteIA" } });
let adminId: string;

beforeEach(async () => {
  await truncarBanco();
  adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Adm")).id;
  sessao.usuarioId = adminId;
});

describe("rascunho da Aria repetido (#166)", () => {
  it("salvar: o reenvio com o token antigo, inclusive simultâneo, devolve o mesmo rascunho com um Evento", async () => {
    const entrada = { config: comNome("Lia"), baseVersaoId: null, rascunho: null };
    const [a, b] = await Promise.all([salvarRascunho(entrada), salvarRascunho(entrada)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await salvarRascunho(entrada)).toEqual(a);
    expect(await prisma.versaoAgenteIA.count()).toBe(1);
    expect(await contar("AgenteIARascunhoSalvo")).toBe(1);
    // Outra configuração com o token antigo continua recusada.
    const outra = await salvarRascunho({ ...entrada, config: comNome("Bia") });
    expect(outra.ok).toBe(false);
  });

  it("publicar: o reenvio do mesmo rascunho devolve o mesmo número, sem arquivar nem registrar de novo", async () => {
    expect((await salvarRascunho({ config: comNome("Lia"), baseVersaoId: null, rascunho: null })).ok).toBe(true);
    const aberto = await rascunhoAtual();
    const primeira = await publicarRascunho({ rascunho: aberto });
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    expect(await publicarRascunho({ rascunho: aberto })).toEqual(primeira);
    expect(await contar("AgenteIAPublicado")).toBe(1);
    expect(await prisma.versaoAgenteIA.count({ where: { status: "PUBLICADA" } })).toBe(1);
  });

  it("descartar: o reenvio do mesmo rascunho devolve ok sem outro descarte", async () => {
    expect((await salvarRascunho({ config: comNome("Lia"), baseVersaoId: null, rascunho: null })).ok).toBe(true);
    const aberto = await rascunhoAtual();
    const primeira = await descartarRascunho(aberto);
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    expect(await descartarRascunho(aberto)).toEqual(primeira);
    expect(await contar("AgenteIARascunhoDescartado")).toBe(1);
  });
});
