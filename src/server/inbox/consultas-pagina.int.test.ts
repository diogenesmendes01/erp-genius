import { DriverWhatsApp } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { registrarEvento } from "@/server/_shared";
import { contarChipsInbox, listarAtendimentosPagina, listarMensagensPagina, obterItemListaInbox } from "./consultas-pagina";
import { codificarCursor, cursorThreadValido } from "./cursor";
import { configPadrao } from "@/server/aria/config-schema";
import type { OrigemEnvio } from "@prisma/client";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let admin: U, outro: U, numeroId: string;
const sess = (u: U) => ({ id: u.id, nome: u.nome, papeis: u.papeis }) as never;
let seq = 0;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR]);
  outro = await criarUsuario([Papel.VENDEDOR]);
  numeroId = (await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990000", rotulo: "Sec", driver: DriverWhatsApp.BAILEYS, finalidade: "COBRANCA" } })).id;
});
afterAll(() => prisma.$disconnect());

async function criarAtendimento(ultimaMensagemEm: Date | null, extra: { naoLidas?: number } = {}) {
  seq += 1;
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+5069${String(seq).padStart(7, "0")}`, nomeExibicao: `Contato ${seq}` } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId: contato.id } });
  return prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "SECRETARIA::", finalidade: "SECRETARIA", ultimaMensagemEm, naoLidas: extra.naoLidas ?? 0 } });
}

describe("lista paginada por cursor", () => {
  it("o item traz responsável, dono da linha, setores do número (legado COBRANCA → FINANCEIRO) e origem da transferência", async () => {
    const a = await criarAtendimento(new Date("2026-10-01T00:00:00Z"));
    const [item] = (await listarAtendimentosPagina(sess(admin), {}, null)).itens;
    expect(item).toMatchObject({ id: a.id, responsavelId: null, numeroDonoId: null, setoresDoNumero: ["FINANCEIRO"], atendimentoOrigemId: null });
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { setores: { create: [{ finalidade: "SECRETARIA" }, { finalidade: "COMERCIAL" }] } } });
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { responsavelId: outro.id, atendimentoOrigemId: null } });
    const [depois] = (await listarAtendimentosPagina(sess(admin), {}, null)).itens;
    expect(depois).toMatchObject({ responsavelId: outro.id, setoresDoNumero: ["COMERCIAL", "SECRETARIA"] });
  });

  it("capacidades do item: só MOTOR ativo com sessão CONECTADO libera os recursos do motor", async () => {
    await criarAtendimento(new Date("2026-10-01T00:00:00Z"));
    const capacidades = async () => (await listarAtendimentosPagina(sess(admin), {}, null)).itens[0]!.capacidades;
    expect(await capacidades()).toEqual([]);
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { driver: "MOTOR", sessao: "DESCONECTADO" } });
    expect(await capacidades()).toEqual([]);
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { sessao: "CONECTADO" } });
    expect(await capacidades()).toEqual(expect.arrayContaining(["editar", "apagar", "reagir", "gif", "figurinha"]));
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { ativo: false } });
    expect(await capacidades()).toEqual([]);
  });

  it("cursor estável com empate e inserção concorrente", async () => {
    const mesmo = new Date("2026-10-01T12:00:00.000Z");
    const criados: string[] = [];
    for (let i = 0; i < 120; i++) criados.push((await criarAtendimento(mesmo)).id);
    const p1 = await listarAtendimentosPagina(sess(admin), {}, null);
    expect(p1.itens).toHaveLength(50);
    for (let i = 0; i < 3; i++) await criarAtendimento(new Date("2026-10-02T12:00:00.000Z"));
    const p2 = await listarAtendimentosPagina(sess(admin), {}, p1.proximo);
    const p3 = await listarAtendimentosPagina(sess(admin), {}, p2.proximo);
    expect(p2.itens).toHaveLength(50);
    expect(p3.itens).toHaveLength(20);
    expect(p3.proximo).toBeNull();
    const todosIds = [...p1.itens, ...p2.itens, ...p3.itens].map((i) => i.id);
    expect(new Set(todosIds).size).toBe(120);
    expect((await contarChipsInbox(sess(admin), {})).todas).toBe(123);
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

  it("C4: naoLidas com leitura registrada considera só ENTRADA depois de lidaAte, por usuário, sem lista global", async () => {
    const lidaAte = new Date("2026-10-01T00:00:00Z");
    const comNova = await criarAtendimento(new Date("2026-10-03T00:00:00Z"));
    const semNova = await criarAtendimento(new Date("2026-10-02T00:00:00Z"));
    const msg = (a: { id: string; conversaId: string }, criadoEm: Date, direcao: "ENTRADA" | "SAIDA") =>
      prisma.mensagemWhatsApp.create({ data: { numeroId, conversaId: a.conversaId, atendimentoId: a.id, direcao, driver: DriverWhatsApp.BAILEYS, corpo: "x", criadoEm } });
    await msg(comNova, new Date("2026-10-02T00:00:00Z"), "ENTRADA");
    await msg(semNova, new Date("2026-10-02T00:00:00Z"), "SAIDA");
    await msg(semNova, new Date("2026-09-30T00:00:00Z"), "ENTRADA");
    for (const a of [comNova, semNova]) await prisma.preferenciaConversaUsuario.create({ data: { usuarioId: admin.id, conversaId: a.conversaId, lidaAte } });
    const espiao = vi.spyOn(prisma, "$queryRaw");
    try {
      const r = await listarAtendimentosPagina(sess(admin), { naoLidas: true }, null);
      expect(r.itens.map((i) => i.id)).toEqual([comNova.id]);
      const arg = espiao.mock.calls[0][0] as unknown as { sql?: string; strings?: string[] };
      const sql = String(arg.sql ?? arg.strings?.join("?"));
      expect(sql).toMatch(/FROM "PreferenciaConversaUsuario" p/);
      expect(sql).toMatch(/p\."usuarioId" = /);
    } finally { espiao.mockRestore(); }
    const outroAdm = await criarUsuario([Papel.ADMINISTRADOR]);
    expect((await contarChipsInbox(sess(admin), {})).naoLidas).toBe(1);
    expect((await contarChipsInbox(sess(outroAdm), {})).naoLidas).toBe(0);
    expect((await listarAtendimentosPagina(sess(outroAdm), { naoLidas: true }, null)).itens).toHaveLength(0);
  });

  it("C4: ramos do contador compartilhado e da marcada como não lida, sempre pela preferência DO usuário", async () => {
    const outroAdm = await criarUsuario([Papel.ADMINISTRADOR]);
    const entrada = (a: { id: string; conversaId: string }, criadoEm: Date) =>
      prisma.mensagemWhatsApp.create({ data: { numeroId, conversaId: a.conversaId, atendimentoId: a.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "x", criadoEm } });
    const pref = (usuarioId: string, conversaId: string, data: { lidaAte?: Date; marcadaNaoLida?: boolean; fixadaEm?: Date }) =>
      prisma.preferenciaConversaUsuario.create({ data: { usuarioId, conversaId, ...data } });
    const ultimaEntrada = new Date("2026-10-02T00:00:00Z"), depoisDela = new Date("2026-10-03T00:00:00Z");
    const semPref = await criarAtendimento(new Date("2026-10-05T00:00:00Z"), { naoLidas: 2 });
    const lida = await criarAtendimento(new Date("2026-10-04T00:00:00Z"), { naoLidas: 2 });
    await entrada(lida, ultimaEntrada);
    await pref(admin.id, lida.conversaId, { lidaAte: depoisDela });
    const lidaPorOutro = await criarAtendimento(new Date("2026-10-03T00:00:00Z"), { naoLidas: 2 });
    await entrada(lidaPorOutro, ultimaEntrada);
    await pref(outroAdm.id, lidaPorOutro.conversaId, { lidaAte: depoisDela });
    const soFixada = await criarAtendimento(new Date("2026-10-02T00:00:00Z"), { naoLidas: 1 });
    await pref(admin.id, soFixada.conversaId, { fixadaEm: new Date() });
    const marcada = await criarAtendimento(new Date("2026-10-01T00:00:00Z"));
    await entrada(marcada, new Date("2026-09-30T00:00:00Z"));
    await pref(admin.id, marcada.conversaId, { lidaAte: depoisDela, marcadaNaoLida: true });
    const marcadaPorOutro = await criarAtendimento(new Date("2026-09-30T00:00:00Z"));
    await pref(outroAdm.id, marcadaPorOutro.conversaId, { marcadaNaoLida: true });

    const ids = async (u: U) => (await listarAtendimentosPagina(sess(u), { naoLidas: true }, null)).itens.map((i) => i.id);
    expect(await ids(admin)).toEqual([soFixada.id, semPref.id, lidaPorOutro.id, marcada.id]);
    expect(await ids(outroAdm)).toEqual([semPref.id, lida.id, soFixada.id, marcadaPorOutro.id]);
  });

  it("C3: o índice de cursor da lista casa com a ordenação (DESC NULLS LAST, id DESC)", async () => {
    const [idx] = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'AtendimentoWhatsApp_ultimaMensagemEm_id_idx'`;
    expect(idx.indexdef).toContain('("ultimaMensagemEm" DESC NULLS LAST, id DESC)');
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
  it("notas do atendimento não comercial vêm na carga e em depois; antes devolve null", async () => {
    const a = await criarAtendimento(new Date());
    await prisma.mensagemWhatsApp.createMany({ data: Array.from({ length: 65 }, (_, i) => ({
      atendimentoId: a.id, conversaId: a.conversaId, numeroId, direcao: "ENTRADA" as const, driver: DriverWhatsApp.BAILEYS,
      corpo: `m${i}`, criadoEm: new Date(Date.UTC(2026, 9, 1, 0, 0, i)),
    })) });
    for (const nota of ["primeira", "segunda"]) {
      await prisma.$transaction((tx) => registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: admin.id, payload: { nota } }));
    }
    const p1 = (await listarMensagensPagina(sess(admin), a.id, {}))!;
    expect(p1.notas?.map((n) => [n.nota, n.origem])).toEqual([["primeira", "atendimento"], ["segunda", "atendimento"]]);
    expect((await listarMensagensPagina(sess(admin), a.id, { antes: p1.antes! }))!.notas).toBeNull();
    expect((await listarMensagensPagina(sess(admin), a.id, { depois: p1.depois! }))!.notas).toHaveLength(2);
    expect(await listarMensagensPagina(sess(outro), a.id, {})).toBeNull();
  });

  it("notas arquivadas não voltam e só as 50 mais recentes são consultadas", async () => {
    const a = await criarAtendimento(new Date());
    const base = Date.UTC(2026, 9, 1);
    const notas: { id: string }[] = [];
    for (let i = 0; i < 51; i++) {
      const e = await prisma.$transaction((tx) => registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: admin.id, payload: { nota: `n${i}` } }));
      notas.push(e);
      await prisma.evento.update({ where: { id: e.id }, data: { criadoEm: new Date(base + i * 1000) } });
    }
    const pagina = (await listarMensagensPagina(sess(admin), a.id, {}))!;
    expect(pagina.notas).toHaveLength(50);
    expect(pagina.notas?.[0].nota).toBe("n1");
    expect(pagina.notas?.at(-1)?.nota).toBe("n50");
    await prisma.$transaction((tx) => registrarEvento(tx, { tipo: "NotaInternaArquivada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: admin.id, payload: { eventoId: notas[50].id } }));
    expect((await listarMensagensPagina(sess(admin), a.id, {}))!.notas?.some((n) => n.id === notas[50].id)).toBe(false);
  });

  it("mescla notas do atendimento e da oportunidade por data/id sem vazar lead pela linha", async () => {
    const a = await criarAtendimento(new Date());
    const donoLead = await criarUsuario([Papel.VENDEDOR]);
    const lead = await prisma.oportunidade.create({ data: { nome: "Lead de outro", vendedorDonoId: donoLead.id } });
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { finalidade: "VENDAS", donoId: outro.id } });
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { finalidade: "COMERCIAL", contextoChave: "COMERCIAL::", leadId: lead.id } });
    const at = await prisma.$transaction((tx) => registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: admin.id, payload: { nota: "do atendimento" } }));
    const op = await prisma.$transaction((tx) => registrarEvento(tx, { tipo: "NotaInterna", agregadoTipo: "Lead", agregadoId: lead.id, autorId: admin.id, payload: { nota: "da oportunidade" } }));
    const empate = new Date("2026-10-01T12:00:00.000Z");
    await prisma.evento.updateMany({ where: { id: { in: [at.id, op.id] } }, data: { criadoEm: empate } });
    const esperado = [at, op].sort((x, y) => x.id.localeCompare(y.id)).map((e) => e.id);
    const daAdmin = (await listarMensagensPagina(sess(admin), a.id, {}))!;
    expect(daAdmin.notas?.map((n) => n.id)).toEqual(esperado);
    expect(daAdmin.notas?.map((n) => n.origem).sort()).toEqual(["atendimento", "oportunidade"]);
    const daLinha = (await listarMensagensPagina(sess(outro), a.id, {}))!;
    expect(daLinha.notas?.map((n) => [n.nota, n.origem])).toEqual([["do atendimento", "atendimento"]]);
    expect((await listarMensagensPagina(sess(donoLead), a.id, {}))?.notas?.some((n) => n.origem === "oportunidade")).toBe(true);
  });

  it("antes/depois sem sobreposição e 404 fora do escopo", async () => {
    const a = await criarAtendimento(new Date());
    const t0 = Date.UTC(2026, 9, 1);
    const ids: string[] = [];
    for (let i = 0; i < 150; i++) {
      const m = await prisma.mensagemWhatsApp.create({ data: { atendimentoId: a.id, conversaId: a.conversaId, numeroId, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: `m${i}`, criadoEm: new Date(t0 + Math.floor(i / 3) * 1000) } });
      ids.push(m.id);
    }
    const esperado = (await prisma.mensagemWhatsApp.findMany({ where: { atendimentoId: a.id }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true } })).map((m) => m.id);
    const p1 = (await listarMensagensPagina(sess(admin), a.id, {}))!;
    expect(p1.mensagens).toHaveLength(60);
    expect(p1.temMais).toBe(true);
    expect(p1.depois).not.toBeNull();
    expect(p1.depois).toBe(codificarCursor({ em: p1.mensagens.at(-1)!.criadoEm, id: p1.mensagens.at(-1)!.id }));
    expect(p1.antes).toBe(codificarCursor({ em: p1.mensagens[0].criadoEm, id: p1.mensagens[0].id }));
    const p2 = (await listarMensagensPagina(sess(admin), a.id, { antes: p1.antes! }))!;
    const p3 = (await listarMensagensPagina(sess(admin), a.id, { antes: p2.antes! }))!;
    expect(p2.mensagens).toHaveLength(60);
    expect(p3.mensagens).toHaveLength(30);
    expect(p3.temMais).toBe(false);
    expect(p3.antes).not.toBeNull();
    expect([...p3.mensagens, ...p2.mensagens, ...p1.mensagens].map((m) => m.id)).toEqual(esperado);
    const f1 = (await listarMensagensPagina(sess(admin), a.id, { depois: p2.antes!, limite: 100 }))!;
    expect(f1.mensagens.length).toBeGreaterThan(0);
    expect(f1.mensagens[0].id).toBe(esperado[esperado.indexOf(p2.mensagens[0].id) + 1]);
    expect(f1.depois).not.toBeNull();
    const f2 = f1.depois ? (await listarMensagensPagina(sess(admin), a.id, { depois: f1.depois }))! : null;
    const juntas = [...f1.mensagens, ...(f2?.mensagens ?? [])].map((m) => m.id);
    expect(new Set(juntas).size).toBe(juntas.length);
    expect(juntas.at(-1)).toBe(esperado.at(-1));
    const nova = await prisma.mensagemWhatsApp.create({ data: { atendimentoId: a.id, conversaId: a.conversaId, numeroId, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "nova", criadoEm: new Date(t0 + 999_000) } });
    const novas = (await listarMensagensPagina(sess(admin), a.id, { depois: p1.depois! }))!;
    expect(novas.mensagens.map((m) => m.id)).toEqual([nova.id]);
    expect(novas.temMais).toBe(false);
    expect((await listarMensagensPagina(sess(admin), a.id, { limite: 500 }))!.mensagens).toHaveLength(100);
    expect(await listarMensagensPagina(sess(outro), a.id, {})).toBeNull();
    expect(await listarMensagensPagina(sess(admin), "inexistente", {})).toBeNull();
    const cursorNulo = codificarCursor({ em: null, id: p1.mensagens[0].id });
    expect(await listarMensagensPagina(sess(admin), a.id, { antes: cursorNulo })).toBeNull();
    expect(await listarMensagensPagina(sess(admin), a.id, { depois: cursorNulo })).toBeNull();
    expect(cursorThreadValido(cursorNulo)).toBe(false);
    expect(cursorThreadValido(p1.antes!)).toBe(true);
  });

  it("favorita é do usuário, participante e clientMessageId vêm no item", async () => {
    const a = await criarAtendimento(new Date());
    const m = await prisma.mensagemWhatsApp.create({ data: { atendimentoId: a.id, conversaId: a.conversaId, numeroId, direcao: "SAIDA", driver: DriverWhatsApp.BAILEYS, corpo: "oi", clientMessageId: "cmid-1", participanteNome: "Fulano" } });
    await prisma.favoritoMensagemUsuario.create({ data: { usuarioId: admin.id, mensagemId: m.id } });
    const adm2 = await criarUsuario([Papel.ADMINISTRADOR]);
    expect((await listarMensagensPagina(sess(admin), a.id, {}))!.mensagens[0]).toMatchObject({ favorita: true, clientMessageId: "cmid-1", participanteNome: "Fulano" });
    expect((await listarMensagensPagina(sess(adm2), a.id, {}))!.mensagens[0].favorita).toBe(false);
  });
});

