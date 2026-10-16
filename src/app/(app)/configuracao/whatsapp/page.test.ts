import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// Configuração do WhatsApp por rota (E8): índice → primeira seção da função; layout com as abas da
// função; cada seção com o PRÓPRIO guard antes das consultas e só as consultas dela.
const mocks = vi.hoisted(() => ({
  papeis: { valor: ["GERENTE_COMERCIAL"] as string[] },
  redirect: vi.fn((destino: string) => { throw new Error(`REDIRECT ${destino}`); }),
  preferencia: vi.fn(), numeros: vi.fn(), templates: vi.fn(), politica: vi.fn(),
  vendedores: vi.fn(), avisos: vi.fn(), responsaveis: vi.fn(),
  subtabs: vi.fn((props: { tabs: { href: string }[]; ariaLabel?: string }) => createElement("nav", { "aria-label": props.ariaLabel }, props.tabs.map((t) => t.href).join(","))),
}));
vi.mock("@/lib/guards", () => ({
  exigirPapelLeitura: async (...alvo: string[]) => (mocks.papeis.valor.includes("ADMINISTRADOR") || alvo.some((p) => mocks.papeis.valor.includes(p)) ? mocks.papeis.valor : null),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/AcessoNegado", () => ({ AcessoNegado: () => createElement("p", null, "Acesso negado") }));
vi.mock("@/components/SubTabs", () => ({ SubTabs: mocks.subtabs }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/comercial/consultas", () => ({ listarVendedores: mocks.vendedores }));
vi.mock("@/server/whatsapp/consultas", () => ({
  listarNumerosConfig: mocks.numeros, listarResponsaveisTriagem: mocks.responsaveis, listarTemplatesConfig: mocks.templates,
  carregarPoliticaConfig: mocks.politica, carregarConfiguracaoAvisosAgenda: mocks.avisos,
}));
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

const html = async (el: Promise<React.ReactElement>) => renderToStaticMarkup(await el);
const consultasAdmin = () => [mocks.numeros, mocks.templates, mocks.politica, mocks.vendedores, mocks.avisos, mocks.responsaveis];

describe("Configuração do WhatsApp por rota (E8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.papeis.valor = [Papel.GERENTE_COMERCIAL];
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    for (const m of consultasAdmin()) m.mockResolvedValue([]);
  });

  it("índice: gerente comercial sem seção vai para a Home, não para Acesso negado; admin vai a Números", async () => {
    await expect(Indice()).rejects.toThrow("REDIRECT /home");
    mocks.papeis.valor = [Papel.ADMINISTRADOR];
    await expect(Indice()).rejects.toThrow("REDIRECT /configuracao/whatsapp/numeros");
  });

  it("índice e layout negam quem não é admin nem gerente comercial", async () => {
    mocks.papeis.valor = [Papel.VENDEDOR];
    expect(await html(Indice() as Promise<React.ReactElement>)).toContain("Acesso negado");
    expect(await html(Layout({ children: createElement("p", null, "filho") }))).toContain("Acesso negado");
  });

  it("layout: gerente não vê aba; admin vê as quatro seções do canal", async () => {
    expect(await html(Layout({ children: createElement("p", null, "filho") }))).toContain('<nav aria-label="Seções do WhatsApp"></nav>');
    mocks.papeis.valor = [Papel.ADMINISTRADOR];
    expect(await html(Layout({ children: createElement("p", null, "filho") }))).toContain(">/configuracao/whatsapp/numeros,/configuracao/whatsapp/templates,/configuracao/whatsapp/politica,/configuracao/whatsapp/avisos-agenda<");
  });

  it("gerente pedindo uma seção do canal direto: acesso negado e nenhuma consulta (o layout não basta)", async () => {
    for (const secao of [Numeros, Templates, Politica, AvisosAgenda]) {
      expect(await html(secao())).toContain("Acesso negado");
    }
    for (const m of consultasAdmin()) expect(m).not.toHaveBeenCalled();
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
  });
});
