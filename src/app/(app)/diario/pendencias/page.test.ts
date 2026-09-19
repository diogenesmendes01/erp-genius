import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/diario/avisos-pendencias-diario", () => ({ consultarAvisosDiario: mocks.consultar }));

import Page from "./page";

const base = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  configurada: true,
  configuracao: { prazoRegularizacaoDiarioMinutos: 60, intervaloLembreteDiarioMinutos: 30 },
  gestao: false,
  itens: [{ id: "aviso/a?", encontroId: "encontro/a?", turma: "Turma A", professor: "Prof. Ana", inicio: "2026-09-16T13:00:00.000Z", fim: "2026-09-16T14:00:00.000Z", fusoOrigem: "America/Sao_Paulo", pendencias: ["Chamada pendente"], vencimento: "2026-09-16T15:00:00.000Z", atrasada: false, ultimoLembreteEm: null, proximoLembreteEm: null, quantidadeLembretes: 0, podeRegularizar: true }],
  proximoCursor: "cursor &/",
  ...sobrescrever,
} });

describe("PendenciasDiarioPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });
  it("alerta o administrador quando a configuração está ausente", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.consultar.mockResolvedValue(base({ configurada: false, configuracao: { prazoRegularizacaoDiarioMinutos: null, intervaloLembreteDiarioMinutos: null }, itens: [] }));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("ainda não foram configurados");
    expect(html).toContain("Configurar avisos");
  });

  it("exibe vencimento, ação limitada e cursor codificado para o professor", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.PROFESSOR] });
    mocks.consultar.mockResolvedValue(base());
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ cursor: "anterior" }) }));
    expect(html).toContain("Chamada pendente");
    expect(html).toContain("Abrir diário para regularizar");
    expect(html).toContain("encontro%2Fa%3F");
    expect(html).toContain("cursor=cursor%20%26%2F");
    expect(html).toContain("Primeira página");
    expect(html).toContain("07:00");
    expect(html).toContain("09:00");
    expect(html).toContain("exibido em America/Costa_Rica; origem America/Sao_Paulo");
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
  });

  it("mostra acompanhamento vencido à gestão sem oferecer escrita sem atribuição", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.GERENTE_PEDAGOGICO] });
    mocks.consultar.mockResolvedValue(base({ gestao: true, itens: [{ ...base().dado.itens[0], atrasada: true, quantidadeLembretes: 2, podeRegularizar: false }] }));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Acompanhamento da gestão");
    expect(html).toContain("atrasada");
    expect(html).toContain("2 lembrete(s) registrado(s)");
    expect(html).not.toContain("Abrir diário para regularizar");
  });
});
