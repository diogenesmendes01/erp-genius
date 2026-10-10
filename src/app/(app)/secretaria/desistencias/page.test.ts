import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-administrativa-fila", () => ({ listarPendenciasAdministrativasDesistencia: mocks.listar }));
import Page from "./page";
const item = { id: "m/a?", codigo: "MAT-598", pedido: { id: "pedido-interno", versao: 3, motivo: "Desistência solicitada", registradorNome: "Secretaria" }, atual: true, podeAprovar: true, podeDecidir: true, exigeConferencia: false };
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
describe("fila administrativa da desistência", () => {
  it("apresenta pedido e paginação, sem decisão direta na fila", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 2, temProxima: true } });
    const html = await render({ pagina: "2" });
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.listar).toHaveBeenCalledWith({ pagina: 2 });
    expect(html).toContain("MAT-598 · Pedido 3"); expect(html).toContain("Registrado por Secretaria");
    expect(html).toContain("/matriculas/m%2Fa%3F/desistencia/administracao");
    expect(html).toContain("disponível para sua revisão"); expect(html).not.toContain("<form");
    expect(html).not.toContain("pedido-interno");
  });
  it("paginação nos dois sentidos: primeira só com Próxima; no meio, as duas; Anterior aponta para a página certa", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 1, temProxima: true } });
    const primeira = await render({});
    expect(primeira).not.toContain("Anterior");
    expect(primeira).toContain('href="/secretaria/desistencias?pagina=2">Próxima');
    const meio = await render({ pagina: "4" });
    expect(meio).toContain('href="/secretaria/desistencias?pagina=3">← Anterior');
    expect(meio).toContain('href="/secretaria/desistencias?pagina=5">Próxima');
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], pagina: 2, temProxima: false } });
    const ultima = await render({ pagina: "2" });
    expect(ultima).toContain('href="/secretaria/desistencias">← Anterior');
    expect(ultima).not.toContain("Próxima");
  });
  it("destaca fonte alterada sem oferecer aprovação", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [{ ...item, atual: false, exigeConferencia: true, podeAprovar: false }], pagina: 1, temProxima: false } });
    const html = await render({});
    expect(html).toContain("nova conferência antes de aprovar"); expect(html).not.toContain("disponível para sua revisão");
  });
  it("orienta quem acompanha sem possuir permissão decisória", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [{ ...item, podeAprovar: false, podeDecidir: false }], pagina: 1, temProxima: false } });
    const html = await render({});
    expect(html).toContain("Aguardando revisão por outra pessoa da Administração"); expect(html).not.toContain("<form");
  });
  it("distingue fila zerada (primeira página), página seguinte vazia e falha na consulta", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [], pagina: 1, temProxima: false } });
    // Primeira página: a fila está zerada — "nesta página" soaria como falha de filtro (docs/42, desistências #4).
    const vazio = await render({});
    expect(vazio).toContain("Nenhum pedido aguardando decisão administrativa.");
    expect(vazio).not.toContain("nesta página"); expect(vazio).not.toContain("Anterior");
    // Página seguinte: o texto de paginação, com a volta para a anterior.
    const seguinte = await render({ pagina: "2" });
    expect(seguinte).toContain("Nenhum pedido pendente nesta página.");
    expect(seguinte).not.toContain("aguardando decisão administrativa");
    expect(seguinte).toContain('href="/secretaria/desistencias">← Anterior');
    mocks.listar.mockResolvedValue({ ok: false, erro: "Acesso negado." });
    const erro = await render({});
    expect(erro).toContain('role="alert"'); expect(erro).not.toContain("Nenhum pedido");
  });
});
