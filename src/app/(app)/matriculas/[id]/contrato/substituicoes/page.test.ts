import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guarda: vi.fn(), consulta: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/server/contratos/substituicao", () => ({ consultarSubstituicoesContratuais: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formularios", () => ({ PrepararSubstituicao: ({ conferencias }: { conferencias: { rotulo: string }[] }) => createElement("p", null, conferencias.map(c => c.rotulo).join(" | ")) }));

import Page from "./page";

const resposta = () => ({ ok: true, dado: {
  matricula: { aluno: "Ana Silva" }, podePreparar: true,
  fonte: { id: "processo", artefatoId: "artefato", revisaoHash: "a".repeat(64), assinaturaConcluida: false },
  conferencias: [{ id: "conferencia", artefatoId: "novo", revisaoHash: "b".repeat(64), criadaEm: new Date("2026-10-01T02:30:00.000Z"), motivo: "Documento conferido" }],
  paginaConferencias: 1, maisConferencias: false,
  propostas: [{ id: "proposta", versao: 2, criadaEm: new Date("2026-10-01T03:30:00.000Z"), preparadaPor: { nome: "Secretaria A" }, motivo: "Atualização", decisao: null }],
  pagina: 1, maisPropostas: false,
} });

describe("SubstituicoesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guarda.mockResolvedValue({ id: "secretaria" });
    mocks.consulta.mockResolvedValue(resposta());
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("formata conferência e preparação no fuso pessoal sem alterar links", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({}) }));

    expect(html).toContain("30/09/2026, 20:30 (America/Costa_Rica; origem UTC)");
    expect(html).toContain("30/09/2026, 21:30 (America/Costa_Rica; origem UTC)");
    expect(html).toContain('/matriculas/matricula/contrato/substituicoes/proposta');
  });

  it("usa UTC quando a preferência é indisponível", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });

    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({}) }));

    expect(html).toContain("01/10/2026, 02:30 (UTC; origem UTC)");
  });

  it("não consulta preferência ou histórico se a guarda falha", async () => {
    mocks.guarda.mockRejectedValue(new Error("Sem sessão"));

    await expect(Page({ params: Promise.resolve({ id: "matricula" }), searchParams: Promise.resolve({}) })).rejects.toThrow("Sem sessão");

    expect(mocks.consulta).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
