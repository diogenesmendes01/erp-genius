import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166, 7º lote: configuração do WhatsApp na tela de régua e templates. Criar template recebe a chave da tentativa
// (marca no `TemplateCriado`); editar template, salvar a política da régua e acionar o kill switch gravam o
// estado-alvo, e o reenvio que não muda nada não grava outro Evento. A trava serializa o clique duplo.

// Sessão substituída, como nos outros `*-idempotencia`: o import dinâmico do Auth.js não aguenta chamadas paralelas.
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
import { REGUA } from "@/server/cobrancas/regua";
import { MODOS_FABRICA } from "@/server/cobrancas/fabrica";
import { acionarKillSwitchRegua, salvarPoliticaRegua, salvarTemplateWhatsApp } from "./acoes";
import type { PoliticaReguaInput } from "./schema";

let adminId: string, admin2Id: string;
const entrar = (id: string) => { sessao.usuarioId = id; };
const eventos = (tipo: string) => prisma.evento.count({ where: { tipo } });

beforeEach(async () => {
  await truncarBanco();
  adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin")).id;
  admin2Id = (await criarUsuario([Papel.ADMINISTRADOR], "Admin 2")).id;
  entrar(adminId);
});

function politica(over: Partial<PoliticaReguaInput> = {}): PoliticaReguaInput {
  return {
    estado: "DESLIGADA", janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5], tetoPorContatoDia: 2, silencioPosInboundHoras: 72, killSwitch: false,
    degraus: REGUA.map((d) => ({ passo: d.passo, offsetDias: d.offsetDias, modo: MODOS_FABRICA[d.passo], ativo: true })),
    ...over,
  };
}

const template = { nome: "cobranca_vencida", corpo: "Olá {{nome}}, sua parcela venceu.", idioma: "es", categoria: "utility" as const };

describe("criar template com chave (#166)", () => {
  it("a mesma chave, inclusive em envio simultâneo, cria um template e devolve o mesmo id", async () => {
    const entrada = { ...template, chaveIdempotencia: "tentativa-template-1" };
    const [a, b] = await Promise.all([salvarTemplateWhatsApp(entrada), salvarTemplateWhatsApp(entrada)]);
    if (!a.ok || !b.ok) throw new Error(JSON.stringify([a, b]));
    expect(a.dado?.id).toBe(b.dado?.id);
    const c = await salvarTemplateWhatsApp(entrada);
    expect(c.ok && c.dado?.id).toBe(a.dado?.id);
    expect(await prisma.templateWhatsApp.count()).toBe(1);
    expect(await eventos("TemplateCriado")).toBe(1);
  });

  it("a mesma chave com outra entrada é recusada; chave nova segue as regras de antes; sem chave, como antes", async () => {
    expect((await salvarTemplateWhatsApp({ ...template, chaveIdempotencia: "tentativa-template-2" })).ok).toBe(true);
    expect(await salvarTemplateWhatsApp({ ...template, corpo: "Outro corpo do template", chaveIdempotencia: "tentativa-template-2" }))
      .toEqual({ ok: false, erro: "Esta tentativa já foi usada para outro template. Recarregue a página antes de repetir." });
    expect(await salvarTemplateWhatsApp({ ...template, chaveIdempotencia: "tentativa-template-3" }))
      .toEqual({ ok: false, erro: "Já existe um template com este nome." });
    expect(await salvarTemplateWhatsApp(template)).toEqual({ ok: false, erro: "Já existe um template com este nome." });
    expect(await eventos("TemplateCriado")).toBe(1);
  });

  it("a chave de outro autor não devolve o template dele", async () => {
    expect((await salvarTemplateWhatsApp({ ...template, chaveIdempotencia: "tentativa-template-4" })).ok).toBe(true);
    entrar(admin2Id);
    expect(await salvarTemplateWhatsApp({ ...template, chaveIdempotencia: "tentativa-template-4" }))
      .toEqual({ ok: false, erro: "Já existe um template com este nome." });
  });

  it("a mesma edição grava um TemplateAlterado; mudar o corpo ainda grava", async () => {
    const r = await salvarTemplateWhatsApp({ ...template, chaveIdempotencia: "tentativa-template-5" });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
    const edicao = { ...template, id: r.dado.id, corpo: "Olá {{nome}}, a parcela venceu ontem." };
    const [a, b] = await Promise.all([salvarTemplateWhatsApp(edicao), salvarTemplateWhatsApp(edicao)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect(await eventos("TemplateAlterado")).toBe(1);
    expect((await salvarTemplateWhatsApp({ ...edicao, corpo: "Olá {{nome}}, a parcela venceu hoje." })).ok).toBe(true);
    expect(await eventos("TemplateAlterado")).toBe(2);
  });
});

describe("política da régua e kill switch repetidos (#166)", () => {
  it("o primeiro salvamento em clique duplo cria uma política e grava um Evento", async () => {
    const [a, b] = await Promise.all([salvarPoliticaRegua(politica()), salvarPoliticaRegua(politica())]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect(await prisma.politicaRegua.count()).toBe(1);
    expect(await eventos("PoliticaReguaAlterada")).toBe(1);
  });

  it("a mesma política não grava outro Evento; mudar a janela grava", async () => {
    expect((await salvarPoliticaRegua(politica())).ok).toBe(true);
    expect((await salvarPoliticaRegua(politica())).ok).toBe(true);
    expect(await eventos("PoliticaReguaAlterada")).toBe(1);
    expect((await salvarPoliticaRegua(politica({ janelaFim: 19 }))).ok).toBe(true);
    expect(await eventos("PoliticaReguaAlterada")).toBe(2);
  });

  it("o kill switch em clique duplo grava um Evento", async () => {
    expect((await salvarPoliticaRegua(politica())).ok).toBe(true);
    const [a, b] = await Promise.all([acionarKillSwitchRegua(true), acionarKillSwitchRegua(true)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await prisma.politicaRegua.findFirstOrThrow()).killSwitch).toBe(true);
    expect(await eventos("PoliticaReguaAlterada")).toBe(2);
  });
});
