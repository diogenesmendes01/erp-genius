import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { codificarCursor } from "@/server/inbox/cursor";
const m = vi.hoisted(() => ({ sessao: vi.fn(), pagina: vi.fn(), contar: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (orig) => ({ ...(await orig<typeof import("@/server/_shared/sessao")>()), exigirSessao: async () => {
  const u = await m.sessao();
  if (!u) throw new (await orig<typeof import("@/server/_shared/sessao")>()).ErroAutenticacao();
  return u;
} }));
vi.mock("@/server/inbox/consultas-pagina", () => ({ listarAtendimentosPagina: m.pagina, contarChipsInbox: m.contar }));
import { GET } from "./route";
const usuario = { id: "u", nome: "U", papeis: [Papel.FINANCEIRO] };
const contagens = { todas: 7, minhas: 2, naoLidas: 3, prazo: 1, fila: 4 };
const chamar = (q = "") => GET(new Request(`http://x/api/inbox/atendimentos?${q}`));
beforeEach(() => { vi.resetAllMocks(); m.sessao.mockResolvedValue(usuario); m.pagina.mockResolvedValue({ itens: [], proximo: null }); m.contar.mockResolvedValue(contagens); });
describe("lista com contagens opt-in", () => {
  it("401/403 antes de consultar lista ou contagens", async () => {
    m.sessao.mockResolvedValue(null); expect((await chamar("contagens=1")).status).toBe(401);
    m.sessao.mockResolvedValue({ ...usuario, papeis: [Papel.ALUNO] }); expect((await chamar("contagens=1")).status).toBe(403);
    expect(m.pagina).not.toHaveBeenCalled(); expect(m.contar).not.toHaveBeenCalled();
  });
  it.each(["", "contagens=0", "contagens=true"])("%s mantém resposta antiga sem custo das contagens", async (q) => {
    const r = await chamar(q); expect(await r.json()).toEqual({ itens: [], proximo: null }); expect(m.contar).not.toHaveBeenCalled();
  });
  it("primeira página usa os filtros e preserva escopo envio sem cache", async () => {
    const r = await chamar("contagens=1&envio=1&setor=FINANCEIRO&numeroId=n&busca=Ana");
    expect(await r.json()).toEqual({ itens: [], proximo: null, contagens });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(m.contar).toHaveBeenCalledWith(usuario, { setor: "FINANCEIRO", numeroId: "n", busca: "Ana" }, { enviar: true });
    expect(m.pagina).toHaveBeenCalledWith(usuario, expect.anything(), null, undefined, { enviar: true });
  });
  it("cursor válido ignora contagens=1; cursor inválido não consulta", async () => {
    const cursor = codificarCursor({ em: null, id: "a" });
    expect(await (await chamar(`contagens=1&cursor=${cursor}`)).json()).toEqual({ itens: [], proximo: null });
    expect(m.contar).not.toHaveBeenCalled(); m.pagina.mockClear();
    expect((await chamar("contagens=1&cursor=invalido")).status).toBe(400); expect(m.pagina).not.toHaveBeenCalled();
  });
});
