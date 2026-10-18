import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  salvarMeta: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/guards", () => ({ exigirPapelLeitura: async () => true }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: async () => ({ id: "g1", nome: "G", papeis: ["GERENTE_COMERCIAL"], permissoes: [] }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: async () => [] } } }));
vi.mock("@/server/relatorios/escopo", () => ({ escopoRelatorio: async () => ({ tipo: "USUARIOS", ids: ["g1"] }) }));
vi.mock("@/server/relatorios/atendimento", () => ({ fusoDaEscola: async () => "America/Sao_Paulo" }));
vi.mock("@/server/metas/metas", () => ({ progressoMetas: async () => [], salvarMeta: mocks.salvarMeta }));

import Page from "./page";
import { definirMeta } from "./acoes";

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

async function destinoDe(p: Promise<unknown>): Promise<string> {
  const erro = (await p.then(() => null, (e: unknown) => e)) as { url?: string } | null;
  expect(erro?.url, "a ação deve redirecionar").toBeDefined();
  return erro!.url!;
}

describe("/configuracao/crm/metas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erro_de_validacao_volta_para_a_tela_com_a_mensagem", async () => {
    mocks.salvarMeta.mockResolvedValue({ ok: false, erro: "Informe a moeda da meta de valor ganho." });
    const url = await destinoDe(definirMeta(form({ competencia: "2026-10", usuarioId: "", metrica: "VALOR_GANHO", valor: "100" })));
    expect(url.startsWith("/configuracao/crm/metas?")).toBe(true);
    expect(new URLSearchParams(url.split("?")[1]).get("erro")).toBe("Informe a moeda da meta de valor ganho.");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("sucesso_revalida_e_avisa_salvo", async () => {
    mocks.salvarMeta.mockResolvedValue({ ok: true });
    const url = await destinoDe(definirMeta(form({ competencia: "2026-10", usuarioId: "v1", metrica: "MATRICULAS", valor: "12,5" })));
    expect(url).toBe("/configuracao/crm/metas?salvo=1");
    expect(mocks.salvarMeta).toHaveBeenCalledWith({ competencia: "2026-10", usuarioId: "v1", metrica: "MATRICULAS", valor: 12.5, moeda: undefined });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/configuracao/crm/metas");
  });

  it("tela_mostra_o_erro_da_url_em_alerta", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ erro: "Você só define metas da sua equipe." }) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Meta não salva: Você só define metas da sua equipe.");
    expect(html).not.toContain("Meta salva.");
  });

  it("tela_mostra_confirmacao_e_nada_sem_retorno", async () => {
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ salvo: "1" }) }))).toContain("Meta salva.");
    const limpo = renderToStaticMarkup(await Page());
    expect(limpo).not.toContain('role="alert"');
    expect(limpo).not.toContain("Meta salva.");
  });
});
