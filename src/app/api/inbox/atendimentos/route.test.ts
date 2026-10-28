import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { codificarCursor } from "@/server/inbox/cursor";
const m = vi.hoisted(() => ({ sessao: vi.fn(), pagina: vi.fn(), contar: vi.fn(), resumo: vi.fn(), operacao: vi.fn(), filtro: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (orig) => ({ ...(await orig<typeof import("@/server/_shared/sessao")>()), exigirSessao: async () => {
  const u = await m.sessao();
  if (!u) throw new (await orig<typeof import("@/server/_shared/sessao")>()).ErroAutenticacao();
  return u;
} }));
vi.mock("@/server/inbox/consultas-pagina", () => ({ listarAtendimentosPagina: m.pagina, contarChipsInbox: m.contar }));
vi.mock("@/server/inbox/contagens",()=>({resumoDaListaInbox:m.resumo}));
vi.mock("@/server/inbox/contexto-lista",()=>({criarOperacaoListaInbox:m.operacao}));
vi.mock("@/server/inbox/opcoes-filtro", async () => {
  const atual = await vi.importActual<typeof import("@/server/inbox/opcoes-filtro")>("@/server/inbox/opcoes-filtro");
  return { ...atual, opcoesFiltroInbox: m.filtro };
});
import { GET } from "./route";
const usuario = { id: "u", nome: "U", papeis: [Papel.FINANCEIRO] };
const operacao={id:"op-api"};
const resumo={contagens:{todas:99,ia:1,aprovacao:2,handoff:3,humano:4,semResposta:5,naoAtribuidas:6},aria:{estado:"ATIVA",pausada:false,podeGerenciar:false}};
const contagens = { todas: 7, minhas: 2, naoLidas: 3, prazo: 1, fila: 4 };
const chamar = (q = "") => GET(new Request(`http://x/api/inbox/atendimentos?${q}`));
beforeEach(() => { vi.resetAllMocks(); m.sessao.mockResolvedValue(usuario); m.pagina.mockResolvedValue({ itens: [], proximo: null }); m.contar.mockResolvedValue(contagens);m.resumo.mockResolvedValue(resumo);m.operacao.mockReturnValue(operacao); });
describe("lista com contagens opt-in", () => {
  it("401/403 antes de consultar lista ou contagens", async () => {
    m.sessao.mockResolvedValue(null); expect((await chamar("contagens=1")).status).toBe(401);
    m.sessao.mockResolvedValue({ ...usuario, papeis: [Papel.ALUNO] }); expect((await chamar("contagens=1")).status).toBe(403);
    expect(m.operacao).not.toHaveBeenCalled(); expect(m.pagina).not.toHaveBeenCalled(); expect(m.contar).not.toHaveBeenCalled(); expect(m.resumo).not.toHaveBeenCalled();
  });
  it.each(["", "contagens=0", "contagens=true"])("%s mantém resposta antiga sem custo das contagens", async (q) => {
    const r = await chamar(q); expect(await r.json()).toEqual({ itens: [], proximo: null }); expect(m.contar).not.toHaveBeenCalled();
  });
  it("primeira página usa os filtros e preserva escopo envio sem cache", async () => {
    const r = await chamar("contagens=1&envio=1&setor=FINANCEIRO&numeroId=n&busca=Ana");
    expect(await r.json()).toEqual({ itens: [], proximo: null, contagens, resumo });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(m.contar).toHaveBeenCalledWith(usuario, { setor: "FINANCEIRO", numeroId: "n", busca: "Ana" }, { enviar: true,operacao });
    expect(m.pagina).toHaveBeenCalledWith(usuario, expect.anything(), null, undefined, { enviar: true,operacao });
  });
  it("cursor válido ignora contagens=1; cursor inválido não consulta", async () => {
    const cursor = codificarCursor({ em: null, id: "a" });
    expect(await (await chamar(`contagens=1&cursor=${cursor}`)).json()).toEqual({ itens: [], proximo: null });
    expect(m.contar).not.toHaveBeenCalled(); m.pagina.mockClear();m.operacao.mockClear();
    expect((await chamar("contagens=1&cursor=invalido")).status).toBe(400); expect(m.pagina).not.toHaveBeenCalled();
  });
});

it("aria e envio compartilham a operação entre lista e os dois resumos",async()=>{await chamar("contagens=1&envio=1&aria=handoff");expect(m.operacao).toHaveBeenCalledTimes(1);expect(m.operacao).toHaveBeenCalledWith(usuario,{enviar:true});expect(m.resumo).toHaveBeenCalledWith(usuario,{aria:"handoff"},undefined,{enviar:true,operacao});expect(m.contar).toHaveBeenCalledWith(usuario,{aria:"handoff"},{enviar:true,operacao});expect(m.pagina).toHaveBeenCalledWith(usuario,{aria:"handoff"},null,undefined,{enviar:true,operacao});expect(m.filtro).not.toHaveBeenCalled();});

describe("BLOCK-INBOX-WA-01 bloqueio do vendedor desconectado", () => {
  const joao = { id: "joao", nome: "João Silva", papeis: [Papel.VENDEDOR] };

  it.each([
    ["sem números", []],
    ["desconectado", [{ id: "cob", rotulo: "Cobranças Mendes", saude: "desconectado" }]],
    ["instável", [{ id: "inst", rotulo: "Instável", saude: "instavel" }]],
  ] as const)("vendedor com %s devolve lista vazia sem consultar conversas", async (_rotulo, numeros) => {
    m.sessao.mockResolvedValue(joao);
    m.filtro.mockResolvedValue({ setores: ["COMERCIAL"], numeros });
    m.pagina.mockResolvedValue({ itens: [{ id: "fila" }], proximo: "cur" });
    const r = await chamar("contagens=1");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ itens: [], proximo: null });
    expect(m.filtro).toHaveBeenCalledWith(joao);
    expect(m.pagina).not.toHaveBeenCalled();
    expect(m.contar).not.toHaveBeenCalled();
    expect(m.resumo).not.toHaveBeenCalled();
    expect(m.operacao).not.toHaveBeenCalled();
  });

  it("vendedor com número conectado continua consultando a lista", async () => {
    m.sessao.mockResolvedValue(joao);
    m.filtro.mockResolvedValue({ setores: ["COMERCIAL"], numeros: [{ id: "n1", rotulo: "Vendas", saude: "conectado" }] });
    const r = await chamar("contagens=1");
    expect(await r.json()).toEqual({ itens: [], proximo: null, contagens, resumo });
    expect(m.pagina).toHaveBeenCalled();
  });

  it("gerente comercial sem conectados não entra no bloqueio do vendedor", async () => {
    m.sessao.mockResolvedValue({ id: "g", nome: "Gerente", papeis: [Papel.GERENTE_COMERCIAL] });
    const r = await chamar("");
    expect(await r.json()).toEqual({ itens: [], proximo: null });
    expect(m.filtro).not.toHaveBeenCalled();
    expect(m.pagina).toHaveBeenCalled();
  });
});
