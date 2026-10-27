import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Client } from "pg";
import { Papel, Prisma } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const sessao = vi.hoisted(() => ({ id: "" }));
vi.mock("@/server/_shared/sessao", async original => {
 const o = await original<typeof import("@/server/_shared/sessao")>();
 return { ...o, exigirSessao: async () => { const u = await o.carregarUsuarioFresco(sessao.id); if (!u) throw new o.ErroAutenticacao(); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { iniciarConversaPorNumero } from "./nova-conversa-acoes";
import { CANAL_INBOX } from "@/server/inbox/barramento";

const DOMINIO = "O cadastro ou acesso mudou. Confira a conversa antes de repetir.";
const gate = () => { let liberar!: () => void; const promessa = new Promise<void>(r => { liberar = r; }); return { promessa, liberar }; };
async function prazo<T>(p: Promise<T>, ms: number, fase: string): Promise<T> {
 let timer: ReturnType<typeof setTimeout> | undefined;
 try { return await Promise.race([p, new Promise<never>((_, rejeitar) => { timer = setTimeout(() => rejeitar(Error(`Instrumentação C9: deadline ${fase}`)), ms); })]); }
 finally { if (timer) clearTimeout(timer); }
}
let atorId: string, numeroId: string, pessoaId: string, outraPessoaId: string, leadId: string, sequencia = 0;
let fetchGuard: { mock: { calls: unknown[][] } };
beforeEach(async () => {
 vi.restoreAllMocks(); fetchGuard = vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw Error("C9: envio externo bloqueado"); });
 await truncarBanco(); atorId = (await criarUsuario([Papel.VENDEDOR], "VEN fictício C9")).id; sessao.id = atorId;
 numeroId = (await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+50689991122", rotulo: "Linha fictícia C9", ativo: true, finalidade: "VENDAS", donoId: atorId, driver: "MOTOR", sessao: "DESCONECTADO" } })).id;
 pessoaId = (await prisma.pessoa.create({ data: { nome: "Pessoa autorizada C9" } })).id;
 outraPessoaId = (await prisma.pessoa.create({ data: { nome: "Outra Pessoa C9" } })).id;
});
afterEach(() => { try { expect(fetchGuard).not.toHaveBeenCalled(); } finally { vi.restoreAllMocks(); } });
afterAll(() => prisma.$disconnect());
async function foto() {
 return { pessoas: await prisma.pessoa.findMany({ orderBy: { id: "asc" } }), leads: await prisma.oportunidade.findMany({ orderBy: { id: "asc" } }), contatos: await prisma.contatoWhatsApp.findMany({ orderBy: { id: "asc" } }), conversas: await prisma.conversaWhatsApp.findMany({ orderBy: { id: "asc" } }), atendimentos: await prisma.atendimentoWhatsApp.findMany({ orderBy: { id: "asc" } }), eventos: await prisma.evento.findMany({ orderBy: { id: "asc" } }), mensagens: await prisma.mensagemWhatsApp.count(), intencoes: await prisma.intencaoMensagem.count() };
}
it.each(["COMMIT_COMPATIVEL", "ROLLBACK_WRITER", "COMMIT_INCOMPATIVEL"] as const)("C9 %s: UNIQUE real, rollback e nova leitura sem adoção silenciosa", async caso => {
 const n = ++sequencia, telefone = `+5068333${String(n).padStart(4, "0")}`, contatoWriterId = `contato-ficticio-c9-${n}`;
 leadId = (await prisma.oportunidade.create({ data: { codigo: `L-C9-${n}`, nome: "Lead autorizado C9", telefoneE164: telefone, pessoaId, vendedorDonoId: atorId } })).id;
 const entrada = { modo: "EXISTENTE" as const, telefone, numeroId, chaveIdempotencia: `c9-colisao-${n}` };
 const writer = new Client({ connectionString: process.env.DATABASE_URL }), observer = new Client({ connectionString: process.env.DATABASE_URL });
 const vazioLido = gate(), permitirInsert = gate();
 const eventos: { fase: string; ms: number }[] = [], inicio = performance.now(), pids: number[] = [];
 let pidWriter = 0, pidObserver = 0, writerAberto = false, leituraInterrompida = false, erroInsert: unknown, bloqueioConfirmado = false;
 const avisos: string[] = [], cercas = new Set<string>(), pastas = mkdtempSync(join(tmpdir(), "erp-c9-native-"));
 observer.on("notification", aviso => { if (aviso.payload?.startsWith("c9-cerca-")) cercas.add(aviso.payload); else if (aviso.payload) avisos.push(aviso.payload); });
 const fase = (nome: string) => eventos.push({ fase: nome, ms: performance.now() - inicio });
 const real = prisma.$transaction.bind(prisma);
 let acao: ReturnType<typeof iniciarConversaPorNumero> | undefined;
 const spy = vi.spyOn(prisma, "$transaction").mockImplementation(((operacao: unknown, opcoes: unknown) => {
  if (typeof operacao !== "function") throw Error("Instrumentação C9: TX não interativa");
  expect(opcoes).toBeUndefined(); fase("tx.solicitada");
  return real(async tx => {
   fase("tx.callback.inicio"); pids.push((await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`)[0].pid);
   const observado = new Proxy(tx, { get(alvo, chave, receptor) {
    const valor = Reflect.get(alvo, chave, receptor);
    if (chave !== "contatoWhatsApp") return typeof valor === "function" ? valor.bind(alvo) : valor;
    return new Proxy(valor, { get(modelo, metodo) {
     const fn = Reflect.get(modelo, metodo);
     if (metodo === "findUnique") return async (...args: unknown[]) => {
      const r = await Reflect.apply(fn, modelo, args);
      if (r === null && !leituraInterrompida) { leituraInterrompida = true; fase("contato.null.real"); vazioLido.liberar(); await prazo(permitirInsert.promessa, 2000, "liberar INSERT ator"); }
      return r;
     };
     if (metodo === "create") return async (...args: unknown[]) => {
      fase("contato.insert.inicio");
      try { return await Reflect.apply(fn, modelo, args); } catch (erro) { erroInsert = erro; fase("contato.insert.erro"); throw erro; }
     };
     return typeof fn === "function" ? fn.bind(modelo) : fn;
    } });
   } }) as Prisma.TransactionClient;
   try { return await Reflect.apply(operacao, undefined, [observado]); } finally { fase("tx.callback.fim"); }
  }, opcoes as Parameters<typeof real>[1]).finally(() => fase("tx.terminal"));
 }) as typeof prisma.$transaction);
 const cerca = async () => { const marca = `c9-cerca-${n}-${cercas.size}`; await observer.query("SELECT pg_notify($1,$2)", [CANAL_INBOX, marca]); await vi.waitFor(() => expect(cercas.has(marca)).toBe(true), { timeout: 2000 }); };
 try {
  await writer.connect(); await observer.connect();
  pidWriter = Number((await writer.query("SELECT pg_backend_pid() AS pid")).rows[0].pid); pidObserver = Number((await observer.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
  await observer.query(`LISTEN ${CANAL_INBOX}`); const antes = await foto();
  fase("action.inicio"); acao = iniciarConversaPorNumero(entrada); await prazo(vazioLido.promessa, 2000, "findUnique null real");
  expect(new Set([pids[0], pidWriter, pidObserver]).size).toBe(3); expect(pids[0]).toBeGreaterThan(0);
  await writer.query("BEGIN"); writerAberto = true;
  await writer.query('INSERT INTO "ContatoWhatsApp" ("id","telefoneE164","pessoaId","leadId") VALUES ($1,$2,$3,$4)', [contatoWriterId, telefone, caso === "COMMIT_INCOMPATIVEL" ? outraPessoaId : pessoaId, caso === "COMMIT_INCOMPATIVEL" ? null : leadId]);
  fase("writer.insert.pendente"); permitirInsert.liberar();
  await vi.waitFor(async () => {
   const r = await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.pid=$1::int AND a.datname=current_database() AND a.state=\'active\' AND a.wait_event_type=\'Lock\' AND $2::int=ANY(pg_blocking_pids(a.pid)) AND a.query LIKE \'INSERT INTO "public"."ContatoWhatsApp"%\') AS bloqueado', [pids[0], pidWriter]);
   expect(r.rows[0].bloqueado).toBe(true);
  }, { timeout: 2000, interval: 20 }); bloqueioConfirmado = true; fase("observer.insert.bloqueado");
  await writer.query(caso === "ROLLBACK_WRITER" ? "ROLLBACK" : "COMMIT"); writerAberto = false; fase("writer.terminal");
  const resposta = await prazo(acao, 2000, "terminal action"); fase("action.terminal"); await cerca();
  const meta = erroInsert instanceof Prisma.PrismaClientKnownRequestError ? { code: erroInsert.code, modelName: erroInsert.meta?.modelName, target: erroInsert.meta?.target } : null;
  writeFileSync(join(pastas, "recibo-sanitizado.json"), JSON.stringify({ caso, bloqueioConfirmado, pids: { ator: pids, writer: pidWriter, observer: pidObserver }, meta, eventos, resposta }), { encoding: "utf8", flag: "wx" });
  console.info("C9_RECIBO", JSON.stringify({ caso, pastas, meta, pids: { ator: pids, writer: pidWriter, observer: pidObserver }, eventos, resposta }));
  if (caso === "ROLLBACK_WRITER") {
   expect(erroInsert).toBeUndefined(); expect(resposta.ok, JSON.stringify(resposta)).toBe(true);
   if (!resposta.ok || !resposta.dado) throw Error("Canário C9: ACK ausente");
   expect(await prisma.contatoWhatsApp.findUnique({ where: { id: contatoWriterId } })).toBeNull();
   const a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: resposta.dado.atendimentoId }, include: { conversa: { include: { contato: true } } } });
   expect(a.leadId).toBe(leadId); expect(a.conversa.contato).toMatchObject({ pessoaId, leadId }); expect(avisos).toHaveLength(1);
   const apos = await foto(); expect(await iniciarConversaPorNumero(entrada)).toEqual(resposta); await cerca(); expect(await foto()).toEqual(apos); expect(avisos).toHaveLength(1);
  } else {
   expect(bloqueioConfirmado).toBe(true); expect(meta).toEqual({ code: "P2002", modelName: "ContatoWhatsApp", target: ["telefoneE164"] });
   const depois = await foto(); expect({ ...depois, contatos: [] }).toEqual({ ...antes, contatos: [] }); expect(depois.contatos).toHaveLength(1); expect(depois.contatos[0].id).toBe(contatoWriterId); expect(avisos).toEqual([]);
   const retry = await iniciarConversaPorNumero(entrada); await cerca();
   if (caso === "COMMIT_INCOMPATIVEL") { expect(retry).toEqual({ ok: false, erro: DOMINIO }); expect(await foto()).toEqual(depois); expect(avisos).toEqual([]); }
   else { expect(retry.ok, JSON.stringify(retry)).toBe(true); const aposRetry = await foto(); expect(await iniciarConversaPorNumero(entrada)).toEqual(retry); await cerca(); expect(await foto()).toEqual(aposRetry); expect(avisos).toHaveLength(1); expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: contatoWriterId } }))).toMatchObject({ pessoaId, leadId }); }
   expect(resposta).toEqual({ ok: false, erro: DOMINIO });
  }
  expect(await prisma.mensagemWhatsApp.count()).toBe(0); expect(await prisma.intencaoMensagem.count()).toBe(0);
 } finally {
  permitirInsert.liberar(); if (writerAberto) await writer.query("ROLLBACK");
  try { if (acao) await acao; } finally { spy.mockRestore(); await writer.end(); await observer.end(); }
 }
});