import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Client } from "pg";
import { Papel, type Prisma } from "@prisma/client";
const sessao = vi.hoisted(() => ({ id: "" }));
vi.mock("@/server/_shared/sessao", async original => {
 const o = await original<typeof import("@/server/_shared/sessao")>();
 return { ...o, exigirSessao: async () => { const u = await o.carregarUsuarioFresco(sessao.id); if (!u) throw new o.ErroAutenticacao(); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { iniciarConversaPorNumero } from "./nova-conversa-acoes";
import { CANAL_INBOX, avisarAtendimentoAtualizado, type AvisoInbox } from "@/server/inbox/barramento";
import { ErroRegra } from "@/server/_shared/sessao";

// Baseline C4: AUTORADO, SQL NÃO EXECUTADO. Transportável sem ancestrais privados.
// Oráculo final é um aviso. Baseline previsto 0/0/0/1 não é aceito como produto GREEN.
type Caso = "NOVO" | "EX_CREATE" | "EX_REUSE" | "EX_NULL_MAP";
let ator: Awaited<ReturnType<typeof criarUsuario>>, numeroId: string, sequencia = 0;
let fetchGuard: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
 vi.restoreAllMocks();
 fetchGuard = vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw Error("C4: tentativa externa bloqueada"); });
 await truncarBanco(); ator = await criarUsuario([Papel.VENDEDOR], "Vendedor fictício C4"); sessao.id = ator.id;
 numeroId = (await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+50689992222", rotulo: "Linha fictícia C4", finalidade: "VENDAS", donoId: ator.id, ativo: true, driver: "MOTOR", sessao: "DESCONECTADO" } })).id;
 await prisma.pais.create({ data: { nome: "País fictício C4", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506" } });
});
afterEach(() => { try { expect(fetchGuard).not.toHaveBeenCalled(); } finally { vi.restoreAllMocks(); } });
afterAll(() => prisma.$disconnect());
async function preparar(caso: Caso) {
 const n = ++sequencia, telefone = `+5068444${String(n).padStart(4, "0")}`;
 const entrada = { modo: caso === "NOVO" ? "NOVO" as const : "EXISTENTE" as const, telefone, numeroId, ...(caso === "NOVO" ? { ownerId: ator.id } : {}), chaveIdempotencia: `c4-tentativa-${n}` };
 if (caso !== "NOVO") {
  const p = await prisma.pessoa.create({ data: { nome: "Pessoa fictícia C4" } });
  const l = await prisma.oportunidade.create({ data: { codigo: `L-C4-${n}`, nome: "Lead fictício C4", telefoneE164: telefone, pessoaId: p.id, vendedorDonoId: ator.id } });
  if (caso !== "EX_CREATE") {
   const c = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone, pessoaId: p.id, leadId: l.id } });
   const cv = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId: c.id } });
   await prisma.atendimentoWhatsApp.create({ data: { conversaId: cv.id, contextoChave: "COMERCIAL:LINHA", finalidade: "COMERCIAL", leadId: caso === "EX_NULL_MAP" ? null : l.id, responsavelId: ator.id, status: "EM_ATENDIMENTO" } });
  }
 }
 return entrada;
}
async function escutar() {
 const listener = new Client({ connectionString: process.env.DATABASE_URL });
 await listener.connect(); const quadros: { bruto: string; aviso: AvisoInbox }[] = [];
 const recebidos = new Set<string>();
 listener.on("notification", n => { if (n.payload) { recebidos.add(n.payload); if (!n.payload.startsWith("c4-cerca-")) quadros.push({ bruto: n.payload, aviso: JSON.parse(n.payload) as AvisoInbox }); } });
 await listener.query(`LISTEN ${CANAL_INBOX}`);
 const pid = Number((await listener.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
 return { listener, quadros, pid, cerca: async () => {
  const marca = `c4-cerca-${++sequencia}`;
  await listener.query("SELECT pg_notify($1,$2)", [CANAL_INBOX, marca]);
  await vi.waitFor(() => expect(recebidos.has(marca)).toBe(true), { timeout: 2000 });
 } };
}
async function foto() {
 return { pessoas: await prisma.pessoa.findMany({ orderBy: { id: "asc" } }), leads: await prisma.oportunidade.findMany({ orderBy: { id: "asc" } }), contatos: await prisma.contatoWhatsApp.findMany({ orderBy: { id: "asc" } }), conversas: await prisma.conversaWhatsApp.findMany({ orderBy: { id: "asc" } }), atendimentos: await prisma.atendimentoWhatsApp.findMany({ orderBy: { id: "asc" } }), eventos: await prisma.evento.findMany({ orderBy: { id: "asc" } }), contador: await prisma.contador.findMany({ orderBy: { chave: "asc" } }) };
}
function observar(rollback: boolean | "FALHA" | "REVOGACAO" = false) {
 const real = prisma.$transaction.bind(prisma), pids: number[] = []; let avisosReais = 0;
 const spy = vi.spyOn(prisma, "$transaction").mockImplementation(((operacao: unknown, opcoes: unknown) => {
  if (typeof operacao !== "function") throw Error("C4: esperada TX interativa única");
  return real(async tx => {
   expect(Reflect.get(tx, "$transaction")).toBeUndefined();
   pids.push((await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`)[0].pid);
   const observado = new Proxy(tx, { get(alvo, chave, receptor) {
    const valor = Reflect.get(alvo, chave, receptor);
    if (chave === "$executeRaw" && typeof rollback === "string") return async (...args: unknown[]) => {
     const resultado = await Reflect.apply(valor, alvo, args);
     const sql = Array.isArray(args[0]) ? args[0].join("") : "";
     if (sql.includes("pg_notify") && sql.includes("json_build_object")) {
      avisosReais++;
      if (rollback === "FALHA") throw new ErroRegra("Falha instrumental C4 após SQL do helper.");
      await tx.usuario.update({ where: { id: ator.id }, data: { ativo: false } });
     }
     return resultado;
    };
    return typeof valor === "function" ? valor.bind(alvo) : valor;
   } }) as Prisma.TransactionClient;
   const r = await Reflect.apply(operacao, undefined, [observado]);
   if (rollback === true) {
    // Controle de transporte: aviso REAL na mesma TX, depois do core, seguido de rollback.
    // Não conta como emissão da produção e não mascara baseline ausente do core.
    const a = await tx.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: r.atendimentoId } });
    await avisarAtendimentoAtualizado(tx, a);
    throw new ErroRegra("Rollback instrumental C4 após aviso real.");
   }
   return r;
  }, opcoes as Parameters<typeof real>[1]);
 }) as typeof prisma.$transaction);
 return { pids, get avisosReais() { return avisosReais; }, parar: () => spy.mockRestore() };
}
it.each(["NOVO", "EX_CREATE", "EX_REUSE", "EX_NULL_MAP"] as const)("C4 %s: medir aviso real, replay sem incremento e rollback transacional", async caso => {
 const entrada = await preparar(caso), e = await escutar(), o = observar();
 try {
  const r = await iniciarConversaPorNumero(entrada);
  expect(r.ok, JSON.stringify(r)).toBe(true); if (!r.ok || !r.dado) throw Error("C4: ACK sem dado");
  expect(o.pids).toHaveLength(1); expect(o.pids[0]).toBeGreaterThan(0); expect(o.pids[0]).not.toBe(e.pid);
  await e.cerca();
  const a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: r.dado.atendimentoId } });
  const alvo = () => e.quadros.filter(q => q.aviso.atendimentoId === a.id);
  const primeira = alvo().slice();
  const antesReplay = await foto();
  expect(await iniciarConversaPorNumero(entrada)).toEqual(r); await e.cerca();
  expect(alvo()).toEqual(primeira); expect(await foto()).toEqual(antesReplay);
  console.info("C4_BASELINE", JSON.stringify({ caso, listenerPid: e.pid, actorPids: o.pids, quantidade: primeira.length, quadros: primeira }));
  o.parar();
  const rollbackEntrada = await preparar(caso), antesRollback = await foto(), quantidadeAntes = e.quadros.length, rb = observar(true);
  try { expect(await iniciarConversaPorNumero(rollbackEntrada)).toEqual({ ok: false, erro: "Rollback instrumental C4 após aviso real." }); expect(rb.pids).toHaveLength(1); } finally { rb.parar(); }
  await e.cerca(); expect(e.quadros).toHaveLength(quantidadeAntes); expect(await foto()).toEqual(antesRollback);
  expect(await prisma.mensagemWhatsApp.count()).toBe(0); expect(await prisma.intencaoMensagem.count()).toBe(0);
  // Gate de produto após toda medição: ausência ou duplicação NÃO é GREEN.
  expect(primeira, `C4 ${caso}: esperado um aviso pós-commit`).toHaveLength(1);
  const [literalTrigger] = await prisma.$queryRaw<{ bruto: string }[]>`SELECT json_build_object('tipo', 'atendimento.atualizado', 'atendimentoId', ${a.id}::text, 'mensagemId', NULL, 'conversaId', ${a.conversaId}::text)::text AS bruto`;
  expect(primeira[0].bruto).toBe(literalTrigger.bruto);
  expect(primeira[0].aviso).toEqual({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId });
 } finally { o.parar(); await e.listener.end(); }
});
it.each([
 ["NOVO", "FALHA"], ["NOVO", "REVOGACAO"],
 ["EX_CREATE", "FALHA"], ["EX_CREATE", "REVOGACAO"],
] as const)("C4 %s/%s: SQL real do helper precede falha/guard final e rollback sem aviso", async (caso, falha) => {
 const entrada = await preparar(caso), e = await escutar(), antes = await foto(), o = observar(falha);
 try {
  expect(await iniciarConversaPorNumero(entrada)).toEqual({ ok: false, erro: falha === "FALHA" ? "Falha instrumental C4 após SQL do helper." : "Não autenticado." });
  expect(o.avisosReais).toBe(1); expect(o.pids).toHaveLength(1); expect(o.pids[0]).toBeGreaterThan(0); expect(o.pids[0]).not.toBe(e.pid);
  await e.cerca(); expect(e.quadros).toEqual([]); expect(await foto()).toEqual(antes);
  expect((await prisma.usuario.findUniqueOrThrow({ where: { id: ator.id } })).ativo).toBe(true);
  expect(await prisma.mensagemWhatsApp.count()).toBe(0); expect(await prisma.intencaoMensagem.count()).toBe(0);
 } finally { o.parar(); await e.listener.end(); }
});