describe("obterItemListaInbox (deep link)", () => {
  it("devolve a linha de qualquer atendimento do escopo, mesmo fora da primeira página, e null fora do escopo", async () => {
    const antigo = await criarAtendimento(new Date("2020-01-01T00:00:00Z"));
    for (let i = 0; i < 3; i++) await criarAtendimento(new Date("2026-10-01T00:00:00Z"));
    const p1 = await listarAtendimentosPagina(sess(admin), {}, null, 2);
    expect(p1.itens.map((i) => i.id)).not.toContain(antigo.id);
    const item = await obterItemListaInbox(sess(admin), antigo.id);
    expect(item?.id).toBe(antigo.id);
    expect(item?.driver).toBe(DriverWhatsApp.BAILEYS);
    expect(await obterItemListaInbox(sess(admin), "inexistente")).toBeNull();
    expect(await obterItemListaInbox(sess(outro), antigo.id)).toBeNull();
  });
});

describe("lista só com envio (destino do encaminhar, Fase 4D)", () => {
  it("com `enviar` a lista usa o escopo de envio: fica de fora o convite sem envio e o atendimento encerrado", async () => {
    const fin = await criarUsuario([Papel.FINANCEIRO]);
    const comEnvio = await criarAtendimento(new Date("2026-10-03T00:00:00Z"));
    const semEnvio = await criarAtendimento(new Date("2026-10-02T00:00:00Z"));
    const encerrado = await criarAtendimento(new Date("2026-10-01T00:00:00Z"));
    await prisma.atendimentoWhatsApp.update({ where: { id: encerrado.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    const convite = (atendimentoId: string, podeEnviar: boolean) => prisma.participanteAtendimentoWhatsApp.create({ data: {
      atendimentoId, usuarioId: fin.id, concedenteId: admin.id, podeEnviar, motivo: "teste",
      inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3600_000) } });
    await convite(comEnvio.id, true); await convite(semEnvio.id, false); await convite(encerrado.id, true);
    const ids = async (o?: { enviar?: boolean }) => (await listarAtendimentosPagina(sess(fin), {}, null, undefined, o)).itens.map((i) => i.id);
    expect(await ids()).toEqual([comEnvio.id, semEnvio.id, encerrado.id]);
    expect(await ids({ enviar: true })).toEqual([comEnvio.id]);
    expect((await contarChipsInbox(sess(fin), {})).todas).toBe(3);
    expect((await contarChipsInbox(sess(fin), {}, { enviar: true })).todas).toBe(1);
  });
  it("com `enviar` o número inativo também sai, e os filtros (número, busca) continuam valendo", async () => {
    const a = await criarAtendimento(new Date("2026-10-03T00:00:00Z"));
    const ids = async (f: Parameters<typeof listarAtendimentosPagina>[1]) => (await listarAtendimentosPagina(sess(admin), f, null, undefined, { enviar: true })).itens.map((i) => i.id);
    expect(await ids({ numeroId })).toEqual([a.id]);
    expect(await ids({ numeroId: "outro" })).toEqual([]);
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { ativo: false } });
    expect(await ids({})).toEqual([]);
  });
});

