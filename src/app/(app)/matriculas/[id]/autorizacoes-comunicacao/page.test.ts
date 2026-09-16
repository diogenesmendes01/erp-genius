import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/comunicacoes-agenda/autorizacoes", () => ({
  consultarTelaAutorizacoesComunicacaoAcademica: vi.fn(async () => ({
    matricula: { id: "m/a", codigo: "M-1", alunoNome: "Aluno" }, responsaveis: [{ id: "r", nome: "Responsável" }],
    historico: { itens: [{ id: "a", responsavelId: "r", evidencia: "Evidência registrada", vigenteEm: new Date("2026-01-01T00:00:00Z"), revogadaEm: null, motivoRevogacao: null, responsavel: { nome: "Responsável" }, autorizadaPor: { nome: "Secretaria" }, revogadaPor: null }], proximoCursor: "proxima/pagina" },
  })), registrarAutorizacaoComunicacaoAcademica: vi.fn(), revogarAutorizacaoComunicacaoAcademica: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import Page from "./page";
describe("AutorizacoesComunicacaoPage", () => { it("mostra registro e navegação do histórico paginado", async () => {
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m/a" }), searchParams: Promise.resolve({ cursor: "anterior" }) }));
  expect(html).toContain("Evidência registrada"); expect(html).toContain("/matriculas/m%2Fa/autorizacoes-comunicacao"); expect(html).toContain("cursor=proxima%2Fpagina");
}); });