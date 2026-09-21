import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// Barreira do usuário SÓ-PORTAL (review PR #60): quem tem apenas o papel ALUNO não executa
// NENHUMA Server Action interna — o bloqueio é no núcleo (exigirSessao), fail-closed.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// redirect() do Next lança (NEXT_REDIRECT); o mock lança com a URL para asserção.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { truncarBanco, criarUsuario } from "@/test/integracao";
import { buscarVinculosInbox } from "@/server/whatsapp/acoes";
import { exigirSessao, exigirSessaoPagina } from "@/server/_shared";

beforeEach(async () => {
  await truncarBanco();
});

describe("usuário só-portal (papel ALUNO)", () => {
  it("é NEGADO em ação interna que exige apenas sessão", async () => {
    const alunoUser = await criarUsuario([Papel.ALUNO], "Aluno Portal");
    authMock.mockResolvedValue({ user: { id: alunoUser.id } });

    // buscarVinculosInbox só exige sessão — era exatamente a brecha apontada na review.
    const r = await buscarVinculosInbox("ana");
    expect(r.ok).toBe(false);
    await expect(exigirSessao()).rejects.toThrow();
  });

  it("papel ALUNO combinado com papel operacional continua passando", async () => {
    const misto = await criarUsuario([Papel.ALUNO, Papel.VENDEDOR], "Misto");
    authMock.mockResolvedValue({ user: { id: misto.id } });
    const r = await buscarVinculosInbox("ana");
    expect(r.ok).toBe(true);
  });
});

describe("hierarquia layout + página (review PR #60 rodada 2)", () => {
  it("layout interno (sem alvo) manda o aluno ao /portal; o guard do portal (alvo ALUNO) deixa passar — sem loop", async () => {
    const alunoUser = await criarUsuario([Papel.ALUNO], "Aluno Portal");
    authMock.mockResolvedValue({ user: { id: alunoUser.id } });
    // (app)/layout.tsx chama exigirSessaoPagina() SEM alvo → aluno-only sai para /portal.
    await expect(exigirSessaoPagina()).rejects.toThrow("REDIRECT:/portal");
    // (portal)/layout.tsx chama com alvo ALUNO → retorna o usuário SEM redirecionar.
    // Como o /portal saiu do grupo (app), este é o único guard da rota — fim do loop
    // /portal → /portal apontado na rodada 2.
    const u = await exigirSessaoPagina(Papel.ALUNO);
    expect(u.id).toBe(alunoUser.id);
  });

  it("staff passa no layout interno; staff sem papel ALUNO no portal cai em /acesso-negado", async () => {
    const sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Sec");
    authMock.mockResolvedValue({ user: { id: sec.id } });
    const u = await exigirSessaoPagina();
    expect(u.id).toBe(sec.id);
    await expect(exigirSessaoPagina(Papel.ALUNO)).rejects.toThrow("REDIRECT:/acesso-negado");
  });
});
