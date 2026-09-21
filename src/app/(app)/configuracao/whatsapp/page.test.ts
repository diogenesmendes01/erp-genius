import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), papeisTem: vi.fn(), preferencia: vi.fn(), comercial: vi.fn(), saudacoes: vi.fn(),
  reguas: vi.fn(), numerosResumo: vi.fn(), templatesResumo: vi.fn(), ensaio: vi.fn(), numeros: vi.fn(),
  templates: vi.fn(), politica: vi.fn(), vendedores: vi.fn(), avisos: vi.fn(),
  metricasIA: vi.fn(),
}));
vi.mock("@/lib/guards", () => ({ exigirPapelLeitura: mocks.guard, papeisTem: mocks.papeisTem }));
vi.mock("@/components/AcessoNegado", () => ({ AcessoNegado: () => createElement("p", null, "Acesso negado") }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/comercial/consultas", () => ({
  carregarConfigComercial: mocks.comercial, carregarSaudacoesSimuladas: mocks.saudacoes,
  carregarReguasComerciaisConfig: mocks.reguas, listarNumerosVendasResumo: mocks.numerosResumo,
  listarTemplatesResumo: mocks.templatesResumo, carregarEnsaioComercial: mocks.ensaio, listarVendedores: mocks.vendedores,
}));
vi.mock("@/server/whatsapp/consultas", () => ({
  listarNumerosConfig: mocks.numeros, listarTemplatesConfig: mocks.templates,
  carregarPoliticaConfig: mocks.politica, carregarConfiguracaoAvisosAgenda: mocks.avisos,
}));
vi.mock("@/server/ia/consultas", () => ({ metricasCopiloto: mocks.metricasIA }));
vi.mock("./ComercialPainel", () => ({ ComercialPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => createElement("p", { "data-comercial-fuso": preferenciaFusoExibicao ?? "UTC" }) }));
vi.mock("./ReguaComercialPainel", () => ({ ReguasComerciaisPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => createElement("p", { "data-regua-fuso": preferenciaFusoExibicao ?? "UTC" }) }));
vi.mock("./NumerosPainel", () => ({ NumerosPainel: () => createElement("p", null, "admin números") }));
vi.mock("./TemplatesPainel", () => ({ TemplatesPainel: () => null }));
vi.mock("./PoliticaPainel", () => ({ PoliticaPainel: () => null }));
vi.mock("./AvisosAgendaPainel", () => ({ AvisosAgendaPainel: () => null }));

import Page from "./page";

describe("WhatsAppConfigPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue([Papel.GERENTE_COMERCIAL]);
    mocks.papeisTem.mockReturnValue(false);
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    for (const m of [mocks.comercial, mocks.saudacoes, mocks.reguas, mocks.numerosResumo, mocks.templatesResumo, mocks.ensaio, mocks.metricasIA]) m.mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  it("lê a preferência após a guarda e a entrega aos dois painéis comerciais", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(mocks.guard).toHaveBeenCalledWith(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
    expect(mocks.preferencia).toHaveBeenCalledTimes(1);
    expect(html).toContain('data-comercial-fuso="America/Costa_Rica"');
    expect(html).toContain('data-regua-fuso="America/Costa_Rica"');
  });

  it("não lê preferência nem dados quando a guarda recusa", async () => {
    mocks.guard.mockResolvedValueOnce(null);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Acesso negado");
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.comercial).not.toHaveBeenCalled();
  });

  it("não consulta nem mostra dados administrativos para gerente", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).not.toContain("admin números");
    for (const m of [mocks.numeros, mocks.templates, mocks.politica, mocks.vendedores, mocks.avisos]) expect(m).not.toHaveBeenCalled();
  });
});
