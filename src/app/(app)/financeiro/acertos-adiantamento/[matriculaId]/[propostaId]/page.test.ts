import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), versao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn(), cabecalho: vi.fn(), fusoEscola: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/cabecalho", () => ({ consultarCabecalhoMatricula: mocks.cabecalho }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/relatorios/atendimento", () => ({ fusoDaEscola: mocks.fusoEscola }));
vi.mock("@/lib/prisma", () => ({ prisma: { versaoCondicoesAditivo: { findFirst: mocks.versao } } }));
vi.mock("@/server/contratos/adiantamento-aditivo", () => ({ consultarAdiantamentosAditivo: mocks.consulta }));
vi.mock("./Formulario", () => ({ AdiantamentoFormulario: ({ modo }: { modo: string }) => createElement("span", { "data-acao": modo }, modo) }));
import Page from "./page";
import { formatarMoeda } from "@/lib/dinheiro";
const entrada = () => ({ params: Promise.resolve({ matriculaId: "m1", propostaId: "p1" }), searchParams: Promise.resolve({ pagina: "2" }) });
const dado = () => ({ versao: 2, vigenciaInicio: "2026-09-01T00:00:00Z", revisaoHash: "hash", pagina: 2, temProxima: true,
 alvo: { podePreparar: true, pendencia: "Conferir antes de aplicar", proposto: { valor: { valor: "375", moeda: "CRC" }, minutos: 180, vencimento: "2099-09-20" },
  cobranca: { id: "c1", versao: 1, moeda: "CRC", valorAtual: "250.00", vencimentoAtual: "2099-09-10T12:00:00Z", minutosAtuais: 120 } },
 propostas: [{ id: "acerto1", estado: "APROVADA", criadaEm: "2026-09-10T15:00:00Z", fuso: "America/Sao_Paulo", moeda: "CRC", valorAnterior: "250.00", valorNovo: "375.00", minutosAnteriores: 120, minutosNovos: 180,
  vencimentoAnterior: "2099-09-10T12:00:00Z", vencimentoNovo: "2099-09-20T12:00:00Z", motivo: "Alteração <script>", evidencia: "Contrato conferido", podeDecidir: false, podeSolicitarAplicacao: true, decisao: { motivo: "Conferência independente" }, aplicadaEm: null as string | null }],
});
beforeEach(() => { vi.resetAllMocks(); mocks.fusoEscola.mockResolvedValue("America/Sao_Paulo"); mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } }); mocks.versao.mockResolvedValue({ id: "v1" }); mocks.consulta.mockResolvedValue({ ok: true, dado: dado() }); });
it("nega acesso antes de consultar versão e histórico", async () => {
 mocks.sessao.mockRejectedValue(new Error("Sem acesso"));
 await expect(Page(entrada())).rejects.toThrow("Sem acesso");
 expect(mocks.versao).not.toHaveBeenCalled(); expect(mocks.consulta).not.toHaveBeenCalled(); expect(mocks.cabecalho).not.toHaveBeenCalled();
});
it("identifica aluno e matrícula pelo código; nem a matrícula nem a proposta saem como id (docs/43 §6 item 7)", async () => {
 mocks.sessao.mockResolvedValue({ id: "fin", papeis: ["FINANCEIRO"] });
 mocks.cabecalho.mockResolvedValue({ id: "m1", codigo: "M-000123", status: "ATIVA", alunoId: "a1", aluno: "Ana Silva", produto: "Inglês · Particular" });
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(mocks.cabecalho).toHaveBeenCalledWith({ id: "fin", papeis: ["FINANCEIRO"] }, "m1");
 expect(html).toContain('aria-label="Aluno e matrícula deste acerto"');
 expect(html).toContain("Matrícula: M-000123 · Inglês · Particular");
 expect(html.replace(/href="[^"]*"/g, "")).not.toMatch(/Matrícula m1|acerto1/);
});
it("consulta matrícula/proposta exatas, mostra condições e orienta que a comissão não é recalculada", async () => {
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(mocks.sessao).toHaveBeenCalledWith("FINANCEIRO");
 expect(mocks.versao).toHaveBeenCalledWith({ where: { matriculaId: "m1", propostaId: "p1" }, select: { id: true } });
 expect(mocks.consulta).toHaveBeenCalledWith({ matriculaId: "m1", versaoCondicoesId: "v1", pagina: 2 });
 expect(html).toContain(`Valor: ${formatarMoeda("375", "CRC")}`); expect(html).toContain(`${formatarMoeda("250.00", "CRC")} → ${formatarMoeda("375.00", "CRC")}`); expect(html).toContain("180 min (3 h)"); expect(html).toContain("20/09/2099");
 expect(html).toContain(`Adiantamento emitido: ${formatarMoeda("250.00", "CRC")} · 120 min (2 h).`);
 expect(html).toContain("A comissão não é recalculada.");
 expect(html).toContain('data-acao="preparar"'); expect(html).toContain('data-acao="aplicar"'); expect(html).not.toContain('data-acao="decidir"');
 expect(html).toContain("&lt;script&gt;"); expect(html).toContain("?pagina=1"); expect(html).toContain("?pagina=3");
});
it("recusa com orientação: sem preparação e com a pendência do servidor", async () => {
 const d = dado(); d.alvo.podePreparar = false; d.alvo.pendencia = "O adiantamento já recebeu pagamento ou crédito.";
 mocks.consulta.mockResolvedValue({ ok: true, dado: d });
 const html = renderToStaticMarkup(await Page(entrada()));
 expect(html).not.toContain('data-acao="preparar"'); expect(html).toContain(d.alvo.pendencia);
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
it("sem propostas, mostra o estado vazio", async () => {
 const d = dado(); d.propostas = [];
 mocks.consulta.mockResolvedValue({ ok: true, dado: d });
 expect(renderToStaticMarkup(await Page(entrada()))).toContain("Nenhuma proposta de acerto registrada.");
});

// Lote 3 do fuso pessoal nas telas: sem preferência, registro e aplicação no fuso da ESCOLA (antes, UTC), com o fuso
// escrito; o vencimento é data civil gravada, no fuso em que o acerto foi preparado. Expectativas fixas (TZ=UTC e SP).
it("registro e aplicação: sem preferência, o fuso da escola; com preferência, a pessoal; vencimento como data civil", async () => {
 const d = dado(); Object.assign(d.propostas[0], { criadaEm: "2026-09-11T02:30:00Z", aplicadaEm: "2026-09-19T01:00:00Z", estado: "APLICADA", podeSolicitarAplicacao: false });
 mocks.consulta.mockResolvedValue({ ok: true, dado: d });
 mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: null } });
 let html = renderToStaticMarkup(await Page(entrada()));
 expect(html).toContain("Proposta de 10/09/2026, 23:30 (horário exibido em America/Sao_Paulo)");
 expect(html).toContain("Aplicado em 18/09/2026, 22:00 (horário exibido em America/Sao_Paulo).");
 expect(html).not.toContain("origem UTC");
 mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "Asia/Tokyo" } });
 html = renderToStaticMarkup(await Page(entrada()));
 expect(html).toContain("Proposta de 11/09/2026, 11:30 (horário exibido em Asia/Tokyo)");
});
