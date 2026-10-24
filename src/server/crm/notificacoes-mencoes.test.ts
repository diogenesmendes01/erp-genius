import { beforeEach, expect, it, vi } from "vitest";
import { Papel, type TipoNotificacao } from "@prisma/client";
const m = vi.hoisted(() => ({
  linhas: vi.fn(), atendimentos: vi.fn(), escopo: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  notificacaoUsuario: { findMany: m.linhas }, atendimentoWhatsApp: { findMany: m.atendimentos },
} }));
vi.mock("@/server/whatsapp/escopo", () => ({ escopoAtendimentos: m.escopo }));
import { listarNotificacoes } from "./notificacoes";
const usuario = { id: "u", nome: "U", papeis: [Papel.VENDEDOR] };
const linha = (id: string, tipo: TipoNotificacao, criadaEm = new Date(0), refId = id) => ({
  id, usuarioId: "u", refId, refTipo: tipo === "LEMBRETE_TAREFA" ? "Tarefa" : "AtendimentoWhatsApp",
  tipo, titulo: "Aviso interno", criadaEm, lidaEm: null as Date | null,
});
type Linha = ReturnType<typeof linha>;
type Consulta = {
  where: { usuarioId: string; OR?: [{ criadaEm: { lt: Date } }, { criadaEm: Date; id: { lt: string } }] };
  take: number;
};
let banco: Linha[];
let permitidos: Set<string>;
beforeEach(() => {
  vi.clearAllMocks();
  banco = [linha("visivel", "MENCAO_NOTA"), linha("revogado", "MENCAO_NOTA"),
    linha("sla-legado", "SLA_ESTOURADO"), linha("tarefa-legada", "LEMBRETE_TAREFA")];
  permitidos = new Set(["visivel"]);
  m.escopo.mockResolvedValue({ finalidade: "COMERCIAL" });
  // A fixture ja esta na ordem SQL. Nao se reordena o resultado no mock ou no oraculo.
  m.linhas.mockImplementation(async ({ where, take }: Consulta) => {
    const cursor = where.OR;
    return banco.filter(n => n.usuarioId === where.usuarioId && (!cursor
      || n.criadaEm < cursor[0].criadaEm.lt
      || (n.criadaEm.getTime() === cursor[1].criadaEm.getTime() && n.id < cursor[1].id.lt))).slice(0, take);
  });
  m.atendimentos.mockImplementation(async ({ where }: { where: { AND: [{ id: { in: string[] } }, unknown, unknown] } }) =>
    where.AND[0].id.in.filter(id => permitidos.has(id)).map(id => ({ id })));
});

