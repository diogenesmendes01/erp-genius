import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";
import { configPadrao } from "@/server/aria/config-schema";

const mocks = vi.hoisted(() => ({
  usuario: { valor: { id: "u1", nome: "U", papeis: ["ADMINISTRADOR"] as string[], permissoes: [] as string[] } },
  carregar: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: async () => mocks.usuario.valor }));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoOperacional: { findUnique: async () => ({ fusoInstitucional: "America/Sao_Paulo" }) } } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/aria/tela", async (original) => ({ ...(await original<typeof import("@/server/aria/tela")>()), carregarTelaAria: mocks.carregar }));
vi.mock("@/server/aria/versoes", () => ({ salvarRascunho: vi.fn(), publicarRascunho: vi.fn(), descartarRascunho: vi.fn() }));
vi.mock("@/server/aria/estado", () => ({ definirEstadoAria: vi.fn(), pausarAria: vi.fn(), reativarAria: vi.fn(), definirSupervisao: vi.fn() }));
vi.mock("@/server/aria/playground", () => ({ testarAria: vi.fn() }));
vi.mock("@/server/aria/historico", () => ({ aprovarAcaoAria: vi.fn(), rejeitarAcaoAria: vi.fn(), desfazerAcaoAria: vi.fn() }));
vi.mock("@/server/aria/conhecimento/fontes", () => ({ criarFonteTexto: vi.fn(), arquivarFonte: vi.fn() }));

import Page from "./page";

const visao = {
  conversas: 12, taxaHandoff: 0.25, etapasAvancadas: 3, tarefasCriadas: 2, camposPreenchidos: 5,
  tempoMedioAteHandoffMin: 8, aprovadasSemEdicao: 0.9, desfeitas: 0.02, custoUsd: 1.5, volume: [],
};
function dados(extra: Record<string, unknown> = {}) {
  const config = configPadrao();
  return {
    estado: "ATIVA", pausada: false, motivoPausa: null, supervisao: false,
    publicada: { id: "v1", numero: 1, config }, rascunho: null, config, diff: [],
    visao, historico: { itens: [], proximo: null }, fontes: [], paises: null, ...extra,
  };
}
async function render(o: { papel: string; aba?: string; pausada?: boolean; publicada?: null }) {
  mocks.usuario.valor = { id: "u1", nome: "U", papeis: [o.papel], permissoes: [] };
  mocks.carregar.mockResolvedValue(dados({
    ...(o.pausada ? { pausada: true, motivoPausa: "Revisão" } : {}),
    ...(o.publicada === null ? { publicada: null } : {}),
  }));
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(o.aba ? { aba: o.aba } : {}) }));
}

describe("/aria (página)", () => {
  beforeEach(() => mocks.carregar.mockReset());

  it("guard_admin_e_gerente", () => {
    expect(papeisDoGuardArquivo("src/app/(app)/aria/page.tsx")).toEqual(["ADMINISTRADOR", "GERENTE_COMERCIAL"]);
  });

  it("gerente_ve_matriz_somente_leitura", async () => {
    const html = await render({ papel: "GERENTE_COMERCIAL", aba: "permissoes" });
    expect(html).toContain("Só um Admin altera o que a Aria pode fazer");
    expect(html).not.toContain('data-acao="ciclar-celula"');
  });

  it("admin_edita_a_matriz", async () => {
    const html = await render({ papel: "ADMINISTRADOR", aba: "permissoes" });
    expect(html).toContain('data-acao="ciclar-celula"');
    expect(html).not.toContain("Só um Admin altera");
  });

  it("gerente_sem_link_de_provedor", async () => {
    expect(await render({ papel: "GERENTE_COMERCIAL", aba: "visao" })).not.toContain("Provedor e modelo");
    expect(await render({ papel: "ADMINISTRADOR", aba: "visao" })).toContain("Provedor e modelo");
  });

  it("faixa_de_pausa", async () => {
    expect(await render({ papel: "ADMINISTRADOR", pausada: true })).toContain("Novas conversas vão para a fila do Comercial");
  });

  it("nunca_publicada_mostra_primeira_configuracao", async () => {
    expect(await render({ papel: "ADMINISTRADOR", publicada: null })).toContain("A Aria ainda não foi publicada");
    expect(await render({ papel: "ADMINISTRADOR" })).not.toContain("A Aria ainda não foi publicada");
  });

  it("aba_vem_da_url_e_cai_em_visao_quando_invalida", async () => {
    expect(await render({ papel: "ADMINISTRADOR", aba: "handoff" })).toContain("Quando passar para uma pessoa");
    expect(await render({ papel: "ADMINISTRADOR", aba: "inexistente" })).toContain("Conversas atendidas");
    expect(mocks.carregar).toHaveBeenLastCalledWith(expect.anything(), "visao", expect.anything());
  });

  it("interruptores_tem_role_switch_e_aria_checked", async () => {
    const html = await render({ papel: "ADMINISTRADOR", aba: "handoff" });
    expect(html).toMatch(/role="switch"[^>]*aria-checked="(true|false)"/);
  });

  it("edicao_so_no_desktop_com_aviso_no_celular", async () => {
    const html = await render({ papel: "ADMINISTRADOR", aba: "comportamento" });
    expect(html).toContain("Edite a configuração da Aria no computador");
    expect(html).toContain("max-md:hidden");
  });

  it("barra_de_publicar_so_com_diferencas", async () => {
    mocks.usuario.valor = { id: "u1", nome: "U", papeis: ["ADMINISTRADOR"], permissoes: [] };
    mocks.carregar.mockResolvedValue(dados({ diff: ["nome"] }));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Alterações não publicadas");
    expect(await render({ papel: "ADMINISTRADOR" })).not.toContain("Alterações não publicadas");
  });

  it("playground_mostra_selo_de_simulacao", async () => {
    mocks.usuario.valor = { id: "u1", nome: "U", papeis: ["ADMINISTRADOR"], permissoes: [] };
    mocks.carregar.mockResolvedValue(dados({ paises: [{ id: "p1", nome: "Costa Rica" }] }));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ aba: "playground" }) }));
    expect(html).toContain("SIMULAÇÃO · nada é enviado nem alterado");
    expect(html).toContain("Costa Rica");
  });

  it("historico_mostra_quem_decidiu", async () => {
    mocks.usuario.valor = { id: "u1", nome: "U", papeis: ["ADMINISTRADOR"], permissoes: [] };
    mocks.carregar.mockResolvedValue(dados({
      historico: { itens: [{ id: "a1", quando: "2026-10-18T12:00:00.000Z", acao: "TAG", contato: "Ana", etapa: "NOVO", confianca: 90, status: "APROVADA", podeDesfazer: true, motivoIrreversivel: null, decididaPor: "Bruno" }], proximo: null },
    }));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ aba: "historico" }) }));
    expect(html).toContain("Bruno");
    expect(html).toContain("md:hidden"); // cartões no celular
    expect(html).toContain('aria-label="Desfazer Aplicar tag de Ana"');
  });
});
