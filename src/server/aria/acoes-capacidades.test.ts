import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// C4: liga cada ação da Aria à capacidade exigida, sem banco (roda no `npm test` do CI). O prisma é
// um dublê que falha se tocado: a recusa precisa acontecer ANTES de qualquer leitura ou escrita.
const { sessaoMock, banco } = vi.hoisted(() => {
  const falha = (nome: string) => () => {
    throw new Error(`prisma.${nome} não deveria ser chamado`);
  };
  const tabela = (t: string) =>
    new Proxy({}, { get: (_alvo, metodo) => vi.fn(falha(`${t}.${String(metodo)}`)) });
  return {
    sessaoMock: vi.fn(),
    banco: {
      $transaction: vi.fn(falha("$transaction")),
      $queryRaw: vi.fn(falha("$queryRaw")),
      agenteIA: tabela("agenteIA"),
      versaoAgenteIA: tabela("versaoAgenteIA"),
      usuario: tabela("usuario"),
      evento: tabela("evento"),
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: banco }));
vi.mock("../_shared", async (original) => ({
  ...(await original<typeof import("../_shared")>()),
  exigirSessao: sessaoMock,
}));

import { definirEstadoAria } from "./estado";
import { publicarRascunho } from "./versoes";

const usuario = (papeis: Papel[]) => ({ id: "u1", nome: "U", papeis, permissoes: [] as string[] });

beforeEach(() => {
  sessaoMock.mockReset();
  banco.$transaction.mockClear();
});

describe("ações da Aria exigem a capacidade certa", () => {
  it("gerente_nao_muda_estado", async () => {
    sessaoMock.mockResolvedValue(usuario([Papel.GERENTE_COMERCIAL]));
    for (const estado of ["SHADOW", "ATIVA", "DESLIGADA"] as const) {
      expect(await definirEstadoAria(estado)).toEqual({ ok: false, erro: "Só o Administrador muda o estado da Aria." });
    }
    expect(banco.$transaction).not.toHaveBeenCalled();
  });

  it("vendedor_nao_publica", async () => {
    sessaoMock.mockResolvedValue(usuario([Papel.VENDEDOR]));
    expect(await publicarRascunho({ nota: "x", rascunho: null })).toEqual({ ok: false, erro: "Sem acesso à configuração da Aria." });
    expect(banco.$transaction).not.toHaveBeenCalled();
  });

  it("controle_admin_passa_da_capacidade", async () => {
    // Controle positivo: com a capacidade, a ação segue até o banco (aqui o dublê falha de propósito).
    sessaoMock.mockResolvedValue(usuario([Papel.ADMINISTRADOR]));
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await definirEstadoAria("SHADOW")).toEqual({ ok: false, erro: "Erro inesperado. Tente novamente." });
    expect(banco.$transaction).toHaveBeenCalledTimes(1);
    erro.mockRestore();
  });
});
