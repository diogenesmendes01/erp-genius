import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const m = vi.hoisted(() => ({ sessao: vi.fn(), candidatos: vi.fn() }));
vi.mock("@/server/_shared/sessao", async orig => ({ ...(await orig<typeof import("@/server/_shared/sessao")>()), exigirSessao: () => m.sessao() }));
vi.mock("@/server/inbox/consultas-mencoes", () => ({ listarCandidatosMencao: m.candidatos }));
import { ErroAutenticacao } from "@/server/_shared/sessao";
import { GET } from "./route";
const chamar = (q = "Jo") => GET(new Request("http://local/api/inbox/atendimentos/a/mencoes?q=" + encodeURIComponent(q)), { params: Promise.resolve({ id: "a" }) });
beforeEach(() => { vi.clearAllMocks(); m.sessao.mockResolvedValue({ id: "u", nome: "U", papeis: [Papel.VENDEDOR] }); m.candidatos.mockResolvedValue([]); });
it("sessão/papel antes de consultar candidatos", async () => {
  m.sessao.mockRejectedValueOnce(new ErroAutenticacao()); expect((await chamar()).status).toBe(401);
  m.sessao.mockResolvedValueOnce({ id: "p", nome: "P", papeis: [Papel.ALUNO] }); expect((await chamar()).status).toBe(403);
  expect(m.candidatos).not.toHaveBeenCalled();
});
it("sem leitura é404 genérico; corpo não revela usuário", async () => { m.candidatos.mockResolvedValue(null); const r = await chamar(); expect(r.status).toBe(404); expect(await r.json()).toEqual({ erro: "Atendimento não encontrado." }); });
it("busca curta/longa não consulta; saída autorizada é no-store e só campos públicos", async () => {
  expect((await chamar("x")).status).toBe(400); expect((await chamar("x".repeat(61))).status).toBe(400); expect(m.candidatos).not.toHaveBeenCalled();
  m.candidatos.mockResolvedValue([{ id: "u2", nome: "João Silva", descricao: "Vendedor" }]);
  const r = await chamar(); expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe("no-store"); expect(await r.json()).toEqual([{ id: "u2", nome: "João Silva", descricao: "Vendedor" }]);
});
