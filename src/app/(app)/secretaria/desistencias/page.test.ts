import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-administrativa-fila", () => ({ listarPendenciasAdministrativasDesistencia: mocks.listar }));
import Page from "./page";
const item = { id: "m/a?", codigo: "MAT-598", pedido: { id: "pedido-interno", versao: 3, motivo: "Desistência solicitada", registradorNome: "Secretaria" }, atual: true, podeAprovar: true, podeDecidir: true, exigeConferencia: false };
describe("fila administrativa da desistência", () => {
  it("apresenta pedido e paginação, sem decisão direta na fila", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [item], proximoCursor: "proximo/id" } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ cursor: "anterior" }) }));
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.listar).toHaveBeenCalledWith({ cursor: "anterior" });
    expect(html).toContain("MAT-598 · Pedido 3"); expect(html).toContain("Registrado por Secretaria");
    expect(html).toContain("/matriculas/m%2Fa%3F/desistencia/administracao");
    expect(html).toContain("cursor=proximo%2Fid"); expect(html).toContain("Voltar ao início");
    expect(html).toContain("disponível para sua revisão"); expect(html).not.toContain("<form");
    expect(html).not.toContain("pedido-interno");
  });
  it("destaca fonte alterada sem oferecer aprovação", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [{ ...item, atual: false, exigeConferencia: true, podeAprovar: false }], proximoCursor: null } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("nova conferência antes de aprovar"); expect(html).not.toContain("disponível para sua revisão");
  });
  it("orienta quem acompanha sem possuir permissão decisória", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [{ ...item, podeAprovar: false, podeDecidir: false }], proximoCursor: null } });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Aguardando revisão por outra pessoa da Administração"); expect(html).not.toContain("<form");
  });
  it("distingue página vazia de falha na consulta", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [], proximoCursor: null } });
    const vazio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(vazio).toContain("Nenhum pedido pendente nesta página");
    mocks.listar.mockResolvedValue({ ok: false, erro: "Acesso negado." });
    const erro = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(erro).toContain('role="alert"'); expect(erro).not.toContain("Nenhum pedido pendente");
  });
});
