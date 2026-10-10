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
  pagina: 1,
  temProxima: true,
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

  it("exibe vencimento, ação limitada e as duas direções da paginação para o professor", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.PROFESSOR] });
    mocks.consultar.mockResolvedValue(base());
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "3" }) }));
    expect(mocks.consultar).toHaveBeenCalledWith({ pagina: 3 });
    expect(html).toContain("Chamada pendente");
    expect(html).toContain("Abrir diário para regularizar");
    expect(html).toContain("encontro%2Fa%3F");
    expect(html).toContain('href="/diario/pendencias?pagina=2">← Anterior');
    expect(html).toContain('href="/diario/pendencias?pagina=4">Próxima');
    expect(html).toContain("07:00");
    expect(html).toContain("09:00");
    expect(html).toContain("exibido em America/Costa_Rica; origem America/Sao_Paulo");
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
  });

  it("primeira página só com Próxima; da segunda, Anterior volta sem ?pagina=1; a última não tem Próxima", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.PROFESSOR] });
    mocks.consultar.mockResolvedValue(base());
    const primeira = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({ pagina: 1 });
    expect(primeira).not.toContain("Anterior");
    expect(primeira).toContain('href="/diario/pendencias?pagina=2">Próxima');
    mocks.consultar.mockResolvedValue(base({ pagina: 2, temProxima: false }));
    const segunda = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
    expect(segunda).toContain('href="/diario/pendencias">← Anterior');
    expect(segunda).not.toContain("Próxima →");
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
