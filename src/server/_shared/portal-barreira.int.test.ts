import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// Barreira do usuário SÓ-PORTAL (review PR #60): quem tem apenas o papel ALUNO não executa
// NENHUMA Server Action interna — o bloqueio é no núcleo (exigirSessao), fail-closed.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { truncarBanco, criarUsuario } from "@/test/integracao";
import { buscarVinculosInbox } from "@/server/whatsapp/acoes";
import { exigirSessao } from "@/server/_shared";

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
