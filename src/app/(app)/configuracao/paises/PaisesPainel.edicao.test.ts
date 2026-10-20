import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// C13 da #170: o servidor preserva o tipo de documento pelo `id` (server/paises/tipos-documento.ts).
// A tela precisa repassar esse `id` ao abrir a edição; sem ele, renomear um tipo em uso vira
// "remover o antigo + criar um novo", e a remoção de um tipo com alunos é recusada.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const g = () => m.ganchos!;
  return {
    ...real,
    useState: ((i: unknown) => g().useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => g().useRef(i)) as unknown as typeof real.useRef,
    useId: (() => g().useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/paises/acoes", () => ({ alterarStatusPais: vi.fn(), alternarProdutoPais: vi.fn() }));
vi.mock("./PaisFormulario", () => ({ PaisFormulario: () => null }));

import { PaisesPainel, type PaisRow } from "./PaisesPainel";
import { PaisFormulario } from "./PaisFormulario";
import { clicar, criarGanchos, elementos, type No } from "@/test/tela-sem-dom";

const pais: PaisRow = {
  id: "cr", nome: "Costa Rica", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506", fuso: "America/Costa_Rica", idioma: "es",
  status: "ATIVO",
  tiposDocumento: [
    { id: "d1", nome: "Cédula", validador: "cedula_cr" },
    { id: "d2", nome: "Passaporte", validador: "passaporte" },
  ],
  produtosOferecidos: [], _count: { produtosPais: 0, precos: 0, alunos: 3 },
};
const tela = (): ReactNode => m.ganchos!.renderizar(PaisesPainel, { paises: [pais], produtos: [] });

beforeEach(() => { m.ganchos = criarGanchos(); });

describe("PaisesPainel — editar país preserva o id dos tipos de documento (C13)", () => {
  it("o formulário de edição recebe cada tipo com o id de origem", () => {
    clicar(tela(), "Editar");
    const [form] = elementos(tela()).filter((n: No) => n.type === PaisFormulario);
    expect(form).toBeDefined();
    const editar = form.props.pais as { id: string; tiposDocumento: unknown[] };
    expect(editar.id).toBe("cr");
    expect(editar.tiposDocumento).toEqual([
      { id: "d1", nome: "Cédula", validador: "cedula_cr" },
      { id: "d2", nome: "Passaporte", validador: "passaporte" },
    ]);
  });
});