it("revogacao remove titulo/link de mencao sem aplicar ACL nova a SLA/lembrete", async () => {
  expect((await listarNotificacoes(usuario)).map(n => n.id)).toEqual(["visivel", "sla-legado", "tarefa-legada"]);
});
it("nenhum destinatario sem sessao produz consulta", async () => {
  expect(await listarNotificacoes({ ...usuario, id: "" })).toEqual([]);
  expect(m.linhas).not.toHaveBeenCalled();
  expect(m.escopo).not.toHaveBeenCalled();
  expect(m.atendimentos).not.toHaveBeenCalled();
});
it("vinte mencoes revogadas nao apagam SLA21 e lembrete22 ainda validos", async () => {
  banco = [
    ...Array.from({ length: 20 }, (_, i) => linha("revogado-" + i, "MENCAO_NOTA", new Date(100 - i))),
    linha("sla-21", "SLA_ESTOURADO", new Date(80)),
    linha("lembrete-22", "LEMBRETE_TAREFA", new Date(79)),
  ];
  expect((await listarNotificacoes(usuario)).map(n => n.id)).toEqual(["sla-21", "lembrete-22"]);
});
it("percorre mais de um lote revogado ate vinte visiveis sem acumular o historico", async () => {
  const validas = Array.from({ length: 21 }, (_, i) => linha("valida-" + i, "MENCAO_NOTA", new Date(700 - i)));
  banco = [...Array.from({ length: 205 }, (_, i) => linha("revogada-" + i, "MENCAO_NOTA", new Date(1000 - i))), ...validas];
  permitidos = new Set(validas.map(n => n.refId));
  expect((await listarNotificacoes(usuario)).map(n => n.id)).toEqual(validas.slice(0, 20).map(n => n.id));
  expect(m.linhas).toHaveBeenCalledTimes(3);
  expect(m.atendimentos).toHaveBeenCalledTimes(3);
  expect(m.escopo).toHaveBeenCalledTimes(1);
  for (const [q] of m.linhas.mock.calls) {
    expect(q.take).toBe(100);
    expect(q.orderBy).toEqual([{ criadaEm: "desc" }, { id: "desc" }]);
    expect(q.where.usuarioId).toBe("u");
  }
});
it("mantem os vinte visiveis mistos na ordem SQL com empate por id e cursor estrito", async () => {
  banco = Array.from({ length: 26 }, (_, i) =>
    linha(String(30 - i).padStart(4, "0"), i % 2 ? "SLA_ESTOURADO" : "MENCAO_NOTA"));
  permitidos = new Set(banco.filter(n => n.tipo === "MENCAO_NOTA").map(n => n.refId));
  banco[2].lidaEm = new Date(1);
  const esperados = banco.slice(0, 20).map(n => n.id);
  const lista = await listarNotificacoes(usuario);
  expect(lista.map(n => n.id)).toEqual(esperados);
  expect(lista[2].lida).toBe(true);
  expect(m.linhas).toHaveBeenCalledTimes(1);
  expect(m.linhas.mock.calls[0][0].orderBy).toEqual([{ criadaEm: "desc" }, { id: "desc" }]);
});
it("deduplica referencias por lote e exclui refTipo incorreto sem N+1", async () => {
  banco = [
    { ...linha("errada", "MENCAO_NOTA", new Date(100), "mesmo"), refTipo: "Tarefa" },
    ...Array.from({ length: 25 }, (_, i) => linha("n-" + i, "MENCAO_NOTA", new Date(99 - i), "mesmo")),
  ];
  permitidos = new Set(["mesmo"]);
  expect((await listarNotificacoes(usuario)).map(n => n.id)).toEqual(banco.slice(1, 21).map(n => n.id));
  expect(m.atendimentos).toHaveBeenCalledTimes(1);
  expect(m.atendimentos.mock.calls[0][0]).toEqual({
    where: { AND: [
      { id: { in: ["mesmo"] } },
      { finalidade: "COMERCIAL" },
      { conversa: { contatoId: { not: null }, grupoId: null } },
    ] },
    select: { id: true },
  });
});
it("cursor de empate usa a ultima linha SQL examinada mesmo quando toda pagina foi revogada", async () => {
  banco = Array.from({ length: 103 }, (_, i) => linha(String(200 - i).padStart(4, "0"), "MENCAO_NOTA"));
  permitidos = new Set([banco[102].refId]);
  expect((await listarNotificacoes(usuario)).map(n => n.id)).toEqual([banco[102].id]);
  expect(m.linhas).toHaveBeenCalledTimes(2);
  expect(m.linhas.mock.calls[1][0].where.OR).toEqual([
    { criadaEm: { lt: new Date(0) } }, { criadaEm: new Date(0), id: { lt: banco[99].id } },
  ]);
});
it.each(["vazio", "legados", "referencia-invalida"])("escopo lazy nao consulta ACL para %s", async caso => {
  banco = caso === "vazio" ? [] : caso === "legados" ? [linha("sla", "SLA_ESTOURADO"), linha("tarefa", "LEMBRETE_TAREFA")]
    : [{ ...linha("invalida", "MENCAO_NOTA"), refTipo: "Tarefa" }];
  const resultado = await listarNotificacoes(usuario);
  expect(resultado.map(n => n.id)).toEqual(caso === "legados" ? ["sla", "tarefa"] : []);
  expect(m.escopo).not.toHaveBeenCalled();
  expect(m.atendimentos).not.toHaveBeenCalled();
});
it("adia escopo ate o primeiro lote com referencia de mencao valida", async () => {
  banco = [...Array.from({ length: 100 }, (_, i) => ({ ...linha("errada-" + i, "MENCAO_NOTA", new Date(1000 - i)), refTipo: "Tarefa" })), linha("visivel", "MENCAO_NOTA", new Date(1))];
  m.escopo.mockImplementation(async () => {
    expect(m.linhas).toHaveBeenCalledTimes(2);
    return { finalidade: "COMERCIAL" };
  });
  expect((await listarNotificacoes(usuario)).map(n => n.id)).toEqual(["visivel"]);
  expect(m.escopo).toHaveBeenCalledTimes(1);
});
it("memo de escopo nao atravessa chamadas e revogacao retira titulo/link", async () => {
  banco = [linha("visivel", "MENCAO_NOTA")];
  expect((await listarNotificacoes(usuario)).map(n => n.id)).toEqual(["visivel"]);
  permitidos.clear();
  expect(await listarNotificacoes(usuario)).toEqual([]);
  expect(m.escopo).toHaveBeenCalledTimes(2);
  expect(m.atendimentos).toHaveBeenCalledTimes(2);
});
