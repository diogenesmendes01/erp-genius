import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared/sessao";

const m = vi.hoisted(() => ({ primeiro: vi.fn(), varios: vi.fn(), escopo: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { atendimentoWhatsApp: { findFirst: m.primeiro, findMany: m.varios } } }));
vi.mock("@/server/whatsapp/escopo", () => ({
  PAPEIS_INBOX: ["ADMINISTRADOR", "GERENTE_COMERCIAL", "VENDEDOR", "FINANCEIRO", "SECRETARIA_ACADEMICA", "PROFESSOR", "GERENTE_PEDAGOGICO"],
  escopoAtendimentos: m.escopo,
}));
const usuario: UsuarioSessao = { id: "usuario-ficticio", nome: "Usuário fictício", papeis: [Papel.VENDEDOR] };
const escopo = { id: { in: ["somente-este-alvo"] } };
async function produtor() {
  const caminho = "./" + "atalhos";
  const modulo = await import(caminho).catch(() => null);
  expect(modulo, "produtor interno #336 ainda ausente").not.toBeNull();
  return modulo as typeof import("./atalhos");
}
beforeEach(() => { vi.clearAllMocks(); m.primeiro.mockResolvedValue(null); m.varios.mockResolvedValue([]); m.escopo.mockResolvedValue(escopo); });

it.each([
  { ...usuario, id: "" },
  { ...usuario, papeis: [Papel.ALUNO] },
])("sem usuário/papel Inbox não consulta sequer o escopo", async u => {
  const { atendimentoParaAbrir } = await produtor();
  expect(await atendimentoParaAbrir(u, { atendimentoId: "a1" })).toBeNull();
  expect((await (await produtor()).atendimentosParaPessoas(u, ["p1"])).size).toBe(0);
  expect(m.escopo).not.toHaveBeenCalled(); expect(m.primeiro).not.toHaveBeenCalled(); expect(m.varios).not.toHaveBeenCalled();
});
it("alvo vazio não consulta nem busca atendimento arbitrário", async () => {
  const { atendimentoParaAbrir } = await produtor();
  expect(await atendimentoParaAbrir(usuario, { atendimentoId: null, leadId: null, pessoaId: null })).toBeNull();
  expect(m.escopo).not.toHaveBeenCalled(); expect(m.primeiro).not.toHaveBeenCalled();
});
it.each(["EM_ATENDIMENTO", "ENCERRADO"] as const)("ID explícito %s vence fallbacks e retorna só o DTO", async status => {
  const { atendimentoParaAbrir } = await produtor();
  m.primeiro.mockResolvedValueOnce({ id: "a1", status });
  expect(await atendimentoParaAbrir(usuario, { atendimentoId: "a1", leadId: "l1", pessoaId: "p1" })).toEqual({ atendimentoId: "a1", aberta: status !== "ENCERRADO" });
  expect(m.escopo).toHaveBeenCalledTimes(1); expect(m.primeiro).toHaveBeenCalledTimes(1);
  expect(m.primeiro.mock.calls[0][0]).toMatchObject({ where: { AND: expect.arrayContaining([escopo, { id: "a1" }]) } });
});
it("miss explícito não herda acesso: cada busca mantém escopo e contato individual", async () => {
  const { atendimentoParaAbrir } = await produtor();
  m.primeiro.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "lead-visivel", status: "AGUARDANDO_CLIENTE" });
  expect(await atendimentoParaAbrir(usuario, { atendimentoId: "invisivel", leadId: "l1", pessoaId: "p1" })).toEqual({ atendimentoId: "lead-visivel", aberta: true });
  expect(m.escopo).toHaveBeenCalledTimes(1); expect(m.primeiro).toHaveBeenCalledTimes(2);
  for (const [q] of m.primeiro.mock.calls) {
    expect(q.where.AND).toEqual(expect.arrayContaining([escopo, { conversa: { contatoId: { not: null }, grupoId: null } }]));
  }
  expect(m.primeiro.mock.calls[1][0]).toMatchObject({
    where: { AND: expect.arrayContaining([{ leadId: "l1", status: { not: "ENCERRADO" } }]) },
    orderBy: [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  });
});
it("pessoa aberta precede encerrados; encerrado só depois de esgotar abertos", async () => {
  const { atendimentoParaAbrir } = await produtor();
  m.primeiro.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "encerrado-visivel", status: "ENCERRADO" });
  expect(await atendimentoParaAbrir(usuario, { leadId: "l1", pessoaId: "p1" })).toEqual({ atendimentoId: "encerrado-visivel", aberta: false });
  expect(m.primeiro).toHaveBeenCalledTimes(3);
  expect(m.primeiro.mock.calls[1][0]).toMatchObject({ where: { AND: expect.arrayContaining([{ conversa: { contato: { pessoaId: "p1" } }, status: { not: "ENCERRADO" } }]) } });
  expect(m.primeiro.mock.calls[2][0]).toMatchObject({ where: { AND: expect.arrayContaining([{ status: "ENCERRADO", OR: [{ leadId: "l1" }, { conversa: { contato: { pessoaId: "p1" } } }] }]) } });
});

