import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), tem: vi.fn(), ficha: vi.fn(), resumo: vi.fn(), informes: vi.fn(), usuario: vi.fn(), contexto: vi.fn(), propostas: vi.fn(), preferencia: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("não encontrado"); }) }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao, temPapel: mocks.tem }));
vi.mock("@/server/ajustes/consultas", () => ({ obterFichaFinanceira: mocks.ficha, obterResumoComercialFinanceiro: mocks.resumo }));
vi.mock("@/server/financeiro/consultas", () => ({ listarInformesPagamento: mocks.informes }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUniqueOrThrow: mocks.usuario } } }));
vi.mock("@/server/retomada/consultas", () => ({ listarContextoRetomada: mocks.contexto, listarPropostasRetomada: mocks.propostas }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/lib/nome", () => ({ nomeCompleto: () => "Ana Aluna" }));
vi.mock("./FichaFinanceira", () => ({ FichaFinanceira: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao?: string | null }) => createElement("p", { "data-ficha": preferenciaFusoExibicao ?? "UTC" }, "ficha") }));
vi.mock("./ResumoFinanceiroComercial", () => ({ ResumoFinanceiroComercial: () => null }));
vi.mock("./ConcluirMatriculas", () => ({ ConcluirMatriculas: () => null }));
vi.mock("@/app/(app)/financeiro/InformesPagamento", () => ({ InformesPagamento: () => null }));
vi.mock("@/app/(app)/financeiro/RetomadasPainel", () => ({ RetomadasPainel: () => null }));
vi.mock("@/app/(app)/financeiro/AcessoAulasPainel", () => ({ AcessoAulasPainel: ({ alunoId, preferenciaFusoExibicao }: { alunoId: string; preferenciaFusoExibicao: string | null }) => createElement("p", { "data-acesso": `${alunoId}:${preferenciaFusoExibicao ?? "UTC"}` }) }));

import Page from "./page";

const ficha = { aluno: { id: "aluno", codigo: "A-1", pais: { nome: "Brasil" }, matriculas: [{ id: "matricula", codigo: "M-1", status: "ATIVA", moeda: "BRL", produto: { idioma: { nome: "Inglês" }, modalidade: { nome: "Mensal" } } }] }, responsavelFinanceiro: null, emAtraso: [], proximo: null, ultimoPago: null, emAberto: [], acessoBloqueado: false, historico: [], cobrancas: [], referenciaVencimentoPorCobranca: new Map(), reguaPorCobranca: new Map(), ajustes: [], comissoes: [] } as never;

describe("FichaFinanceiraPage acesso a aulas", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "financeiro", papeis: [Papel.FINANCEIRO] });
    mocks.tem.mockImplementation((_: unknown, ...papeis: Papel[]) => papeis.includes(Papel.FINANCEIRO));
    mocks.ficha.mockResolvedValue(ficha); mocks.informes.mockResolvedValue([]); mocks.usuario.mockResolvedValue({ permissoes: [] });
    mocks.contexto.mockResolvedValue({ ok: true, dado: null }); mocks.propostas.mockResolvedValue({ ok: true, dado: [] });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });
  it("passa a preferência carregada depois da guarda ao painel do aluno sem mudar a ficha", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }) }));
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR);
    expect(html).toContain('data-acesso="aluno:America/Costa_Rica"');
    expect(html).toContain('data-ficha="America/Costa_Rica"');
  });
  it("mantém fallback UTC quando a preferência não está disponível", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Preferência indisponível" });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "aluno" }) }));
    expect(html).toContain('data-ficha="UTC"');
    expect(html).toContain('data-acesso="aluno:UTC"');
  });
  it("não consulta preferência nem ficha quando a guarda recusa", async () => {
    mocks.sessao.mockRejectedValue(new Error("sem acesso"));
    await expect(Page({ params: Promise.resolve({ id: "aluno" }) })).rejects.toThrow("sem acesso");
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.ficha).not.toHaveBeenCalled();
  });
});
