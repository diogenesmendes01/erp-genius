import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/segunda-chamada-designacao-consulta", () => ({ consultarDesignacoesSegundaChamada: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formulario", () => ({ Formulario: () => null }));

import Page from "./page";

const dado = {
  propostaId: "proposta", codigoAvaliacao: "A", identificacao: { aluno: "Ana", matriculaCodigo: "M", matriculaId: "matricula", turma: "Turma" }, busca: "", refinarBusca: false, podeDesignar: true, professores: [], vigenteProfessorId: "professor", proximaVersao: null,
  atual: { professor: { id: "professor", nome: "Bia" }, inicio: "2026-01-01T02:30:00.000Z", fim: null },
  historico: [{ id: "designacao", versao: 1, professor: { id: "professor", nome: "Bia" }, gestor: { id: "gestao", nome: "Carla" }, criadaEm: "2026-01-01T02:30:00.000Z", inicio: "2026-01-01T02:30:00.000Z", fim: null, motivo: "Designação aprovada" }],
};

const renderizar = () => Page({ params: Promise.resolve({ propostaId: "proposta" }), searchParams: Promise.resolve({}) });

describe("designação da segunda chamada", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.consulta.mockResolvedValue({ ok: true, dado });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("apresenta designações administrativas no fuso pessoal", async () => {
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toMatch(/31\/12\/2025.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem UTC");
    expect(html).toContain('name="busca"');
  });

  it("usa UTC sem preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toMatch(/01\/01\/2026.*02:30/);
    expect(html).toContain("UTC; origem UTC");
  });

  it("não consulta designações ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(renderizar()).rejects.toThrow("Sem sessão");
    expect(mocks.consulta).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
