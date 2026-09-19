import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(),
  preferencia: vi.fn(),
  aluno: vi.fn(),
  conta: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/portal-aluno/actions", () => ({
  decidirTrocaEmailPortalAluno: vi.fn(),
  prepararConvitePortalAluno: vi.fn(),
  prepararTrocaEmailPortalAluno: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  aluno: { findUnique: mocks.aluno },
  contaPortalAluno: { findUnique: mocks.conta },
} }));

import Page from "./page";

const instante = new Date("2026-01-01T02:30:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
  mocks.aluno.mockResolvedValue({ id: "aluno", primeiroNome: "Ana", sobrenome: "Silva", email: "ana@example.test" });
  mocks.conta.mockResolvedValue({
    id: "conta",
    emailVerificado: "ana@example.test",
    senhaHash: "hash",
    ativa: true,
    trocasEmail: [{
      id: "troca",
      novoEmail: "novo@example.test",
      situacao: "APROVADA",
      preparadorId: "secretaria",
      criadaEm: instante,
      novoEmailVerificadoEm: new Date("2026-01-01T03:30:00.000Z"),
      decisao: { aprovada: true, motivo: "Identidade conferida", criadaEm: new Date("2026-01-01T04:30:00.000Z") },
    }],
  });
});

describe("painel operacional de acesso ao portal no fuso pessoal", () => {
  it("formata criação, evidência e decisão no fuso pessoal sem alterar os formulários", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }) }));

    expect(html).toContain("31/12/2025, 20:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(html).toContain("31/12/2025, 21:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(html).toContain("31/12/2025, 22:30 (horário exibido em America/Costa_Rica; origem UTC)");
    expect(html).toContain('name="novoEmail"');
    expect(html).toContain('name="motivo"');
    expect(html).toContain('name="evidencia"');
  });

  it("recorre a UTC e não carrega conta ou preferência se a guarda falhar", async () => {
    mocks.preferencia.mockResolvedValueOnce({ ok: true, dado: { fusoExibicao: null } });
    const fallback = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }) }));
    expect(fallback).toContain("01/01/2026, 02:30 (horário exibido em UTC; origem UTC)");

    mocks.sessao.mockRejectedValueOnce(new Error("acesso negado"));
    await expect(Page({ params: Promise.resolve({ id: "outro" }) })).rejects.toThrow("acesso negado");
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
    expect(mocks.aluno).toHaveBeenCalledTimes(1);
    expect(mocks.conta).toHaveBeenCalledTimes(1);
  });
});
