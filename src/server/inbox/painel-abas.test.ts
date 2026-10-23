import { beforeEach, describe, expect, it, vi } from "vitest";
const { detalhes } = vi.hoisted(() => ({ detalhes: vi.fn() }));
vi.mock("./painel-detalhes", () => ({ carregarDetalhesPainel: detalhes }));
import { carregarAbaPainel } from "./painel-abas";
import { Papel } from "@prisma/client";
const u = { id: "u1", nome: "Usuário", papeis: [Papel.VENDEDOR] };
beforeEach(() => vi.clearAllMocks());
describe("dispatcher das abas entregues", () => {
  it("Detalhes preserva o resultado autorizado e o null do produtor", async () => {
    detalhes.mockResolvedValueOnce({ pessoa: null, campos: [] }).mockResolvedValueOnce(null);
    expect(await carregarAbaPainel(u, "a1", "detalhes")).toEqual({ pessoa: null, campos: [] });
    expect(detalhes).toHaveBeenCalledWith(u, "a1");
    expect(await carregarAbaPainel(u, "a1", "detalhes")).toBeNull();
  });
  it.each(["oportunidades", "atividade"] as const)("%s não consulta nem fabrica dados antes da entrega", async aba => {
    expect(await carregarAbaPainel(u, "a1", aba)).toBeNull();
    expect(detalhes).not.toHaveBeenCalled();
  });
});
