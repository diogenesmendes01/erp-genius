import { beforeEach, describe, expect, it, vi } from "vitest";
const { detalhes, oportunidades } = vi.hoisted(() => ({ detalhes: vi.fn(), oportunidades: vi.fn() }));
vi.mock("./painel-detalhes", () => ({ carregarDetalhesPainel: detalhes }));
vi.mock("./painel-oportunidades", () => ({ carregarOportunidadesPainel: oportunidades }));
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
  it.each(["atividade"] as const)("%s não consulta nem fabrica dados antes da entrega", async aba => {
    expect(await carregarAbaPainel(u, "a1", aba)).toBeNull();
    expect(detalhes).not.toHaveBeenCalled();
  });
});

it("Oportunidades despacha o produtor contextual e preserva null sem consultar Detalhes",async()=>{oportunidades.mockResolvedValueOnce({atual:null,outras:[],pessoaId:null}).mockResolvedValueOnce(null);expect(await carregarAbaPainel(u,"a1","oportunidades")).toEqual({atual:null,outras:[],pessoaId:null});expect(oportunidades).toHaveBeenCalledWith(u,"a1");expect(detalhes).not.toHaveBeenCalled();expect(await carregarAbaPainel(u,"a1","oportunidades")).toBeNull();});
