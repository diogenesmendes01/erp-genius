import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn(), professores: vi.fn(), config: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/agenda/indisponibilidade-consulta", () => ({ consultarIndisponibilidadesDocentes: mocks.consultar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: mocks.professores }, configuracaoOperacional: { findUnique: mocks.config } } }));
vi.mock("./SolicitarAusencia", () => ({ SolicitarAusencia: () => null }));
vi.mock("./DecisaoAusencia", () => ({ DecisaoAusencia: () => null }));

import Page from "./page";

const item = { id: "a1", professorId: "p1", professorNome: "Ana", inicio: "2026-10-01T12:00:00.000Z", fim: "2026-10-01T13:00:00.000Z", fusoOrigem: "UTC", motivo: "Consulta médica", preparadorId: "p1", criadoEm: "2026-09-01T12:00:00.000Z", situacao: "REJEITADA", podeDecidir: false, decisao: { decisorId: "g", motivo: "Sem cobertura", decididaEm: "2026-09-02T12:00:00.000Z", encontrosNaDecisao: [], reservasNaDecisao: [] }, impactoHash: null, reservasParaConferencia: [], reservasPendentes: [], encontrosParaConferencia: [], encontrosPendentes: [] };
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/academico/indisponibilidades — paginação nos dois sentidos (E4)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "g", papeis: ["GERENTE_PEDAGOGICO"] });
    mocks.professores.mockResolvedValue([]);
    mocks.config.mockResolvedValue({ fusoInstitucional: "UTC" });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  });

  it("primeira página: só Próxima, sem link para si mesma", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 1, temProxima: true } });
    const html = await render({});
    expect(mocks.consultar).toHaveBeenCalledWith({ pagina: 1 });
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina=1");
    expect(html).toContain('href="/academico/indisponibilidades?pagina=2">Próxima');
  });

  it("no meio, os dois sentidos; da segunda, Anterior volta sem ?pagina=1 e a última não tem Próxima", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 3, temProxima: true } });
    const meio = await render({ pagina: "3" });
    expect(mocks.consultar).toHaveBeenCalledWith({ pagina: 3 });
    expect(meio).toContain('href="/academico/indisponibilidades?pagina=2">← Anterior');
    expect(meio).toContain('href="/academico/indisponibilidades?pagina=4">Próxima');
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 2, temProxima: false } });
    const ultima = await render({ pagina: "2" });
    expect(ultima).toContain('href="/academico/indisponibilidades">← Anterior');
    expect(ultima).not.toContain("Próxima");
  });
});
