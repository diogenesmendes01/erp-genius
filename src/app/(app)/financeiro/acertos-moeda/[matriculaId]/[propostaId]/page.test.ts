import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), versao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn(), cabecalho: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/cabecalho", () => ({ consultarCabecalhoMatricula: mocks.cabecalho }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/lib/prisma", () => ({ prisma: { versaoCondicoesAditivo: { findFirst: mocks.versao } } }));
vi.mock("@/server/contratos/moeda-aditivo", () => ({ consultarMoedasAditivo: mocks.consulta }));
vi.mock("./Formulario", () => ({ MoedaFormulario: ({ modo }: { modo: string }) => createElement("span", { "data-acao": modo }, modo) }));
import Page from "./page";
const entrada = () => ({ params: Promise.resolve({ matriculaId: "m1", propostaId: "p1" }), searchParams: Promise.resolve({ pagina: "2" }) });
const dado = () => ({ versao: 2, vigenciaInicio: "2026-09-01T00:00:00Z", revisaoHash: "hash", pagina: 2, temProxima: true, aplicada: false,
 alvo: { moedaAtual: "CRC", moedaNova: "USD" as string | null, fuso: "America/Sao_Paulo" as string | null, podePreparar: true, pendencia: "A troca de moeda exige proposta de acerto e aprovação financeira independente antes da aplicação.", pendencias: [] as { codigo: string; texto: string }[] },
 propostas: [{ id: "troca1", estado: "APROVADA", criadaEm: "2026-09-10T15:00:00Z", moedaAnterior: "CRC", moedaNova: "USD", fuso: "America/Sao_Paulo", motivo: "Troca <script>", evidencia: "Contrato conferido",
  podeDecidir: false, podeSolicitarAplicacao: true, decisao: { aprovada: true, motivo: "Conferência independente", decididaEm: "2026-09-11T12:00:00Z" }, aplicadaEm: null as string | null }],
});
beforeEach(() => { vi.resetAllMocks(); mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } }); mocks.versao.mockResolvedValue({ id: "v1" }); mocks.consulta.mockResolvedValue({ ok: true, dado: dado() }); });
it("nega acesso antes de consultar versão e histórico", async () => {
 mocks.sessao.mockRejectedValue(new Error("Sem acesso"));
 await expect(Page(entrada())).rejects.toThrow("Sem acesso");
 expect(mocks.versao).not.toHaveBeenCalled(); expect(mocks.consulta).not.toHaveBeenCalled(); expect(mocks.cabecalho).not.toHaveBeenCalled();
});
it("identifica aluno e matrícula pelo código; nem a matrícula nem a proposta saem como id (docs/43 §6 item 7)", async () => {
 mocks.sessao.mockResolvedValue({ id: "fin", papeis: ["FINANCEIRO"] });
 mocks.cabecalho.mockResolvedValue({ id: "m1", codigo: "M-000123", status: "ATIVA", alunoId: "a1", aluno: "Ana Silva", produto: "Inglês · Mensal" });
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(mocks.cabecalho).toHaveBeenCalledWith({ id: "fin", papeis: ["FINANCEIRO"] }, "m1");
 expect(html).toContain("Matrícula: M-000123 · Inglês · Mensal");
 expect(html.replace(/href="[^"]*"/g, "")).not.toMatch(/Matrícula m1|troca1/);
});
it("consulta matrícula/proposta exatas, explica que nada é convertido e mostra o dia da vigência no fuso da escola", async () => {
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(mocks.sessao).toHaveBeenCalledWith("FINANCEIRO");
 expect(mocks.versao).toHaveBeenCalledWith({ where: { matriculaId: "m1", propostaId: "p1" }, select: { id: true } });
 expect(mocks.consulta).toHaveBeenCalledWith({ matriculaId: "m1", versaoCondicoesId: "v1", pagina: 2 });
 // 2026-09-01T00:00Z é 31/08 em São Paulo: o dia civil é o da escola, não o UTC nem o fuso pessoal.
 expect(html).toContain("Dia da vigência na escola: 31/08/2026 (America/Sao_Paulo)");
 expect(html).toContain("nada é convertido"); expect(html).toContain("Moeda atual: CRC · Moeda contratada: USD");
 expect(html).toContain("CRC → USD · fuso da escola na preparação: America/Sao_Paulo");
 expect(html).toContain('data-acao="preparar"'); expect(html).toContain('data-acao="aplicar"'); expect(html).not.toContain('data-acao="decidir"');
 expect(html).toContain("&lt;script&gt;"); expect(html).toContain("?pagina=1"); expect(html).toContain("?pagina=3");
});
it("lista o que impede a matrícula de estar limpa e não oferece preparação", async () => {
 const d = dado(); Object.assign(d.alvo, { podePreparar: false, pendencia: "A troca de moeda exige a matrícula sem pendências na moeda anterior.", pendencias: [{ codigo: "COBRANCA_EM_ABERTO", texto: "Há cobrança em aberto na moeda anterior." }] });
 mocks.consulta.mockResolvedValue({ ok: true, dado: d });
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(html).not.toContain('data-acao="preparar"'); expect(html).toContain(d.alvo.pendencia); expect(html).toContain("Há cobrança em aberto na moeda anterior.");
});
it("troca aplicada fica como histórico sem repetir ação", async () => {
 const d = dado(); Object.assign(d, { aplicada: true, alvo: null }); Object.assign(d.propostas[0], { estado: "APLICADA", podeSolicitarAplicacao: false, aplicadaEm: "2026-09-18T12:00:00Z" });
 mocks.consulta.mockResolvedValue({ ok: true, dado: d });
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(html).toContain("já foi aplicada"); expect(html).toContain("Aplicada em"); expect(html).not.toContain('data-acao="aplicar"'); expect(html).not.toContain('data-acao="preparar"');
});
it("não oferece preparação sem versão formalizada", async () => {
 mocks.versao.mockResolvedValue(null);
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(html).toContain("Formalize as condições"); expect(mocks.consulta).not.toHaveBeenCalled();
});
it("sem propostas, mostra o estado vazio", async () => {
 const d = dado(); d.propostas = [];
 mocks.consulta.mockResolvedValue({ ok: true, dado: d });
 expect(renderToStaticMarkup(await Page(entrada()))).toContain("Nenhuma proposta de troca registrada.");
});
