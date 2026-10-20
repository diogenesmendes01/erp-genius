import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (3º lote): "Adicionar fonte" (texto) na base de conhecimento da Aria. Com chave, o reenvio da mesma
// tentativa devolve a fonte já criada, sem segunda fonte, trechos nem Evento.

// Sessão: só `exigirSessao` é trocada (mesmo motivo de comercial/criar-lead-idempotencia.int.test.ts).
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return {
    ...o,
    exigirSessao: async () => {
      const u = await o.carregarUsuarioFresco(sessao.usuarioId);
      if (!u) throw new o.ErroAutenticacao();
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarFonteTexto } from "./fontes";

beforeEach(async () => {
  await truncarBanco();
  sessao.usuarioId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin")).id;
});

const fonte = { nome: "Preços 2026", texto: "A mensalidade do curso regular é de 100 por mês.", enviavelAoLead: true };

describe("criarFonteTexto com chave (#166)", () => {
  it("a mesma chave (inclusive em envio simultâneo) cria uma fonte, os trechos uma vez e um Evento", async () => {
    const entrada = { ...fonte, chaveIdempotencia: "chave-fonte-0001" };
    const [a, b] = await Promise.all([criarFonteTexto(entrada), criarFonteTexto(entrada)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await criarFonteTexto(entrada)).toEqual(a);
    expect(await prisma.fonteConhecimento.count()).toBe(1);
    const trechos = await prisma.trechoConhecimento.count();
    expect(trechos).toBeGreaterThan(0);
    expect(await prisma.evento.count({ where: { tipo: "FonteConhecimentoCriada" } })).toBe(1);
  });

  it("recusa a mesma chave com outro texto ou outra validade; sem chave cria como antes", async () => {
    expect((await criarFonteTexto({ ...fonte, chaveIdempotencia: "chave-fonte-0002" })).ok).toBe(true);
    const outroTexto = await criarFonteTexto({ ...fonte, texto: "Outro conteúdo", chaveIdempotencia: "chave-fonte-0002" });
    const outraValidade = await criarFonteTexto({ ...fonte, validoAte: new Date(Date.now() + 86_400_000), chaveIdempotencia: "chave-fonte-0002" });
    expect([outroTexto.ok, outraValidade.ok]).toEqual([false, false]);
    if (!outroTexto.ok) expect(outroTexto.erro).toMatch(/já foi usada/);
    expect(await prisma.fonteConhecimento.count()).toBe(1);
    expect((await criarFonteTexto(fonte)).ok).toBe(true);
    expect((await criarFonteTexto(fonte)).ok).toBe(true);
    expect(await prisma.fonteConhecimento.count()).toBe(3);
  });
});
