import { beforeEach, describe, expect, it, vi } from "vitest";
const { detalhes, oportunidades, atividade } = vi.hoisted(() => ({ detalhes: vi.fn(), oportunidades: vi.fn(), atividade: vi.fn() }));
vi.mock("./painel-detalhes", () => ({ carregarDetalhesPainel: detalhes }));
vi.mock("./painel-oportunidades", () => ({ carregarOportunidadesPainel: oportunidades }));
vi.mock("./painel-atividade",()=>({carregarAtividadePainel:atividade}));
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
  it("333 Atividade despacha produtor autorizado e preserva null",async()=>{
    atividade.mockResolvedValueOnce({agendadas:[],recente:{conversas:1}}).mockResolvedValueOnce(null);
    expect(await carregarAbaPainel(u,"a1","atividade")).toEqual({agendadas:[],recente:{conversas:1}});
    expect(atividade).toHaveBeenCalledWith(u,"a1");expect(detalhes).not.toHaveBeenCalled();expect(oportunidades).not.toHaveBeenCalled();
    expect(await carregarAbaPainel(u,"a1","atividade")).toBeNull();
  });
});

it("Oportunidades despacha o produtor contextual e preserva null sem consultar Detalhes",async()=>{oportunidades.mockResolvedValueOnce({atual:null,outras:[],pessoaId:null}).mockResolvedValueOnce(null);expect(await carregarAbaPainel(u,"a1","oportunidades")).toEqual({atual:null,outras:[],pessoaId:null});expect(oportunidades).toHaveBeenCalledWith(u,"a1");expect(detalhes).not.toHaveBeenCalled();expect(await carregarAbaPainel(u,"a1","oportunidades")).toBeNull();});
