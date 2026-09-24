import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// Configuração do WhatsApp por rota (E8): índice → primeira seção da função; layout com as abas da
// função; cada seção com o PRÓPRIO guard antes das consultas e só as consultas dela.
const mocks = vi.hoisted(() => ({
  papeis: { valor: ["GERENTE_COMERCIAL"] as string[] },
  redirect: vi.fn((destino: string) => { throw new Error(`REDIRECT ${destino}`); }),
  preferencia: vi.fn(), comercial: vi.fn(), saudacoes: vi.fn(), reguas: vi.fn(), numerosResumo: vi.fn(),
  templatesResumo: vi.fn(), ensaio: vi.fn(), numeros: vi.fn(), templates: vi.fn(), politica: vi.fn(),
  vendedores: vi.fn(), avisos: vi.fn(), metricasIA: vi.fn(),
  subtabs: vi.fn((props: { tabs: { href: string }[]; ariaLabel?: string }) => createElement("nav", { "aria-label": props.ariaLabel }, props.tabs.map((t) => t.href).join(","))),
}));
vi.mock("@/lib/guards", () => ({
  exigirPapelLeitura: async (...alvo: string[]) => (mocks.papeis.valor.includes("ADMINISTRADOR") || alvo.some((p) => mocks.papeis.valor.includes(p)) ? mocks.papeis.valor : null),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/AcessoNegado", () => ({ AcessoNegado: () => createElement("p", null, "Acesso negado") }));
vi.mock("@/components/SubTabs", () => ({ SubTabs: mocks.subtabs }));
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
vi.mock("./TemplatesPainel", () => ({ TemplatesPainel: () => createElement("p", null, "admin templates") }));
vi.mock("./PoliticaPainel", () => ({ PoliticaPainel: () => createElement("p", null, "admin política") }));
vi.mock("./AvisosAgendaPainel", () => ({ AvisosAgendaPainel: () => createElement("p", null, "admin avisos") }));

import Indice from "./page";
import Layout from "./layout";
import Numeros from "./numeros/page";
import Templates from "./templates/page";
import Politica from "./politica/page";
import AvisosAgenda from "./avisos-agenda/page";
import Comercial from "./comercial/page";
import Reguas from "./reguas/page";

const html = async (el: Promise<React.ReactElement>) => renderToStaticMarkup(await el);
const consultasAdmin = () => [mocks.numeros, mocks.templates, mocks.politica, mocks.vendedores, mocks.avisos];
const consultasComerciais = () => [mocks.comercial, mocks.saudacoes, mocks.reguas, mocks.numerosResumo, mocks.templatesResumo, mocks.ensaio, mocks.metricasIA, mocks.preferencia];

describe("Configuração do WhatsApp por rota (E8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.papeis.valor = [Papel.GERENTE_COMERCIAL];
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    for (const m of [...consultasAdmin(), ...consultasComerciais().filter((x) => x !== mocks.preferencia)]) m.mockResolvedValue([]);
  });

  it("índice leva à primeira seção da função, sem consultar dados", async () => {
    await expect(Indice()).rejects.toThrow("REDIRECT /configuracao/whatsapp/comercial");
    mocks.papeis.valor = [Papel.ADMINISTRADOR];
    await expect(Indice()).rejects.toThrow("REDIRECT /configuracao/whatsapp/numeros");
    for (const m of [...consultasAdmin(), ...consultasComerciais()]) expect(m).not.toHaveBeenCalled();
  });

  it("índice e layout negam quem não é admin nem gerente comercial", async () => {
    mocks.papeis.valor = [Papel.VENDEDOR];
    expect(await html(Indice() as Promise<React.ReactElement>)).toContain("Acesso negado");
    expect(await html(Layout({ children: createElement("p", null, "filho") }))).toContain("Acesso negado");
  });

  it("layout: gerente vê só as abas comerciais; admin vê todas, com rótulo próprio", async () => {
    const gerente = await html(Layout({ children: createElement("p", null, "filho") }));
    expect(gerente).toContain(">/configuracao/whatsapp/comercial,/configuracao/whatsapp/reguas<");
    mocks.papeis.valor = [Papel.ADMINISTRADOR];
    const admin = await html(Layout({ children: createElement("p", null, "filho") }));
    expect(admin).toContain("/configuracao/whatsapp/numeros,/configuracao/whatsapp/templates,/configuracao/whatsapp/politica,/configuracao/whatsapp/avisos-agenda,/configuracao/whatsapp/comercial,/configuracao/whatsapp/reguas");
    expect(admin).toContain('aria-label="Seções do WhatsApp"');
    expect(admin).toContain("<p>filho</p>");
  });

  it("gerente pedindo uma seção do canal direto: acesso negado e nenhuma consulta (o layout não basta)", async () => {
    for (const secao of [Numeros, Templates, Politica, AvisosAgenda]) {
      expect(await html(secao())).toContain("Acesso negado");
    }
    for (const m of consultasAdmin()) expect(m).not.toHaveBeenCalled();
  });

  it("comercial: preferência de fuso entregue ao painel; só as consultas desta seção", async () => {
    const pagina = await html(Comercial());
    expect(pagina).toContain('data-comercial-fuso="America/Costa_Rica"');
    expect(mocks.comercial).toHaveBeenCalledTimes(1);
    for (const m of [mocks.reguas, mocks.templatesResumo, mocks.ensaio, ...consultasAdmin()]) expect(m).not.toHaveBeenCalled();
  });

  it("régua comercial: preferência de fuso entregue ao painel; só as consultas desta seção", async () => {
    const pagina = await html(Reguas());
    expect(pagina).toContain('data-regua-fuso="America/Costa_Rica"');
    expect(mocks.reguas).toHaveBeenCalledTimes(1);
    for (const m of [mocks.comercial, mocks.saudacoes, mocks.metricasIA, ...consultasAdmin()]) expect(m).not.toHaveBeenCalled();
  });

  it("sem papel, as seções comerciais negam antes de ler a preferência ou os dados", async () => {
    mocks.papeis.valor = [Papel.VENDEDOR];
    expect(await html(Comercial())).toContain("Acesso negado");
    expect(await html(Reguas())).toContain("Acesso negado");
    for (const m of consultasComerciais()) expect(m).not.toHaveBeenCalled();
  });

  it("admin: cada seção do canal carrega só o que mostra", async () => {
    mocks.papeis.valor = [Papel.ADMINISTRADOR];
    expect(await html(Numeros())).toContain("admin números");
    expect(mocks.numeros).toHaveBeenCalledTimes(1);
    expect(mocks.vendedores).toHaveBeenCalledTimes(1);
    expect(mocks.templates).not.toHaveBeenCalled();
    expect(await html(Templates())).toContain("admin templates");
    expect(await html(Politica())).toContain("admin política");
    expect(await html(AvisosAgenda())).toContain("admin avisos");
    expect(mocks.avisos).toHaveBeenCalledTimes(1);
    for (const m of consultasComerciais()) expect(m).not.toHaveBeenCalled();
  });
});
