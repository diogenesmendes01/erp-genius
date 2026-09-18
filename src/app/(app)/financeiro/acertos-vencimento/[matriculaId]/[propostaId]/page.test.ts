import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), versao: vi.fn(), consulta: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { versaoCondicoesAditivo: { findFirst: mocks.versao } } }));
vi.mock("@/server/contratos/vencimento-aditivo", () => ({ consultarVencimentosAditivo: mocks.consulta }));
vi.mock("./Formulario", () => ({ VencimentoFormulario: ({ modo }: { modo: string }) => createElement("span", { "data-acao": modo }, modo) }));
import Page from "./page";
const entrada = () => ({ params: Promise.resolve({ matriculaId: "m1", propostaId: "p1" }), searchParams: Promise.resolve({ pagina: "2" }) });
const dado = () => ({ versao: 2, vigenciaInicio: "2026-09-01T00:00:00Z", revisaoHash: "hash", pagina: 2, temProxima: true,
 alvo: { podePreparar: true, vencimentoProposto: "2026-11-15", pendencia: "Conferir antes de aplicar", cobranca: { id: "c1" } },
 propostas: [{ id: "acerto1", estado: "APROVADA", fuso: "America/Sao_Paulo", vencimentoAnterior: "2026-10-15T12:00:00Z", vencimentoNovo: "2026-11-15T12:00:00Z", motivo: "Alteração <script>", evidencia: "Contrato conferido", podeDecidir: false, podeSolicitarAplicacao: true, decisao: { motivo: "Conferência independente" }, aplicadaEm: null as string | null }],
});
beforeEach(() => { vi.resetAllMocks(); mocks.versao.mockResolvedValue({ id: "v1" }); mocks.consulta.mockResolvedValue({ ok: true, dado: dado() }); });
it("nega acesso antes de consultar versão e histórico", async () => {
 mocks.sessao.mockRejectedValue(new Error("Sem acesso"));
 await expect(Page(entrada())).rejects.toThrow("Sem acesso");
 expect(mocks.versao).not.toHaveBeenCalled(); expect(mocks.consulta).not.toHaveBeenCalled();
});
it("consulta matrícula/proposta exatas e renderiza aplicação sem oferecer decisão", async () => {
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(mocks.sessao).toHaveBeenCalledWith("FINANCEIRO");
 expect(mocks.versao).toHaveBeenCalledWith({ where: { matriculaId: "m1", propostaId: "p1" }, select: { id: true } });
 expect(mocks.consulta).toHaveBeenCalledWith({ matriculaId: "m1", versaoCondicoesId: "v1", pagina: 2 });
 expect(html).toContain('data-acao="aplicar"'); expect(html).not.toContain('data-acao="decidir"');
 expect(html).toContain("&lt;script&gt;"); expect(html).toContain("?pagina=1"); expect(html).toContain("?pagina=3");
});
it("mantém aplicação histórica sem repetir ação", async () => {
 const d = dado(); Object.assign(d.propostas[0], { estado: "APLICADA", podeSolicitarAplicacao: false, aplicadaEm: "2026-09-18T12:00:00Z" });
 mocks.consulta.mockResolvedValue({ ok: true, dado: d });
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(html).toContain("Aplicado em"); expect(html).not.toContain('data-acao="aplicar"');
});
it("não oferece preparação sem versão formalizada", async () => {
 mocks.versao.mockResolvedValue(null);
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(html).toContain("Formalize as condições"); expect(mocks.consulta).not.toHaveBeenCalled();
});

it("não oferece preparação quando a cobrança identificada exige conferência", async () => {
 const d = dado(); d.alvo.podePreparar = false;
 mocks.consulta.mockResolvedValue({ ok: true, dado: d });
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(html).not.toContain('data-acao="preparar"');
 expect(html).toContain(d.alvo.pendencia);
});

it("mostra pendência de acesso sem esconder aplicação financeira confirmada", async () => {
 const d = dado(); Object.assign(d.propostas[0], { estado: "APLICADA", podeSolicitarAplicacao: false, aplicadaEm: "2026-09-18T12:00:00Z", reconciliacaoAcesso: { concluida: false, tentativas: 1, erro: "Nova tentativa pendente" } });
 mocks.consulta.mockResolvedValue({ ok: true, dado: d });
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(html).toContain("Aplicado em"); expect(html).toContain("pendente de processamento");
 expect(html).toContain("Nova tentativa pendente"); expect(html).not.toContain('data-acao="aplicar"');
});
