import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/segunda-chamada-docente", () => ({ consultarSegundaChamadaDocente: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import Page from "./page";

const dado = {
  reservaId: "reserva", alocacaoId: "alocacao", codigoAvaliacao: "A", identificacao: { aluno: "Ana", matriculaCodigo: "M", matriculaId: "matricula", turma: "Turma", nivel: "1" },
  horario: { inicio: "2026-01-01T02:30:00.000Z", fim: "2026-01-01T03:30:00.000Z", fusoOrigem: "UTC" }, status: "RESERVADA", realizacao: null, realizador: null, podeRealizar: true, notaOriginal: null, podeLancarNota: false,
};

describe("segunda chamada designada", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consulta.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("mostra a saída no fuso pessoal e mantém UTC como entrada explícita", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "reserva" }) }));
    expect(html).toMatch(/31\/12\/2025.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toMatch(/<input[^>]*name="fuso"[^>]*value="UTC"/);
  });

  it("recorre a UTC quando não há preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ reservaId: "reserva" }) }));
    expect(html).toMatch(/01\/01\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("não consulta a reserva ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(Page({ params: Promise.resolve({ reservaId: "reserva" }) })).rejects.toThrow("Sem sessão");
    expect(mocks.consulta).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
