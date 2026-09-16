import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/portal-aluno/fila-envios", () => ({ consultarFilaEnviosPortalAluno: mocks.consultar }));

import Page from "./page";

beforeEach(() => { vi.resetAllMocks(); });

describe("fila operacional de envios do portal", () => {
  it("interrompe no guard de Secretaria/Administração antes da consulta", async () => {
    mocks.sessao.mockRejectedValue(new Error("acesso negado"));

    await expect(Page({ searchParams: Promise.resolve({ cursor: "nao-consultar" }) })).rejects.toThrow("acesso negado");

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    expect(mocks.consultar).not.toHaveBeenCalled();
  });

  it("mostra estados sem alegar entrega e preserva paginação codificada", async () => {
    mocks.sessao.mockResolvedValue({ id: "secretaria" });
    mocks.consultar.mockResolvedValue({ ok: true, dado: {
      itens: [
        { id: "interno", alunoNome: "Ana", finalidade: "CONVITE", situacao: "ENVIADO", atualizadoEm: new Date("2026-09-16T12:00:00.000Z") },
        { id: "interno-2", alunoNome: "Bia", finalidade: "RECUPERACAO", situacao: "INCERTO", atualizadoEm: new Date("2026-09-16T12:00:00.000Z") },
      ],
      proximoCursor: "proximo &/",
    } });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ cursor: "anterior" }) }));

    expect(mocks.consultar).toHaveBeenCalledWith({ cursor: "anterior" });
    expect(html).toContain("Aceito pelo provedor");
    expect(html).toContain("Resultado incerto exige conciliação");
    expect(html).not.toMatch(/entregue ao aluno/i);
    expect(html).toContain("/secretaria/envios-portal\">Voltar ao início");
    expect(html).toContain("cursor=proximo%20%26%2F");
  });
});
