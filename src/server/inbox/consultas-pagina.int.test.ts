import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { listarAtendimentosPagina, listarMensagensPagina } from "./consultas-pagina";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let admin: U, outro: U, numeroId: string;
const sess = (u: U) => ({ id: u.id, nome: u.nome, papeis: u.papeis }) as never;
let seq = 0;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR]);
  outro = await criarUsuario([Papel.VENDEDOR]);
  numeroId = (await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990000", rotulo: "Sec", driver: "BAILEYS", finalidade: "COBRANCA" } })).id;
});
afterAll(() => prisma.$disconnect());

/** Atendimento SECRETARIA (admin vê tudo) com o `ultimaMensagemEm` pedido. */
async function criarAtendimento(ultimaMensagemEm: Date | null, extra: { naoLidas?: number } = {}) {
  seq += 1;
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+5069${String(seq).padStart(7, "0")}`, nomeExibicao: `Contato ${seq}` } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId: contato.id } });
  return prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "SECRETARIA::", finalidade: "SECRETARIA", ultimaMensagemEm, naoLidas: extra.naoLidas ?? 0 } });
}

describe("lista paginada por cursor", () => {
  it("cursor estável com empate e inserção concorrente", async () => {
    const mesmo = new Date("2026-10-01T12:00:00.000Z");
    const criados: string[] = [];
    for (let i = 0; i < 120; i++) criados.push((await criarAtendimento(mesmo)).id);
    const p1 = await listarAtendimentosPagina(sess(admin), {}, null);
    expect(p1.itens).toHaveLength(50);
    // Três chegam depois da página 1 (mais recentes que o cursor): não deslocam as páginas seguintes.
    for (let i = 0; i < 3; i++) await criarAtendimento(new Date("2026-10-02T12:00:00.000Z"));
    const p2 = await listarAtendimentosPagina(sess(admin), {}, p1.proximo);
    const p3 = await listarAtendimentosPagina(sess(admin), {}, p2.proximo);
    expect(p2.itens).toHaveLength(50);
    expect(p3.itens).toHaveLength(20);
    expect(p3.proximo).toBeNull();
    const todosIds = [...p1.itens, ...p2.itens, ...p3.itens].map((i) => i.id);
    expect(new Set(todosIds).size).toBe(120);
    expect(todosIds).toEqual([...criados].sort().reverse());
  });

  it("sem data de mensagem vem por último, sem repetir", async () => {
    const a = await criarAtendimento(null), b = await criarAtendimento(new Date("2026-10-01T00:00:00Z")), c = await criarAtendimento(null);
    const p1 = await listarAtendimentosPagina(sess(admin), {}, null, 2);
    const p2 = await listarAtendimentosPagina(sess(admin), {}, p1.proximo, 2);
    const ids = [...p1.itens, ...p2.itens].map((i) => i.id);
    expect(ids).toEqual([b.id, ...[a.id, c.id].sort().reverse()]);
  });

  it("regra 19: filtro naoLidas alcança conversa antiga com não lida", async () => {
    const antiga = await criarAtendimento(new Date("2020-01-01T00:00:00Z"), { naoLidas: 2 });
    const base = new Date("2026-10-01T00:00:00Z").getTime();
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < 300; i++) {
        seq += 1;
        const contato = await tx.contatoWhatsApp.create({ data: { telefoneE164: `+5069${String(seq).padStart(7, "0")}` } });
        const conversa = await tx.conversaWhatsApp.create({ data: { numeroId, contatoId: contato.id } });
        await tx.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "SECRETARIA::", finalidade: "SECRETARIA", ultimaMensagemEm: new Date(base + i * 1000) } });
      }
    }, { timeout: 60_000 });
    const semFiltro = await listarAtendimentosPagina(sess(admin), {}, null);
    expect(semFiltro.itens.some((i) => i.id === antiga.id)).toBe(false);
    const filtrada = await listarAtendimentosPagina(sess(admin), { naoLidas: true }, null);
    expect(filtrada.itens.map((i) => i.id)).toEqual([antiga.id]);
    expect(filtrada.itens[0].naoLidas).toBe(2);
  });

  it("naoLidas pessoal: marcada como não lida entra; lida até agora sai", async () => {
    const x = await criarAtendimento(new Date("2026-10-01T00:00:00Z"), { naoLidas: 3 });
    const y = await criarAtendimento(new Date("2026-10-02T00:00:00Z"));
    await prisma.preferenciaConversaUsuario.create({ data: { usuarioId: admin.id, conversaId: x.conversaId, lidaAte: new Date() } });
    await prisma.preferenciaConversaUsuario.create({ data: { usuarioId: admin.id, conversaId: y.conversaId, marcadaNaoLida: true } });
    const r = await listarAtendimentosPagina(sess(admin), { naoLidas: true }, null);
    expect(r.itens.map((i) => i.id)).toEqual([y.id]);
  });

  it("fixadas do usuário vêm primeiro só para ele, só na 1ª página, sem repetir", async () => {
    const velha = await criarAtendimento(new Date("2020-01-01T00:00:00Z"));
    const novas: string[] = [];
    for (let i = 0; i < 4; i++) novas.push((await criarAtendimento(new Date(Date.UTC(2026, 9, 1, i)))).id);
    await prisma.preferenciaConversaUsuario.create({ data: { usuarioId: admin.id, conversaId: velha.conversaId, fixadaEm: new Date() } });
    const adm2 = await criarUsuario([Papel.ADMINISTRADOR]);
    const p1 = await listarAtendimentosPagina(sess(admin), {}, null, 2);
    expect(p1.itens[0]).toMatchObject({ id: velha.id, fixada: true });
    expect(p1.itens).toHaveLength(3);
    const p2 = await listarAtendimentosPagina(sess(admin), {}, p1.proximo, 2);
    const ids = [...p1.itens, ...p2.itens].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(5);
    const dele = await listarAtendimentosPagina(sess(adm2), {}, null, 2);
    expect(dele.itens[0].id).toBe(novas[3]);
    expect(dele.itens.some((i) => i.fixada)).toBe(false);
  });

  it("o filtro nunca substitui o escopo", async () => {
    await criarAtendimento(new Date());
    const r = await listarAtendimentosPagina(sess(outro), { setor: "SECRETARIA", responsavel: "fila" }, null);
    expect(r.itens).toEqual([]);
  });

  it("filtros de status, responsável e prazo estourado", async () => {
    const a = await criarAtendimento(new Date("2026-10-01T00:00:00Z"));
    const b = await criarAtendimento(new Date("2026-10-02T00:00:00Z"));
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { responsavelId: admin.id, status: "EM_ATENDIMENTO" } });
    await prisma.atendimentoWhatsApp.update({ where: { id: b.id }, data: { prazoRespostaEm: new Date(Date.now() - 60_000) } });
    const ids = async (f: Parameters<typeof listarAtendimentosPagina>[1]) => (await listarAtendimentosPagina(sess(admin), f, null)).itens.map((i) => i.id);
    expect(await ids({ responsavel: "eu" })).toEqual([a.id]);
    expect(await ids({ responsavel: "fila" })).toEqual([b.id]);
    expect(await ids({ status: "EM_ATENDIMENTO" })).toEqual([a.id]);
    expect(await ids({ prazoEstourado: true })).toEqual([b.id]);
    const [item] = (await listarAtendimentosPagina(sess(admin), { responsavel: "eu" }, null)).itens;
    expect(item).toMatchObject({ responsavelNome: admin.nome, status: "EM_ATENDIMENTO", grupo: false, silenciada: false });
  });
});

describe("thread paginada", () => {
  it("antes/depois sem sobreposição e 404 fora do escopo", async () => {
    const a = await criarAtendimento(new Date());
    const t0 = Date.UTC(2026, 9, 1);
    const ids: string[] = [];
    for (let i = 0; i < 150; i++) {
      // 3 mensagens por instante: o desempate por id precisa funcionar.
      const m = await prisma.mensagemWhatsApp.create({ data: { atendimentoId: a.id, conversaId: a.conversaId, numeroId, direcao: "ENTRADA", driver: "BAILEYS", corpo: `m${i}`, criadoEm: new Date(t0 + Math.floor(i / 3) * 1000) } });
      ids.push(m.id);
    }
    const esperado = (await prisma.mensagemWhatsApp.findMany({ where: { atendimentoId: a.id }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true } })).map((m) => m.id);
    const p1 = (await listarMensagensPagina(sess(admin), a.id, {}))!;
    expect(p1.mensagens).toHaveLength(60);
    expect(p1.depois).toBeNull();
    const p2 = (await listarMensagensPagina(sess(admin), a.id, { antes: p1.antes! }))!;
    const p3 = (await listarMensagensPagina(sess(admin), a.id, { antes: p2.antes! }))!;
    expect(p2.mensagens).toHaveLength(60);
    expect(p3.mensagens).toHaveLength(30);
    expect(p3.antes).toBeNull();
    expect([...p3.mensagens, ...p2.mensagens, ...p1.mensagens].map((m) => m.id)).toEqual(esperado);
    // Para a frente: da mais antiga até o fim, sem sobreposição.
    const f1 = (await listarMensagensPagina(sess(admin), a.id, { depois: p2.antes!, limite: 100 }))!;
    expect(f1.mensagens.length).toBeGreaterThan(0);
    // O cursor é exclusivo: segue a primeira mensagem da página 2.
    expect(f1.mensagens[0].id).toBe(esperado[esperado.indexOf(p2.mensagens[0].id) + 1]);
    const f2 = f1.depois ? (await listarMensagensPagina(sess(admin), a.id, { depois: f1.depois }))! : null;
    const juntas = [...f1.mensagens, ...(f2?.mensagens ?? [])].map((m) => m.id);
    expect(new Set(juntas).size).toBe(juntas.length);
    expect(juntas.at(-1)).toBe(esperado.at(-1));
    // Limite máximo 100.
    expect((await listarMensagensPagina(sess(admin), a.id, { limite: 500 }))!.mensagens).toHaveLength(100);
    // Fora do escopo: null (a rota responde 404).
    expect(await listarMensagensPagina(sess(outro), a.id, {})).toBeNull();
    expect(await listarMensagensPagina(sess(admin), "inexistente", {})).toBeNull();
  });

  it("favorita é do usuário, participante e clientMessageId vêm no item", async () => {
    const a = await criarAtendimento(new Date());
    const m = await prisma.mensagemWhatsApp.create({ data: { atendimentoId: a.id, conversaId: a.conversaId, numeroId, direcao: "SAIDA", driver: "BAILEYS", corpo: "oi", clientMessageId: "cmid-1", participanteNome: "Fulano" } });
    await prisma.favoritoMensagemUsuario.create({ data: { usuarioId: admin.id, mensagemId: m.id } });
    const adm2 = await criarUsuario([Papel.ADMINISTRADOR]);
    expect((await listarMensagensPagina(sess(admin), a.id, {}))!.mensagens[0]).toMatchObject({ favorita: true, clientMessageId: "cmid-1", participanteNome: "Fulano" });
    expect((await listarMensagensPagina(sess(adm2), a.id, {}))!.mensagens[0].favorita).toBe(false);
  });
});
