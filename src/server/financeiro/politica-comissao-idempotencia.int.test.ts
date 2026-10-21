import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (4º lote): publicar a política de comissão é idempotente por natureza. Se a última versão já é exatamente a
// pedida, publicada por quem repete, o reenvio devolve ok sem abrir outra versão nem gravar outro Evento (antes
// recusava com "deve começar depois da versão anterior").

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
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { publicarPoliticaComissao } from "./acoes";

let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let admId: string;
let outroAdmId: string;

beforeEach(async () => {
  await truncarBanco();
  cat = await seedCatalogoMinimo();
  admId = (await criarUsuario([Papel.ADMINISTRADOR], "Adm")).id;
  outroAdmId = (await criarUsuario([Papel.ADMINISTRADOR], "Outro adm")).id;
  sessao.usuarioId = admId;
});

const entrada = (vigenteEm: Date) => ({ paisId: cat.pais.id, produtoId: cat.produto.id, tipo: "PERCENTUAL" as const, percentual: 12.5, valorFixo: null, moeda: "CRC", vigenteEm });
const versoes = () => prisma.politicaComissao.count();
const publicadas = () => prisma.evento.count({ where: { tipo: "PoliticaComissaoPublicada" } });

describe("publicarPoliticaComissao repetida (#166)", () => {
  it("o reenvio, inclusive simultâneo, grava uma versão e um Evento", async () => {
    const e = entrada(new Date(Date.now() + 86_400_000));
    const [a, b] = await Promise.all([publicarPoliticaComissao(e), publicarPoliticaComissao(e)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(await publicarPoliticaComissao(e)).toEqual(a);
    expect(await versoes()).toBe(1);
    expect(await publicadas()).toBe(1);
  });

  it("o reenvio tardio de uma política 'a partir de agora' também é reconhecido", async () => {
    const e = entrada(new Date(Date.now() - 56_000));
    expect((await publicarPoliticaComissao(e)).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 5_000));
    expect((await publicarPoliticaComissao(e)).ok).toBe(true);
    expect(await versoes()).toBe(1);
  }, 20_000);

  it("outro valor, outro autor ou outra data continuam passando pelas regras de versão", async () => {
    const quando = new Date(Date.now() + 86_400_000);
    expect((await publicarPoliticaComissao(entrada(quando))).ok).toBe(true);
    expect((await publicarPoliticaComissao({ ...entrada(quando), percentual: 13 })).ok).toBe(false);
    sessao.usuarioId = outroAdmId;
    expect((await publicarPoliticaComissao(entrada(quando))).ok).toBe(false);
    expect((await publicarPoliticaComissao(entrada(new Date(quando.getTime() + 86_400_000)))).ok).toBe(true);
    expect(await versoes()).toBe(2);
    expect(await publicadas()).toBe(2);
  });
});
