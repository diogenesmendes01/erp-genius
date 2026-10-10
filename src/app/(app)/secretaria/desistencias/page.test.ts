import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-administrativa-fila", () => ({ listarPendenciasAdministrativasDesistencia: mocks.listar }));
import Page from "./page";
const item = { id: "m/a?", codigo: "MAT-598", pedido: { id: "pedido-interno", versao: 3, motivo: "Desistência solicitada", registradorNome: "Secretaria" }, atual: true, podeAprovar: true, podeDecidir: true, exigeConferencia: false };
const nav = (sobrescrever: Record<string, unknown> = {}) => ({ temAnterior: false, temProxima: false, anterior: null, proxima: null, ...sobrescrever });
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
describe("fila administrativa da desistência", () => {
  it("apresenta pedido e navegação, sem decisão direta na fila", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], ...nav({ temAnterior: true, temProxima: true, anterior: "m-1", proxima: "m-9" }) } });
    const html = await render({ depois: "m-0" });
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.listar).toHaveBeenCalledWith({ depois: "m-0" });
    expect(html).toContain("MAT-598 · Pedido 3"); expect(html).toContain("Registrado por Secretaria");
    expect(html).toContain("/matriculas/m%2Fa%3F/desistencia/administracao");
    expect(html).toContain("disponível para sua revisão"); expect(html).not.toContain("<form");
    expect(html).not.toContain("pedido-interno");
  });
  it("cursor nos dois sentidos: o início só com Próxima; no meio, Anterior e Próxima com o cursor certo", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], ...nav({ temProxima: true, proxima: "m-9" }) } });
    const inicio = await render({});
    expect(mocks.listar).toHaveBeenLastCalledWith({});
    expect(inicio).not.toContain("Anterior");
    expect(inicio).toContain('href="/secretaria/desistencias?depois=m-9">Próxima');
    expect(inicio).not.toContain("pagina");
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], ...nav({ temAnterior: true, temProxima: true, anterior: "m-1", proxima: "m-9" }) } });
    const meio = await render({ antes: "m-10" });
    expect(mocks.listar).toHaveBeenLastCalledWith({ antes: "m-10" });
    expect(meio).toContain('href="/secretaria/desistencias?antes=m-1">← Anterior');
    expect(meio).toContain('href="/secretaria/desistencias?depois=m-9">Próxima');
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], ...nav({ temAnterior: true, anterior: "m-1" }) } });
    const ultima = await render({ depois: "m-0" });
    expect(ultima).toContain('href="/secretaria/desistencias?antes=m-1">← Anterior');
    expect(ultima).not.toContain("Próxima");
  });
  it("destaca fonte alterada sem oferecer aprovação", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [{ ...item, atual: false, exigeConferencia: true, podeAprovar: false }], ...nav() } });
    const html = await render({});
    expect(html).toContain("nova conferência antes de aprovar"); expect(html).not.toContain("disponível para sua revisão");
  });
  it("orienta quem acompanha sem possuir permissão decisória", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [{ ...item, podeAprovar: false, podeDecidir: false }], ...nav() } });
    const html = await render({});
    expect(html).toContain("Aguardando revisão por outra pessoa da Administração"); expect(html).not.toContain("<form");
  });
  it("distingue fila zerada (início), ponto da fila sem pedidos e falha na consulta", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [], ...nav() } });
    // Início: a fila está zerada — sem "nesta página" e sem link para si mesma (docs/42, desistências #4).
    const vazio = await render({});
    expect(vazio).toContain("Nenhum pedido aguardando decisão administrativa.");
    expect(vazio).not.toContain("nesta página"); expect(vazio).not.toContain("Anterior");
    expect(vazio).not.toContain('href="/secretaria/desistencias"');
    // Cursor que não leva a nada (fim da fila, item sumido): o vazio leva de volta ao início.
    const alem = await render({ depois: "m-sumida" });
    expect(alem).toContain("Nenhum pedido pendente a partir deste ponto da fila");
    expect(alem).not.toContain("aguardando decisão administrativa");
    expect(alem).toContain('href="/secretaria/desistencias">Ir para o início da fila');
    mocks.listar.mockResolvedValue({ ok: false, erro: "Cursor de navegação inválido. Volte ao início da fila." });
    const erro = await render({ depois: "a b" });
    expect(erro).toContain('role="alert"'); expect(erro).not.toContain("Nenhum pedido");
  });
});
