import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const m = vi.hoisted(() => ({ usuarios: vi.fn(), consulta: vi.fn(), acesso: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: m.usuarios }, $queryRaw: m.consulta } }));
vi.mock("@/server/whatsapp/atendimentos", () => ({ atendimentoVisivel: m.acesso }));
import { listarCandidatosMencao } from "./consultas-mencoes";
const u = { id: "autor", nome: "Autora", papeis: [Papel.ADMINISTRADOR] };
const pessoa = (id: string, nome: string) => ({ id, nome, ativo: true, papeis: [Papel.VENDEDOR], permissoes: [] });
beforeEach(() => { vi.clearAllMocks(); m.acesso.mockResolvedValue({ id: "at" }); m.usuarios.mockResolvedValue([]); m.consulta.mockResolvedValue([]); });
it("nega atendimento antes de consultar qualquer usuário", async () => { m.acesso.mockResolvedValue(null); expect(await listarCandidatosMencao(u, "at", "Jo")).toBeNull(); expect(m.consulta).not.toHaveBeenCalled(); });
it("candidato sem leitura é excluído e não herda permissão de convite/envio", async () => {
  m.consulta.mockResolvedValue([pessoa("alvo", "João Silva"), pessoa("fora", "Joana Dias")]);
  m.acesso.mockImplementation(async (p: { id: string }) => p.id === "fora" ? null : { id: "at" });
  expect(await listarCandidatosMencao(u, "at", "jo")).toEqual([{ id: "alvo", nome: "João Silva", descricao: "Vendedor" }]);
});
it("autor/inativo/portal não aparecem mesmo se o transporte contém esses registros", async () => {
  m.consulta.mockResolvedValue([{ ...pessoa("autor", "João"), papeis: [Papel.ADMINISTRADOR] }, { ...pessoa("inativo", "João"), ativo: false }, { ...pessoa("portal", "João"), papeis: [Papel.ALUNO] }]);
  expect(await listarCandidatosMencao(u, "at", "jo")).toEqual([]);
});
it("busca e resultados são limitados, nomes não expõem e-mail/documento", async () => {
  expect(await listarCandidatosMencao(u, "at", "j")).toEqual([]); expect(m.consulta).not.toHaveBeenCalled();
  m.consulta.mockResolvedValue(Array.from({ length: 40 }, (_, i) => ({ ...pessoa("u" + i, "João " + i), email: "segredo@local", documento: "secreto" })));
  const r = await listarCandidatosMencao(u, "at", "jo"); expect(r).toHaveLength(20); expect(JSON.stringify(r)).not.toContain("segredo");
  expect(m.consulta.mock.calls[0][0].values).toContain(201);
});

it("filtra termo normalizado no banco antes do limite, encontrando José fora dos primeiros200globais", async () => {
  m.consulta.mockResolvedValue([{ ...pessoa("depois-200", "José da Silva"), papeis: [Papel.PROFESSOR] }]);
  expect(await listarCandidatosMencao(u, "at", "JOSE")).toEqual([{ id: "depois-200", nome: "José da Silva", descricao: "Professor" }]);
  const consulta = m.consulta.mock.calls[0][0]; expect(consulta.values).toContain("jose");
  expect(consulta.strings.join("?")).toMatch(/strpos\([\s\S]*translate\([\s\S]*LIMIT/);
});
