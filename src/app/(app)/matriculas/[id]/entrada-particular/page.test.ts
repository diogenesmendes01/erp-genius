import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAPEIS_FINANCEIRO, abreFinanceiro } from "@/app/(app)/financeiro/papeis";

// docs/42 L577 (docs/43 §6 item 7): o único caminho de ação da tela era um link para /financeiro, que a Secretaria
// (que abre esta tela) não abre — caía em "acesso negado".
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/entrada-particular-consulta", () => ({ consultarPagamentosEntradaParticular: mocks.consultar }));
import Page from "./page";

const dado = (codigo: string | null = "M-000901") => ({
  matriculaId: "matricula-interna", codigo, aluno: { primeiroNome: "Fábio", sobrenome: "Lopes" }, versaoCondicoes: 2, pagamentosExigidosConfirmados: false,
  itens: [{ id: "item", tipo: "TAXA_MATRICULA", valor: "100", moeda: "BRL", minutos: null, exigido: true, confirmada: false, pendencia: null }], emitirNaAtivacao: [],
});
const renderizar = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "matricula/1" }) }));

describe("pagamentos de entrada da particular: saída por papel", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.consultar.mockResolvedValue({ ok: true, dado: dado() }); });

  it("Secretaria: sem link para /financeiro; diz quem confirma e dá o caminho dela (a matrícula na Secretaria)", async () => {
    mocks.sessao.mockResolvedValue({ id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
    const html = await renderizar();
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
    expect(html).not.toContain('href="/financeiro');
    expect(html).toContain("A confirmação dos recebimentos é feita pelo Financeiro.");
    expect(html).toContain('href="/secretaria?matriculaId=matricula%2F1">Abrir a matrícula na Secretaria</a>');
  });

  it.each([Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL, Papel.ADMINISTRADOR])("%s: o link para o Financeiro, sem o desvio da Secretaria", async (papel) => {
    mocks.sessao.mockResolvedValue({ id: "u", papeis: [papel] });
    const html = await renderizar();
    expect(html).toContain('href="/financeiro">Acompanhar recebimentos no Financeiro</a>');
    expect(html).not.toContain("Abrir a matrícula na Secretaria");
  });

  it("a regra do link é a do guard de /financeiro (Administrador ou PAPEIS_FINANCEIRO)", () => {
    expect(PAPEIS_FINANCEIRO).toEqual([Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL]);
    expect(abreFinanceiro([Papel.SECRETARIA_ACADEMICA])).toBe(false);
    expect(abreFinanceiro([Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO])).toBe(true);
    expect(abreFinanceiro([Papel.ADMINISTRADOR])).toBe(true);
  });

  it("matrícula sem código: \"sem código\", não o id", async () => {
    mocks.sessao.mockResolvedValue({ id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
    mocks.consultar.mockResolvedValue({ ok: true, dado: dado(null) });
    const html = await renderizar();
    expect(html).toContain("Fábio Lopes · Matrícula sem código · Condições versão 2.");
    expect(html).not.toContain("matricula-interna");
  });
});
