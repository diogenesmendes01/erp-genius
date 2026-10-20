import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (3º lote): criar tag, campo personalizado e resposta rápida pela configuração do CRM. Com chave, o
// reenvio da mesma tentativa devolve o registro criado (em vez de "Já existe…"), e o envio simultâneo não
// passa pela checagem de nome duas vezes. A edição (com `id`) continua sem chave.

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
import { salvarCampo, salvarTag } from "./tags-campos";
import { salvarRespostaRapida } from "./respostas-rapidas";

beforeEach(async () => {
  await truncarBanco();
  sessao.usuarioId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin")).id;
});

describe("salvarTag (criação) com chave (#166)", () => {
  const tag = { nome: "Inglês", grupo: "Interesse", cor: "INFO" } as const;

  it("a mesma chave (inclusive em envio simultâneo) cria uma tag e um Evento e devolve o mesmo id", async () => {
    const [a, b] = await Promise.all([salvarTag({ ...tag, chaveIdempotencia: "chave-tag-0001" }), salvarTag({ ...tag, chaveIdempotencia: "chave-tag-0001" })]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await salvarTag({ ...tag, chaveIdempotencia: "chave-tag-0001" })).toEqual(a);
    expect(await prisma.tag.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "TagSalva" } })).toBe(1);
  });

  it("recusa a mesma chave com outra entrada, sem criar", async () => {
    expect((await salvarTag({ ...tag, chaveIdempotencia: "chave-tag-0002" })).ok).toBe(true);
    const r = await salvarTag({ ...tag, nome: "Espanhol", chaveIdempotencia: "chave-tag-0002" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/já foi usada/);
    expect(await prisma.tag.count()).toBe(1);
  });
});

describe("salvarCampo (criação) com chave (#166)", () => {
  const campo = { nome: "Observação", tipo: "TEXTO", opcoes: [], alvo: "PESSOA", obrigatorio: false } as const;

  it("a mesma chave (inclusive em envio simultâneo) cria um campo e um Evento e devolve o mesmo id", async () => {
    const entrada = { ...campo, opcoes: [] as string[], chaveIdempotencia: "chave-campo-01" };
    const [a, b] = await Promise.all([salvarCampo(entrada), salvarCampo(entrada)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await salvarCampo(entrada)).toEqual(a);
    expect(await prisma.campoPersonalizado.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "CampoSalvo" } })).toBe(1);
  });

  it("recusa a mesma chave com outra entrada, sem criar", async () => {
    expect((await salvarCampo({ ...campo, opcoes: [], chaveIdempotencia: "chave-campo-02" })).ok).toBe(true);
    const r = await salvarCampo({ ...campo, opcoes: [], obrigatorio: true, chaveIdempotencia: "chave-campo-02" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/já foi usada/);
    expect(await prisma.campoPersonalizado.count()).toBe(1);
  });
});

describe("salvarRespostaRapida (criação) com chave (#166)", () => {
  const resposta = { atalho: "/preco", titulo: "Preço", corpo: "Oi {nome}, o valor é este.", setor: null, ariaPodeUsar: false } as const;
  const respostas = () => prisma.templateWhatsApp.count({ where: { tipo: "RESPOSTA_RAPIDA" } });

  it("a mesma chave (inclusive em envio simultâneo) cria uma resposta e um Evento e devolve o mesmo id", async () => {
    const [a, b] = await Promise.all([
      salvarRespostaRapida({ ...resposta, chaveIdempotencia: "chave-resposta-01" }),
      salvarRespostaRapida({ ...resposta, chaveIdempotencia: "chave-resposta-01" }),
    ]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await salvarRespostaRapida({ ...resposta, chaveIdempotencia: "chave-resposta-01" })).toEqual(a);
    expect(await respostas()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "RespostaRapidaSalva" } })).toBe(1);
  });

  it("recusa a mesma chave com outra entrada, sem criar", async () => {
    expect((await salvarRespostaRapida({ ...resposta, chaveIdempotencia: "chave-resposta-02" })).ok).toBe(true);
    const r = await salvarRespostaRapida({ ...resposta, atalho: "/valor", chaveIdempotencia: "chave-resposta-02" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/já foi usada/);
    expect(await respostas()).toBe(1);
  });
});