it("lote percorre mais de100 candidatos sem perder outra pessoa e calcula escopo uma vez", async () => {
  const { atendimentosParaPessoas } = await produtor();
  m.varios.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({
    id: "z" + String(100 - i).padStart(3, "0"), status: "EM_ATENDIMENTO", ultimaMensagemEm: new Date("2026-10-22T12:00Z"),
    conversa: { contato: { pessoaId: "p1" } },
  }))).mockResolvedValueOnce([{ id: "antiga", status: "EM_ATENDIMENTO", ultimaMensagemEm: new Date("2026-10-01T12:00Z"), conversa: { contato: { pessoaId: "p2" } } }]);
  expect([...(await atendimentosParaPessoas(usuario, ["p1", "p2", "p1"])).entries()]).toEqual([
    ["p1", { atendimentoId: "z100", aberta: true }], ["p2", { atendimentoId: "antiga", aberta: true }],
  ]);
  expect(m.escopo).toHaveBeenCalledTimes(1); expect(m.varios).toHaveBeenCalledTimes(2);
  expect(m.primeiro).not.toHaveBeenCalled();
  expect(m.varios.mock.calls[1][0]).toMatchObject({ take: 100, where: { AND: expect.arrayContaining([
    escopo, { conversa: { contatoId: { not: null }, grupoId: null } },
    { conversa: { contato: { pessoaId: { in: ["p2"] } } } },
  ]) } });
});
it("lote esgota abertos antes dos encerrados e vazio não consulta", async () => {
  const { atendimentosParaPessoas } = await produtor();
  expect((await atendimentosParaPessoas(usuario, [])).size).toBe(0); expect(m.escopo).not.toHaveBeenCalled();
  m.varios.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "c1", status: "ENCERRADO", ultimaMensagemEm: null, conversa: { contato: { pessoaId: "p1" } } }]);
  expect((await atendimentosParaPessoas(usuario, ["p1"])).get("p1")).toEqual({ atendimentoId: "c1", aberta: false });
  expect(m.varios).toHaveBeenCalledTimes(2);
});

it("lote avança cursor entre timestamps nulos usando id SQL, sem repetir página", async () => {
  const { atendimentosParaPessoas } = await produtor();
  m.varios.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({
    id: "z" + String(100 - i).padStart(3, "0"), status: "EM_ATENDIMENTO", ultimaMensagemEm: null, conversa: { contato: { pessoaId: "p1" } },
  }))).mockResolvedValueOnce([{ id: "a", status: "EM_ATENDIMENTO", ultimaMensagemEm: null, conversa: { contato: { pessoaId: "p2" } } }]);
  expect((await atendimentosParaPessoas(usuario, ["p1", "p2"])).get("p2")).toEqual({ atendimentoId: "a", aberta: true });
  expect(m.varios.mock.calls[1][0]).toMatchObject({ where: { AND: expect.arrayContaining([{ ultimaMensagemEm: null, id: { lt: "z001" } }]) } });
});
