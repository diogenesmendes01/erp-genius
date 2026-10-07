import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: vi.fn() }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: vi.fn(async () => ({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } })) }));
vi.mock("@/server/comunicacoes-agenda/autorizacoes", () => ({
  consultarTelaAutorizacoesComunicacaoAcademica: vi.fn(async () => ({
    matricula: { id: "m/a", codigo: "M-1", alunoNome: "Aluno" }, responsaveis: [{ id: "r", nome: "Responsável" }],
    historico: { itens: [{ id: "a", responsavelId: "r", evidencia: "Evidência registrada", vigenteEm: new Date("2026-01-01T00:00:00Z"), revogadaEm: null, motivoRevogacao: null, responsavel: { nome: "Responsável" }, autorizadaPor: { nome: "Secretaria" }, revogadaPor: null }], proximoCursor: "proxima/pagina" },
  })), registrarAutorizacaoComunicacaoAcademica: vi.fn(), revogarAutorizacaoComunicacaoAcademica: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import Page from "./page";
import { consultarTelaAutorizacoesComunicacaoAcademica } from "@/server/comunicacoes-agenda/autorizacoes";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
describe("AutorizacoesComunicacaoPage", () => { it("mostra registro e navegação do histórico paginado", async () => {
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m/a" }), searchParams: Promise.resolve({ cursor: "anterior" }) }));
  expect(html).toContain("Evidência registrada"); expect(html).toContain("31/12/2025, 18:00 (horário exibido em America/Costa_Rica; origem UTC)"); expect(html).toContain("/matriculas/m%2Fa/autorizacoes-comunicacao"); expect(html).toContain("cursor=proxima%2Fpagina");
}); });

// Integração da #151 (B4): a consulta e a preparação dos dados ficam no try (o JSX foi montado fora dele por
// react-hooks/error-boundaries); falha na consulta continua virando o alerta da tela, não o error.tsx.
describe("AutorizacoesComunicacaoPage — falha na consulta", () => {
  const ALERTA = `<p role="alert">Não foi possível consultar as autorizações desta matrícula.</p>`;
  const render = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m/a" }), searchParams: Promise.resolve({}) }));
  it("a tela das autorizações falha: só o alerta", async () => {
    vi.mocked(consultarTelaAutorizacoesComunicacaoAcademica).mockRejectedValueOnce(new Error("banco indisponível"));
    expect(await render()).toBe(ALERTA);
  });
  it("a preferência de fuso falha: o mesmo alerta", async () => {
    vi.mocked(consultarPreferenciaFusoEquipe).mockRejectedValueOnce(new Error("banco indisponível"));
    expect(await render()).toBe(ALERTA);
  });
});
