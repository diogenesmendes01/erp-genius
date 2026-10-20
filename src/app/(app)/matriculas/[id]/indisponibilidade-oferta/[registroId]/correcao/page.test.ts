import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/indisponibilidade-oferta-correcao", () => ({ consultarCorrecoesRelatoIndisponibilidadeOferta: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./CorrecaoRelatoOferta", () => ({
  ProporCorrecaoRelato: (p: { inicio: string; fim: string | null }) => `[propor:${p.inicio}|${p.fim}]`,
  DecidirCorrecaoRelato: (p: { propostaId: string }) => `[decidir:${p.propostaId}]`,
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) }));

import Page from "./page";

const proposta = (versao: number, decisao: unknown) => ({
  id: `p${versao}`, registroId: "reg", versao, anterior: { inicio: "2026-10-01", fim: "2026-10-10" }, novo: { inicio: "2026-10-03", fim: "2026-10-12" },
  motivo: "Data informada errada", evidenciaTexto: "Ata da coordenação", criadaEm: "2026-10-15T15:00:00.000Z", autorNome: "Secretária", decisao,
});
const dado = (ajuste: Record<string, unknown> = {}) => ({
  fusoInstitucional: "America/Sao_Paulo",
  relato: { id: "reg", matriculaId: "mat", inicio: "2026-10-03", fim: "2026-10-12", terminoAprovado: null, confirmado: true },
  podePropor: false, podeDecidir: true, pendenteId: "p2", pagina: 1, temProxima: false,
  propostas: [proposta(2, null), proposta(1, { id: "d1", aprovada: true, motivo: "Conferido pela gestão", evidenciaTexto: "Oferta conferida", decididaEm: "2026-10-16T15:00:00.000Z" })],
  ...ajuste,
});
const renderizar = (matriculaId = "mat") => Page({ params: Promise.resolve({ id: matriculaId, registroId: "reg" }), searchParams: Promise.resolve({}) });

describe("página de correção do relato de indisponibilidade (Q157)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("React", React);
    mocks.sessao.mockResolvedValue({ id: "gestor" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
    mocks.consultar.mockResolvedValue({ ok: true, dado: dado() });
  });

  it("mostra o período vigente, o histórico versionado no fuso da escola e só a decisão pendente", async () => {
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toContain("Período vigente: 03/10/2026 a 12/10/2026");
    expect(html).toContain("Versão 2 · de 01/10/2026 a 10/10/2026 para 03/10/2026 a 12/10/2026");
    expect(html).toContain("[decidir:p2]");
    expect(html).not.toContain("[propor:");
    expect(html).toContain("Aguardando decisão.");
    expect(html).toMatch(/Aprovada em 16\/10\/2026.*12:00/);
    expect(html).toContain('href="/matriculas/mat/indisponibilidade-oferta"');
    expect(mocks.sessao).toHaveBeenCalledWith("SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "FINANCEIRO", "ADMINISTRADOR");
  });

  it("relato de outra matrícula não é exibido", async () => {
    const html = renderToStaticMarkup(await renderizar("outra"));
    expect(html).toContain("Relato de indisponibilidade não encontrado nesta matrícula.");
    expect(html).not.toContain("Versão 2");
  });

  it("sem correções: estado vazio; com permissão, o formulário parte do período vigente", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: dado({ propostas: [], podePropor: true, podeDecidir: false, pendenteId: null }) });
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toContain("Nenhuma correção registrada para este relato.");
    expect(html).toContain("[propor:2026-10-03|2026-10-12]");
  });

  it("falha da consulta aparece como alerta", async () => {
    mocks.consultar.mockResolvedValue({ ok: false, erro: "Acesso negado" });
    expect(renderToStaticMarkup(await renderizar())).toContain('<p role="alert">Acesso negado</p>');
  });
});