describe("contagens dos chips (universo autorizado, além da página)", () => {
  it("retira somente os três filtros dos chips, mantém setor/número/status/busca e conta atendimentos", async () => {
    const a = await criarAtendimento(null, { naoLidas: 9 });
    const b = await criarAtendimento(null);
    const c = await criarAtendimento(null, { naoLidas: 3 });
    const fora = await criarAtendimento(null, { naoLidas: 50 });
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { responsavelId: admin.id, prazoRespostaEm: new Date("2020-01-01") } });
    await prisma.atendimentoWhatsApp.update({ where: { id: c.id }, data: { responsavelId: outro.id, encerradoEm: new Date(), status: "ENCERRADO" } });
    for (const item of [a, b, c]) await prisma.conversaWhatsApp.update({ where: { id: item.conversaId }, data: { contato: { update: { nomeExibicao: "Alvo" } } } });
    await prisma.conversaWhatsApp.update({ where: { id: fora.conversaId }, data: { contato: { update: { nomeExibicao: "Outro" } } } });
    const filtros = { setor: "SECRETARIA" as const, numeroId, busca: "Alvo", responsavel: "fila", naoLidas: true, prazoEstourado: true };
    expect(await contarChipsInbox(sess(admin), filtros)).toEqual({ todas: 3, minhas: 1, naoLidas: 2, prazo: 1, fila: 1 });
    expect(await contarChipsInbox(sess(admin), { ...filtros, status: "ENCERRADO" })).toEqual({ todas: 1, minhas: 0, naoLidas: 1, prazo: 0, fila: 0 });
    expect(await contarChipsInbox(sess(admin), { ...filtros, numeroId: "inexistente" })).toEqual({ todas: 0, minhas: 0, naoLidas: 0, prazo: 0, fila: 0 });
    expect(await contarChipsInbox(sess(admin), { ...filtros, setor: "COMERCIAL" })).toEqual({ todas: 0, minhas: 0, naoLidas: 0, prazo: 0, fila: 0 });
    expect(await contarChipsInbox(sess(outro), {})).toEqual({ todas: 0, minhas: 0, naoLidas: 0, prazo: 0, fila: 0 });
  });
  it("não lidas são pessoais: lidaAte e marca explícita não usam a soma compartilhada", async () => {
    const a = await criarAtendimento(null, { naoLidas: 20 });
    const b = await criarAtendimento(null);
    await prisma.preferenciaConversaUsuario.create({ data: { usuarioId: admin.id, conversaId: a.conversaId, lidaAte: new Date() } });
    await prisma.preferenciaConversaUsuario.create({ data: { usuarioId: admin.id, conversaId: b.conversaId, marcadaNaoLida: true } });
    expect((await contarChipsInbox(sess(admin), {})).naoLidas).toBe(1);
  });
  it("prazo estrito exclui instante exato, respondido e encerrado; fila exclui encerrados", async () => {
    const agora = new Date("2026-10-22T12:00:00Z");
    for (const extra of [
      { prazoRespostaEm: new Date(agora.getTime() - 1) },
      { prazoRespostaEm: agora },
      { prazoRespostaEm: new Date(agora.getTime() - 1), primeiraRespostaEm: agora },
      { prazoRespostaEm: new Date(agora.getTime() - 1), encerradoEm: agora, status: "ENCERRADO" as const },
    ]) {
      const a = await criarAtendimento(null);
      await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: extra });
    }
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(agora);
    try { expect(await contarChipsInbox(sess(admin), {})).toMatchObject({ todas: 4, prazo: 1, fila: 3 }); }
    finally { vi.useRealTimers(); }
  });
  it("envio restringe as contagens pelo mesmo escopo da lista (aberto e número ativo)", async () => {
    const a = await criarAtendimento(null), b = await criarAtendimento(null);
    await prisma.atendimentoWhatsApp.update({ where: { id: b.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    expect((await contarChipsInbox(sess(admin), {}, { enviar: true })).todas).toBe(1);
    expect((await listarAtendimentosPagina(sess(admin), {}, null, 50, { enviar: true })).itens.map((i) => i.id)).toEqual([a.id]);
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { ativo: false } });
    expect((await contarChipsInbox(sess(admin), {}, { enviar: true })).todas).toBe(0);
    expect((await contarChipsInbox(sess(admin), {})).todas).toBe(2);
  });
});


