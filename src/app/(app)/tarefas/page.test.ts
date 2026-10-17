import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";

const mocks = vi.hoisted(() => ({
  usuario: { valor: { id: "u1", nome: "U", papeis: ["VENDEDOR"] as string[], permissoes: [] as string[] } },
  config: vi.fn(async () => ({ fusoInstitucional: "America/Costa_Rica" }) as { fusoInstitucional: string } | null),
  itensLista: vi.fn(async () => [] as unknown[]),
  itensAgenda: vi.fn(async () => [] as unknown[]),
  notificacoes: vi.fn(async () => [] as unknown[]),
  obter: vi.fn(async () => null as unknown),
  responsaveis: vi.fn(async () => [] as unknown[]),
  fusoPref: vi.fn(async () => null as string | null),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: async () => mocks.usuario.valor }));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoOperacional: { findUnique: mocks.config } } }));
vi.mock("@/server/crm/mensagens-agendadas", () => ({ listarItensAgenda: mocks.itensAgenda }));
vi.mock("@/server/crm/notificacoes", () => ({ listarNotificacoes: mocks.notificacoes }));
vi.mock("@/server/crm/tarefas-consulta", () => ({
  listarItensLista: mocks.itensLista, obterTarefa: mocks.obter, listarResponsaveisPossiveis: mocks.responsaveis, fusoExibicaoDoUsuario: mocks.fusoPref,
}));
vi.mock("@/server/crm/tarefas-acoes", () => ({
  criarTarefa: vi.fn(), editarTarefa: vi.fn(), concluirTarefa: vi.fn(), reabrirTarefa: vi.fn(), reagendarTarefa: vi.fn(), reagendarMensagem: vi.fn(),
  cancelarTarefa: vi.fn(), assumirTarefa: vi.fn(), marcarNotificacaoLida: vi.fn(),
}));

import Page from "./page";

const t1 = {
  id: "t1", titulo: "Ligar para Maria", descricao: null, tipo: "LIGACAO", setor: "COMERCIAL", status: "ABERTA", prioridade: "NORMAL", dataCivil: "2026-10-20", inicioEm: null,
  duracaoMin: 30, fusoOrigem: "America/Costa_Rica", lembreteAntecedenciaMin: null, responsavelId: "u1", versao: 3, resultado: null, motivoCancelamento: null, responsavel: { id: "u1", nome: "U" },
};

async function renderPagina(papeis: string[], sp: Record<string, string>) {
  mocks.usuario.valor = { id: "u1", nome: "U", papeis, permissoes: [] };
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(sp) }));
}
const vendedor = ["VENDEDOR"];

describe("/tarefas (página)", () => {
  beforeEach(() => {
    mocks.obter.mockResolvedValue(null);
    mocks.config.mockResolvedValue({ fusoInstitucional: "America/Costa_Rica" });
  });

  it("guard dos papéis com tarefas", () =>
    // O helper devolve os papéis em ordem alfabética.
    expect(papeisDoGuardArquivo("src/app/(app)/tarefas/page.tsx")).toEqual(["ADMINISTRADOR", "FINANCEIRO", "GERENTE_COMERCIAL", "SECRETARIA_ACADEMICA", "VENDEDOR"]));

  it("deep link ?t= abre o painel; vendedor não vê Equipe", async () => {
    mocks.obter.mockResolvedValue(t1);
    const html = await renderPagina(vendedor, { t: "t1" });
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Ligar para Maria");
    expect(mocks.obter).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), "t1");
    expect(await renderPagina(vendedor, {})).not.toContain(">Equipe<");
  });

  it("gerente vê Minhas e Equipe e o escopo vai para a consulta", async () => {
    const html = await renderPagina(["GERENTE_COMERCIAL"], { escopo: "equipe" });
    expect(html).toContain(">Equipe<");
    expect(mocks.itensLista).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), true);
    await renderPagina(["GERENTE_COMERCIAL"], {});
    expect(mocks.itensLista).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), false);
  });

  it("?t= de tarefa fora do escopo mostra o aviso e não abre painel", async () => {
    const html = await renderPagina(vendedor, { t: "alheia" });
    expect(html).toContain("Tarefa não encontrada ou fora do seu escopo.");
    expect(html).not.toContain('role="dialog"');
  });

  it("?t=nova abre o painel de criação; visão de semana usa a agenda", async () => {
    expect(await renderPagina(vendedor, { t: "nova" })).toContain("Nova tarefa");
    mocks.itensAgenda.mockClear();
    const html = await renderPagina(vendedor, { visao: "semana", data: "2026-10-17" });
    expect(mocks.itensAgenda).toHaveBeenCalledWith(expect.anything(), { de: "2026-10-12", ate: "2026-10-18" }, false);
    expect(html).toContain('aria-label="Dia exibido"');
  });

  it("sem fuso da escola, avisa", async () => {
    mocks.config.mockResolvedValue(null);
    expect(await renderPagina(vendedor, {})).toContain("Fuso da escola não configurado");
  });
});
