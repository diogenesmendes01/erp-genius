import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";

const m = vi.hoisted(() => ({ sessao: vi.fn(), preparo: vi.fn(), impactos: vi.fn(), formulario: vi.fn(), operacao: vi.fn(), cabecalho: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: m.sessao }));
vi.mock("@/server/matricula/cabecalho", () => ({ consultarCabecalhoMatricula: m.cabecalho }));
vi.mock("@/server/contratos/aditivo-cobertura-consulta", () => ({ consultarPreparoCoberturaAditivo: m.preparo, consultarImpactosCoberturaAditivo: m.impactos }));
vi.mock("../../ImpactosCoberturaFormulario", () => ({ ImpactosCoberturaFormulario: m.formulario }));
vi.mock("../../ImpactosCoberturaOperacao", () => ({ ImpactosCoberturaOperacao: m.operacao }));
import Page from "./page";

const politica = { escolha: "PRESERVAR_REFERENCIA" as const };
const preparoPronto = { ok: true as const, dado: { estado: "PRONTA" as const, conclusaoId: "fim", revisaoHash: "a".repeat(64), politica, cobrancas: [] } };
function contemTipo(no: unknown, tipo: unknown): boolean {
  if (Array.isArray(no)) return no.some(item => contemTipo(item, tipo));
  if (!no || typeof no !== "object") return false;
  const elemento = no as { type?: unknown; props?: { children?: unknown } };
  return elemento.type === tipo || contemTipo(elemento.props?.children, tipo);
}

beforeEach(() => vi.resetAllMocks());

it("protege a rota financeira antes de expor o preparo e a operação", async () => {
  m.preparo.mockResolvedValue(preparoPronto); m.impactos.mockResolvedValue({ ok: true, dado: null });
  const tela = await Page({ params: Promise.resolve({ matriculaId: "m", propostaId: "p" }) });
  expect(m.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  expect(m.preparo).toHaveBeenCalledWith({ matriculaId: "m", propostaId: "p" });
  expect(contemTipo(tela, m.formulario)).toBe(true);
  expect(contemTipo(tela, m.operacao)).toBe(true);
});

it("não oferece novo preparo quando já existe conjunto ativo", async () => {
  m.preparo.mockResolvedValue(preparoPronto);
  m.impactos.mockResolvedValue({ ok: true, dado: { status: "PENDENTE" } });
  const tela = await Page({ params: Promise.resolve({ matriculaId: "m", propostaId: "p" }) });
  expect(contemTipo(tela, m.formulario)).toBe(false);
  expect(contemTipo(tela, m.operacao)).toBe(true);
});

it("identifica aluno e matrícula pelo código, não pelo id da URL (docs/43 §6 item 7)", async () => {
  m.sessao.mockResolvedValue({ id: "fin", papeis: [Papel.FINANCEIRO] });
  m.preparo.mockResolvedValue({ ok: true, dado: { estado: "BLOQUEADA", mensagem: "Aguardando conclusão." } });
  m.impactos.mockResolvedValue({ ok: true, dado: { status: "PENDENTE" } });
  m.operacao.mockReturnValue(null);
  m.cabecalho.mockResolvedValue({ id: "matricula-interna", codigo: "M-000123", status: "ATIVA", alunoId: "a1", aluno: "Ana Silva", produto: "Inglês · Regular" });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ matriculaId: "matricula-interna", propostaId: "p" }) }));
  expect(m.cabecalho).toHaveBeenCalledWith({ id: "fin", papeis: [Papel.FINANCEIRO] }, "matricula-interna");
  expect(html).toContain("<h1 class=\"text-2xl\">Correção de cobertura</h1>");
  expect(html).toContain("Matrícula: M-000123 · Inglês · Regular");
  expect(html.replace(/href="[^"]*"/g, "")).not.toContain("matricula-interna");
});

it("não confunde falha de consulta com ausência de conjunto", async () => {
  m.preparo.mockResolvedValue(preparoPronto);
  m.impactos.mockResolvedValue({ ok: false, erro: "Sessão revogada" });
  const tela = await Page({ params: Promise.resolve({ matriculaId: "m", propostaId: "p" }) });
  expect(contemTipo(tela, m.formulario)).toBe(false);
  expect(contemTipo(tela, m.operacao)).toBe(false);
});