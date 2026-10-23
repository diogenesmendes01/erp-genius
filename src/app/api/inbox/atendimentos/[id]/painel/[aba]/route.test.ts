import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { sessaoMock, carregarAbaPainel } = vi.hoisted(() => ({ sessaoMock: vi.fn(), carregarAbaPainel: vi.fn() }));
vi.mock("@/server/_shared/sessao", async orig => ({ ...(await orig<typeof import("@/server/_shared/sessao")>()), exigirSessao: async () => {
  const u = await sessaoMock(); if (u === null) throw new (await orig<typeof import("@/server/_shared/sessao")>()).ErroAutenticacao(); return u;
} }));
vi.mock("@/server/inbox/painel-abas", () => ({ carregarAbaPainel }));
import { GET } from "./route";
const u = { id: "u1", nome: "Usuário", papeis: [Papel.VENDEDOR] };
const chamar = (aba = "detalhes") => GET(new Request("http://local/api/inbox/atendimentos/a1/painel/" + aba), { params: Promise.resolve({ id: "a1", aba }) });
beforeEach(() => { vi.clearAllMocks(); sessaoMock.mockResolvedValue(u); carregarAbaPainel.mockResolvedValue(null); });
describe("GET painel por aba mantém autenticação/escopo e vocabulário entregue", () => {
  it("sem sessão401 antes de validar aba, sem domínio", async () => {
    sessaoMock.mockResolvedValue(null); expect((await chamar("insights")).status).toBe(401); expect(carregarAbaPainel).not.toHaveBeenCalled();
  });
  it("papel sem inbox403 sem domínio", async () => {
    sessaoMock.mockResolvedValue({ ...u, papeis: [Papel.ALUNO] }); expect((await chamar()).status).toBe(403); expect(carregarAbaPainel).not.toHaveBeenCalled();
  });
  it.each(["insights", "DETALHES", "qualquer"])("aba inválida%s400 sem domínio", async aba => {
    const r = await chamar(aba); expect(r.status).toBe(400); expect(await r.json()).toEqual({ erro: "Aba inválida." }); expect(carregarAbaPainel).not.toHaveBeenCalled();
  });
  it("atendimento fora do escopo404", async () => {
    const r = await chamar(); expect(r.status).toBe(404); expect(await r.json()).toEqual({ erro: "Atendimento não encontrado." }); expect(carregarAbaPainel).toHaveBeenCalledWith(u, "a1", "detalhes");
  });
  it.each(["oportunidades", "atividade"])("aba futura%s é válida mas dispatcher sem produtor retorna404", async aba => {
    expect((await chamar(aba)).status).toBe(404); expect(carregarAbaPainel).toHaveBeenCalledWith(u, "a1", aba);
  });
  it("detalhes autorizados200/no-store com JSON do servidor", async () => {
    const dados = { pessoa: null, oportunidade: null, b2b: null, campos: [] }; carregarAbaPainel.mockResolvedValue(dados);
    const r = await chamar(); expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe("no-store"); expect(await r.json()).toEqual(dados);
  });
});
