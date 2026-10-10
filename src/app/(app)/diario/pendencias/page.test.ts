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
  temAnterior: false, temProxima: true, anterior: null, proxima: "encontro-20",
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

  it("exibe vencimento, ação limitada e os dois sentidos da fila para o professor", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.PROFESSOR] });
    mocks.consultar.mockResolvedValue(base({ temAnterior: true, anterior: "encontro-21", proxima: "encontro-40" }));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "encontro-20" }) }));
    expect(mocks.consultar).toHaveBeenCalledWith({ depois: "encontro-20" });
    expect(html).toContain("Chamada pendente");
    expect(html).toContain("Abrir diário para regularizar");
    expect(html).toContain("encontro%2Fa%3F");
    expect(html).toContain('href="/diario/pendencias?antes=encontro-21">← Anterior');
    expect(html).toContain('href="/diario/pendencias?depois=encontro-40">Próxima');
    expect(html).toContain("07:00");
    expect(html).toContain("09:00");
    expect(html).toContain("exibido em America/Costa_Rica; origem America/Sao_Paulo");
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
  });

  it("início só com Próxima e sem link para si; voltando, o cursor chega à consulta; a última não tem Próxima", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.PROFESSOR] });
    mocks.consultar.mockResolvedValue(base());
    const inicio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({});
    expect(inicio).not.toContain("Anterior");
    expect(inicio).not.toContain("pagina");
    expect(inicio).toContain('href="/diario/pendencias?depois=encontro-20">Próxima');
    mocks.consultar.mockResolvedValue(base({ temAnterior: true, temProxima: false, anterior: "encontro-41", proxima: null }));
    const ultima = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ antes: "encontro-60" }) }));
    expect(mocks.consultar).toHaveBeenLastCalledWith({ antes: "encontro-60" });
    expect(ultima).toContain('href="/diario/pendencias?antes=encontro-41">← Anterior');
    expect(ultima).not.toContain("Próxima →");
  });

  it("vazio: no início, sem link para si; num ponto da fila sem pendências, a volta ao início", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.PROFESSOR] });
    mocks.consultar.mockResolvedValue(base({ itens: [], temProxima: false, proxima: null }));
    const inicio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(inicio).toContain("Nenhuma pendência de diário encontrada.");
    expect(inicio).not.toContain('href="/diario/pendencias"');
    const alem = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "encontro-sumido" }) }));
    expect(alem).toContain("Nenhuma pendência de diário a partir deste ponto da fila.");
    expect(alem).toContain('href="/diario/pendencias">Ir para o início da fila');
    expect(alem).not.toContain("nesta página");
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