describe("estado Aria e autoria343", () => {
  const em = new Date("2026-10-24T12:00:00Z");
  async function publicar343() {
    await prisma.agenteIA.create({ data: { id: "aria", estado: "ATIVA" } });
    await prisma.versaoAgenteIA.create({ data: { numero: 1, status: "PUBLICADA", config: configPadrao(), criadaPorId: admin.id, publicadaPorId: admin.id, publicadaEm: em } });
  }
  async function comercial343(responsavelId: string | null = null) {
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { driver: "MOTOR", finalidade: "VENDAS" } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5068" + String(++seq).padStart(7, "0"), nomeExibicao: "Ficticio343" } });
    const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId: contato.id } });
    return prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "343", finalidade: "COMERCIAL", responsavelId, ultimaMensagemEm: em } });
  }
  type A343 = Awaited<ReturnType<typeof comercial343>>;
  async function mensagem343(a: A343, origem: OrigemEnvio, autorId: string | null, corpo: string, criadoEm = em, id?: string) {
    return prisma.mensagemWhatsApp.create({ data: { id, atendimentoId: a.id, conversaId: a.conversaId, numeroId, direcao: "SAIDA", tipo: "TEXTO", origem, autorId, corpo, criadoEm, driver: "MOTOR", status: "ENVIADA", providerMessageId: "343-msg-" + ++seq } });
  }
  async function sugestao343(a: A343, criadoEm: Date, expiraEm: Date | null = null) {
    const ancora = await prisma.mensagemWhatsApp.create({ data: { atendimentoId: a.id, conversaId: a.conversaId, numeroId, direcao: "ENTRADA", corpo: "Ancora ficticia", criadoEm: new Date(em.getTime() - 1000), driver: "MOTOR", status: "ENTREGUE", providerMessageId: "343-ancora-" + ++seq } });
    const turno = await prisma.turnoAgenteIA.create({ data: { atendimentoId: a.id, ancoraMensagemId: ancora.id, tipo: "ATENDIMENTO", resultado: "SUGERIU" } });
    return prisma.acaoAgenteIA.create({ data: { atendimentoId: a.id, turnoId: turno.id, acao: "RESPONDER", status: "SUGERIDA", modoConfigurado: "SUGERIR", confianca: 70, payload: { texto: "SEGREDO_SUGESTAO_343_NAO_SERIALIZAR" }, criadoEm, expiraEm, reversivel: false } });
  }
  it("pagina e deep link trazem estado e autoria da IA sem mudar preview", async () => {
    await publicar343(); const a = await comercial343();
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ estadoAria: "ia", atendidoPorVoce: false, previaAutor: null, previaRotulo: null });
    await mensagem343(a, "IA", admin.id, "Texto Aria ficticio");
    const campos = { id: a.id, estadoAria: "ia", atendidoPorVoce: false, previaAutor: "aria", previaRotulo: null, preview: "Texto Aria ficticio" };
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject(campos);
    expect((await listarAtendimentosPagina(sess(admin), {}, null)).itens[0]).toMatchObject(campos);
  });
  it("responsavel da conversa e autoria sao campos independentes", async () => {
    const a = await comercial343(admin.id); await mensagem343(a, "HUMANO", outro.id, "Outra pessoa");
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ estadoAria: "humano", atendidoPorVoce: true, previaAutor: "pessoa", previaRotulo: outro.nome.split(" ")[0] });
    await mensagem343(a, "GESTAO", admin.id, "Proprio automatico", new Date(em.getTime() + 1));
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ previaAutor: "voce", previaRotulo: null });
  });
  it("sugestao posterior so envia rotulo; mensagem posterior vence a previa, nao o estado", async () => {
    await publicar343(); const a = await comercial343(); await mensagem343(a, "IA", null, "Ultima mensagem");
    await sugestao343(a, new Date(em.getTime() + 1));
    const item = await obterItemListaInbox(sess(admin), a.id);
    expect(item).toMatchObject({ estadoAria: "aprovacao", previaAutor: "sugestao", previaRotulo: "Responder", preview: "Ultima mensagem" });
    expect(JSON.stringify(item)).not.toContain("SEGREDO_SUGESTAO_343_NAO_SERIALIZAR");
    await mensagem343(a, "HUMANO", admin.id, "Posterior", new Date(em.getTime() + 2));
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ estadoAria: "aprovacao", previaAutor: "voce", previaRotulo: null, preview: "Posterior" });
  });
  it("sugestao vencida nao altera estado nem previa; handoff e pausa respeitam342", async () => {
    await publicar343(); const a = await comercial343(); await mensagem343(a, "HUMANO", admin.id, "Atual"); await sugestao343(a, new Date(em.getTime() + 1), new Date(Date.now() - 1000));
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ estadoAria: "ia", previaAutor: "voce" });
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { iaPausadaEm: new Date(em.getTime() + 3), iaPausaMotivo: "HANDOFF" } });
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ estadoAria: "handoff" });
    await mensagem343(a, "CELULAR", null, "Resposta celular", new Date(em.getTime() + 4));
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ estadoAria: "humano", previaAutor: null });
  });
  it("empate de mensagem usa idDESC sem alterar cursor de atendimento", async () => {
    const a = await comercial343(); await mensagem343(a, "HUMANO", outro.id, "Menor", em, "343-a"); await mensagem343(a, "IA", null, "Maior", em, "343-z");
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ previaAutor: "aria", preview: "Maior" });
  });
  it("pagina vazia e deep link fora da ACL nao inicializam contexto", async () => {
    const upsert = vi.spyOn(prisma.configIA, "upsert"), agente = vi.spyOn(prisma.agenteIA, "findUnique");
    try {
      expect((await listarAtendimentosPagina(sess(admin), {}, null)).itens).toEqual([]);
      const a = await comercial343(admin.id); expect(await obterItemListaInbox(sess(outro), a.id)).toBeNull();
      expect(upsert).not.toHaveBeenCalled(); expect(agente).not.toHaveBeenCalled();
    } finally { upsert.mockRestore(); agente.mockRestore(); }
  });
  it("secretaria sem outras prioridades continua sem estado Aria", async () => {
    await publicar343(); const a = await criarAtendimento(em);
    expect(await obterItemListaInbox(sess(admin), a.id)).toMatchObject({ estadoAria: null, atendidoPorVoce: false, previaAutor: null, previaRotulo: null });
  });
  it("fixadas100+pagina200 usam contexto e sugestoes uma vez por lote autorizado", async () => {
    await publicar343(); const ids = Array.from({ length: 301 }, (_, n) => "343-lote-" + String(n).padStart(4, "0"));
    await prisma.numeroWhatsApp.update({ where: { id: numeroId }, data: { driver: "MOTOR", finalidade: "VENDAS" } });
    await prisma.contatoWhatsApp.createMany({ data: ids.map((id, n) => ({ id: "c-" + id, telefoneE164: "+5067" + String(n).padStart(7, "0") })) });
    await prisma.conversaWhatsApp.createMany({ data: ids.map(id => ({ id: "v-" + id, contatoId: "c-" + id, numeroId })) });
    await prisma.atendimentoWhatsApp.createMany({ data: ids.map(id => ({ id, conversaId: "v-" + id, contextoChave: "343", finalidade: "COMERCIAL", ultimaMensagemEm: em })) });
    await prisma.preferenciaConversaUsuario.createMany({ data: ids.slice(0, 100).map(id => ({ usuarioId: admin.id, conversaId: "v-" + id, fixadaEm: em })) });
    const query = vi.spyOn(prisma, "$queryRaw"), agente = vi.spyOn(prisma.agenteIA, "findUnique"), config = vi.spyOn(prisma.configIA, "upsert");
    try {
      const r = await listarAtendimentosPagina(sess(admin), {}, null, 200); expect(r.itens).toHaveLength(300); expect(r.itens.every(i => i.estadoAria === "ia")).toBe(true); expect(r.proximo).not.toBeNull();
      expect(agente).toHaveBeenCalledTimes(1); expect(config).toHaveBeenCalledTimes(1);
      const arias = query.mock.calls.map(c => c[0]).filter(q => typeof q === "object" && q !== null && "text" in q && String(q.text).includes('FROM "AcaoAgenteIA"'));
      expect(arias).toHaveLength(1); const sql = arias[0]!; if (typeof sql !== "object" || !("values" in sql)) throw Error("SQL esperado");
      expect(sql.values).toContainEqual(r.itens.map(i => i.id));
      const final = await listarAtendimentosPagina(sess(admin), {}, r.proximo, 200); expect(final.itens).toHaveLength(1); expect(final.itens[0]!.estadoAria).toBe("ia");
      expect(new Set([...r.itens, ...final.itens].map(i => i.id)).size).toBe(301);
    } finally { query.mockRestore(); agente.mockRestore(); config.mockRestore(); }
  });
});
