import { beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => { const u = new URL(process.env.DATABASE_URL!); u.searchParams.set("connection_limit", "1"); u.searchParams.set("pool_timeout", "3"); process.env.DATABASE_URL = u.toString(); (globalThis as { prisma?: unknown }).prisma = undefined; });
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { Papel, Prisma, type AcaoAgenteIATipo, type OrigemEnvio } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { configPadrao } from "@/server/aria/config-schema";
import { estadoOrcamento } from "@/server/aria/uso";
import { ESTADOS_ARIA, carregarContextoAria, condicaoEstadoAria, derivarEstadoAria, idsHandoffPendente, linhaEstadoDe, sugestoesPendentesPorAtendimento, type EstadoAria } from "./estado-aria";
const agora = new Date("2026-10-24T12:00:00.000Z"), pausa = new Date("2026-10-24T11:00:00.000Z");
const include = { conversa: { include: { numero: true, contato: true } } } as const;
let seq = 0;
beforeEach(async () => { await truncarBanco(); seq = 0; });
async function publicar(estado: "ATIVA" | "SHADOW" | "DESLIGADA" = "ATIVA") {
  const u = await criarUsuario([Papel.ADMINISTRADOR]);
  await prisma.agenteIA.upsert({ where: { id: "aria" }, create: { id: "aria", estado }, update: { estado } });
  await prisma.versaoAgenteIA.create({ data: { numero: 1, status: "PUBLICADA", config: configPadrao(), criadaPorId: u.id, publicadaPorId: u.id, publicadaEm: agora } });
  return u;
}
async function atendimento(o: { responsavel?: string; dono?: string; grupo?: boolean; optOut?: boolean; finalidade?: "COMERCIAL" | "FINANCEIRO" } = {}) {
  const n = ++seq;
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5067000" + String(n).padStart(4, "0"), rotulo: "342 fake", driver: "MOTOR", finalidade: "VENDAS", donoId: o.dono ?? null } });
  const contato = o.grupo ? null : await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5068000" + String(n).padStart(4, "0"), optOutEm: o.optOut ? pausa : null } });
  const grupo = o.grupo ? await prisma.grupoWhatsApp.create({ data: { numeroId: numero.id, grupoJid: "342-" + n, nome: "Grupo ficticio" } }) : null;
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato?.id, grupoId: grupo?.id } });
  let vinculo: { alunoId?: string; matriculaId?: string } = {};
  if (o.finalidade === "FINANCEIRO") {
    const catalogo = await seedCatalogoMinimo();
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno ficticio342", paisId: catalogo.pais.id } });
    const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC" } });
    await prisma.contatoWhatsApp.update({ where: { id: contato!.id }, data: { alunoId: aluno.id } });
    vinculo = { alunoId: aluno.id, matriculaId: matricula.id };
  }
  const a = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "342", finalidade: o.finalidade ?? "COMERCIAL", responsavelId: o.responsavel ?? null, ...vinculo } });
  return { ...a, numeroId: numero.id };
}
type Atendimento = Awaited<ReturnType<typeof atendimento>>;
async function pausar(a: Atendimento, motivo: "HANDOFF" | "MANUAL" = "HANDOFF", instante = pausa) { await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { iaPausadaEm: instante, iaPausaMotivo: motivo } }); }
async function sugerir(a: Atendimento, o: { id?: string; expiraEm?: Date | null; criadoEm?: Date; status?: "SUGERIDA" | "APROVADA"; acao?: AcaoAgenteIATipo } = {}) {
  const ancora = await prisma.mensagemWhatsApp.create({ data: { atendimentoId: a.id, conversaId: a.conversaId, numeroId: a.numeroId, direcao: "ENTRADA", driver: "MOTOR", corpo: "fake342", status: "ENTREGUE", providerMessageId: "342-ancora-" + ++seq } });
  const turno = await prisma.turnoAgenteIA.create({ data: { ancoraMensagemId: ancora.id, atendimentoId: a.id, tipo: "ATENDIMENTO", resultado: "SUGERIU" } });
  return prisma.acaoAgenteIA.create({ data: { id: o.id, turnoId: turno.id, atendimentoId: a.id, acao: o.acao ?? "RESPONDER", modoConfigurado: "SUGERIR", status: o.status ?? "SUGERIDA", confianca: 70, payload: {}, reversivel: false, expiraEm: o.expiraEm === undefined ? null : o.expiraEm, criadoEm: o.criadoEm ?? agora } });
}
async function saida(a: Atendimento, origem: OrigemEnvio, instante: Date, direcao: "SAIDA" | "ENTRADA" = "SAIDA") { return prisma.mensagemWhatsApp.create({ data: { atendimentoId: a.id, conversaId: a.conversaId, numeroId: a.numeroId, direcao, origem: direcao === "SAIDA" ? origem : null, driver: "MOTOR", corpo: "fake342", status: "ENVIADA", providerMessageId: "342-saida-" + ++seq, criadoEm: instante } }); }
async function estadoDe(id: string): Promise<EstadoAria | null> {
  const ctx = await carregarContextoAria(prisma, { atendimentoIds: [id], agora }), a = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, include });
  return derivarEstadoAria(linhaEstadoDe(a), ctx, (await sugestoesPendentesPorAtendimento(prisma, [id], agora)).has(id));
}
async function concordam() {
  const todos = await prisma.atendimentoWhatsApp.findMany({ include }), ids = todos.map(a => a.id), ctx = await carregarContextoAria(prisma, { atendimentoIds: ids, agora }), sugestoes = await sugestoesPendentesPorAtendimento(prisma, ids, agora);
  for (const e of ESTADOS_ARIA) {
    const encontrados = await prisma.atendimentoWhatsApp.findMany({ where: condicaoEstadoAria(e, ctx), select: { id: true } });
    expect(encontrados.map(a => a.id).sort(), e).toEqual(todos.filter(a => derivarEstadoAria(linhaEstadoDe(a), ctx, sugestoes.has(a.id)) === e).map(a => a.id).sort());
  }
}
describe("EstadoAria servidor com PostgreSQL/pool1", () => {
  it("ia_quando_ativa; SHADOW/DESLIGADA e versao ausente nunca sao ia", async () => {
    await publicar(); const a = await atendimento(); expect(await estadoDe(a.id)).toBe("ia");
    for (const estado of ["SHADOW", "DESLIGADA"] as const) { await prisma.agenteIA.update({ where: { id: "aria" }, data: { estado } }); expect(await estadoDe(a.id)).toBeNull(); }
    await prisma.agenteIA.update({ where: { id: "aria" }, data: { estado: "ATIVA" } }); await prisma.versaoAgenteIA.updateMany({ data: { status: "ARQUIVADA" } }); expect(await estadoDe(a.id)).toBeNull();
  });
  it("pausa_global_tira_todas_de_ia e preserva responsavel/sugestao", async () => {
    const u = await publicar(), fila = await atendimento(), humano = await atendimento({ responsavel: u.id }), sug = await atendimento(); await sugerir(sug);
    await prisma.agenteIA.update({ where: { id: "aria" }, data: { pausadoEm: pausa, motivoPausa: "fake342" } });
    expect(await estadoDe(fila.id)).toBeNull(); expect(await estadoDe(humano.id)).toBe("humano"); expect(await estadoDe(sug.id)).toBe("aprovacao"); await concordam();
  });
  it.each([null, new Date(agora.getTime() + 1), agora, new Date(agora.getTime() - 1)])("sugestao vigente respeita expiraEm %s", async expiraEm => {
    await publicar(); const a = await atendimento(); await sugerir(a, { expiraEm }); expect(await estadoDe(a.id)).toBe(expiraEm === null || expiraEm > agora ? "aprovacao" : "ia"); await concordam();
  });
  it.each(["HUMANO", "CELULAR"] as const)("resposta %s encerra handoff somente posterior", async origem => {
    await publicar(); const a = await atendimento(); await pausar(a);
    for (const delta of [-1, 0, 1]) { await saida(a, origem, new Date(pausa.getTime() + delta)); expect(await estadoDe(a.id)).toBe(delta > 0 ? "humano" : "handoff"); } await concordam();
  });
  it("evento Assumido encerra apenas mesmo alvo/tipo/agregado e instante posterior", async () => {
    const u = await publicar(), a = await atendimento(); await pausar(a);
    for (const extra of [{ agregadoId: "outro" }, { agregadoTipo: "Outro" }, { tipo: "OutroEvento" }, { criadoEm: pausa }]) {
      await prisma.evento.create({ data: { tipo: "AtendimentoAssumido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: u.id, payload: {}, criadoEm: new Date(pausa.getTime() + 1), ...extra } }); expect(await estadoDe(a.id)).toBe("handoff");
    }
    await prisma.evento.create({ data: { tipo: "AtendimentoAssumido", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: u.id, payload: {}, criadoEm: new Date(pausa.getTime() + 1) } }); expect(await estadoDe(a.id)).toBe("humano"); await concordam();
  });
  it("IA e ENTRADA nao encerram handoff; pausaNULL nao fabrica handoff", async () => {
    await publicar(); const a = await atendimento(); await pausar(a); await saida(a, "IA", new Date(pausa.getTime() + 1)); await saida(a, "HUMANO", new Date(pausa.getTime() + 1), "ENTRADA"); expect(await estadoDe(a.id)).toBe("handoff");
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { iaPausadaEm: null } }); expect(await idsHandoffPendente(prisma, [a.id])).toEqual([]); expect(await estadoDe(a.id)).toBe("ia");
  });
  it("fusos diferentes representam o mesmo instante, sem ordem por string", async () => {
    await publicar(); const a = await atendimento(); await pausar(a, "HANDOFF", new Date("2026-10-24T08:00:00-03:00")); await saida(a, "CELULAR", new Date("2026-10-24T11:00:00.001Z")); expect(await estadoDe(a.id)).toBe("humano");
  });
  it("condicao_e_derivacao_concordam para prioridades e nulos nos dois estados globais", async () => {
    const u = await publicar(), a = await atendimento(), b = await atendimento({ responsavel: u.id }), c = await atendimento(), d = await atendimento(), fechado = await atendimento(), opt = await atendimento({ optOut: true }), dono = await atendimento({ dono: u.id }), setor = await atendimento({ finalidade: "FINANCEIRO" });
    await pausar(c); await sugerir(c); await pausar(d, "MANUAL"); await sugerir(d); await sugerir(b); await sugerir(fechado); await prisma.atendimentoWhatsApp.update({ where: { id: fechado.id }, data: { encerradoEm: agora, status: "ENCERRADO" } });
    expect(await estadoDe(a.id)).toBe("ia"); expect(await estadoDe(b.id)).toBe("aprovacao"); expect(await estadoDe(c.id)).toBe("handoff"); expect(await estadoDe(d.id)).toBe("humano");
    for (const n of [fechado, opt, dono, setor]) expect(await estadoDe(n.id)).toBeNull();
    await concordam(); await prisma.agenteIA.update({ where: { id: "aria" }, data: { pausadoEm: agora } }); await concordam();
  });
  it("sugestao mais recente, desempate idDESC e filtro vigente/status no SQL", async () => {
    const a = await atendimento(); await sugerir(a, { id: "a", criadoEm: pausa }); await sugerir(a, { id: "b", acao: "NOTA_INTERNA", criadoEm: pausa }); await sugerir(a, { id: "c", expiraEm: agora }); await sugerir(a, { id: "d", status: "APROVADA" });
    expect(await sugestoesPendentesPorAtendimento(prisma, [a.id], agora)).toEqual(new Map([[a.id, { acao: "NOTA_INTERNA", criadoEm: pausa }]]));
  });
  it("lote205 sem N+1/cap; ids vazios e SQL aparente continuam fechados", async () => {
    const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+50679999999", rotulo: "342 lote", driver: "MOTOR", finalidade: "VENDAS" } });
    const ids = Array.from({ length: 205 }, (_, n) => "342-batch-" + n);
    await prisma.contatoWhatsApp.createMany({ data: ids.map((id, n) => ({ id: "c-" + id, telefoneE164: "+5069" + String(n).padStart(7, "0") })) });
    await prisma.conversaWhatsApp.createMany({ data: ids.map(id => ({ id: "v-" + id, numeroId: numero.id, contatoId: "c-" + id })) });
    await prisma.atendimentoWhatsApp.createMany({ data: ids.map(id => ({ id, conversaId: "v-" + id, contextoChave: "342", finalidade: "COMERCIAL", iaPausadaEm: pausa, iaPausaMotivo: "HANDOFF" })) });
    await prisma.mensagemWhatsApp.createMany({ data: ids.map(id => ({ id: "m-" + id, atendimentoId: id, conversaId: "v-" + id, numeroId: numero.id, direcao: "ENTRADA", driver: "MOTOR", status: "ENTREGUE", providerMessageId: id })) });
    await prisma.turnoAgenteIA.createMany({ data: ids.map(id => ({ id: "t-" + id, atendimentoId: id, ancoraMensagemId: "m-" + id, tipo: "ATENDIMENTO", resultado: "SUGERIU" })) });
    await prisma.acaoAgenteIA.createMany({ data: ids.map(id => ({ turnoId: "t-" + id, atendimentoId: id, acao: "RESPONDER", modoConfigurado: "SUGERIR", status: "SUGERIDA", confianca: 70, payload: {}, reversivel: false })) });
    const spy = vi.spyOn(prisma, "$queryRaw"); try {
      expect((await idsHandoffPendente(prisma, ids.concat(ids[0]!))).sort()).toEqual([...ids].sort()); expect(spy).toHaveBeenCalledTimes(1); spy.mockClear();
      expect((await sugestoesPendentesPorAtendimento(prisma, ids, agora)).size).toBe(205); expect(spy).toHaveBeenCalledTimes(1); spy.mockClear();
      expect(await idsHandoffPendente(prisma, [])).toEqual([]); expect(await sugestoesPendentesPorAtendimento(prisma, [], agora)).toEqual(new Map()); expect(spy).not.toHaveBeenCalled();
      expect(await idsHandoffPendente(prisma, ["a'); DROP TABLE x;--"])).toEqual([]); expect(await prisma.atendimentoWhatsApp.count()).toBe(205); expect((await idsHandoffPendente(prisma)).length).toBe(205);
    } finally { spy.mockRestore(); }
  });
  it("mesmo tx/pool1 enxerga alteracoes nao commitadas e rollback nao escapa ao global", async () => {
    await publicar("DESLIGADA"); const a = await atendimento();
    const abortar = Error("rollback fake342");
    await expect(prisma.$transaction(async tx => {
      await tx.agenteIA.update({ where: { id: "aria" }, data: { estado: "ATIVA" } });
      await tx.configIA.upsert({ where: { id: "ia" }, create: { id: "ia", orcamentoMensalUsd: 10, acaoAoEstourar: "PAUSAR" }, update: { orcamentoMensalUsd: 10, acaoAoEstourar: "PAUSAR" } });
      await tx.chamadaIA.create({ data: { origem: "ATENDIMENTO", modelo: "simulado", provedor: "simulado", tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, custoMicroUsd: 10_000_000, latenciaMs: 0, resultado: "OK", criadoEm: agora } });
      expect((await estadoOrcamento(agora, tx)).situacao).toBe("ESTOURADO");
      expect((await carregarContextoAria(tx, { atendimentoIds: [a.id], agora })).ariaAtiva).toBe(false);
      await tx.configIA.update({ where: { id: "ia" }, data: { acaoAoEstourar: "SO_SUGERIR" } });
      await tx.atendimentoWhatsApp.update({ where: { id: a.id }, data: { iaPausadaEm: pausa, iaPausaMotivo: "HANDOFF" } });
      const ctx = await carregarContextoAria(tx, { atendimentoIds: [a.id], agora }); expect(ctx.ariaAtiva).toBe(true); expect([...ctx.handoffPendentes]).toEqual([a.id]); throw abortar;
    }, { timeout: 20000 })).rejects.toBe(abortar);
    expect((await prisma.agenteIA.findUniqueOrThrow({ where: { id: "aria" } })).estado).toBe("DESLIGADA"); expect(await prisma.chamadaIA.count()).toBe(0); expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).iaPausadaEm).toBeNull();
  });
  it("grupo nao abre atendimento: invariante DB preservada", async () => {
    await expect(atendimento({ grupo: true })).rejects.toThrow("Conversa de grupo não abre atendimento");
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
  });
  it("vigencia SQL e Prisma concordam no mesmo instante em sessoes UTC e Sao_Paulo", async () => {
    const a = await atendimento(), acao = await sugerir(a, { expiraEm: agora });
    for (const fuso of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('TimeZone', ${fuso}, true)`;
      await tx.acaoAgenteIA.update({ where: { id: acao.id }, data: { expiraEm: agora } });
      const prova = await tx.$queryRaw<{ fuso: string; tipo: string; tipoColuna: string; armazenado: string; parametro: string; direto: boolean }[]>`SELECT current_setting('TimeZone') AS fuso, pg_typeof(${agora})::text AS tipo, pg_typeof("expiraEm")::text AS "tipoColuna", "expiraEm"::text AS armazenado, ${agora}::text AS parametro, "expiraEm" > ${agora} AS direto FROM "AcaoAgenteIA" WHERE "id"=${acao.id}`;
      console.log("342-tempo", JSON.stringify(prova));
      expect(prova[0]!.tipoColuna).toBe("timestamp without time zone");
      for (const delta of [-1, 0, 1]) {
        await tx.acaoAgenteIA.update({ where: { id: acao.id }, data: { expiraEm: new Date(agora.getTime() + delta) } });
        const vigentesPrisma = await tx.acaoAgenteIA.findMany({ where: { atendimentoId: a.id, status: "SUGERIDA", OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }] } });
        expect(vigentesPrisma.length > 0).toBe(delta > 0);
        expect((await sugestoesPendentesPorAtendimento(tx, [a.id], agora)).has(a.id), fuso + ":" + delta).toBe(vigentesPrisma.length > 0);
      }
    });
  });
  it("indice parcial reservado esta valido e tem o predicado esperado", async () => {
    const linhas = await prisma.$queryRaw<{ valido: boolean; definicao: string }[]>(Prisma.sql`SELECT i.indisvalid AS valido, pg_get_indexdef(i.indexrelid) AS definicao FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname='AtendimentoWhatsApp_handoff_aberto_idx'`);
    expect(linhas).toHaveLength(1); expect(linhas[0]!.valido).toBe(true); expect(linhas[0]!.definicao).toContain('"iaPausadaEm"'); expect(linhas[0]!.definicao).toContain('HANDOFF'); expect(linhas[0]!.definicao).toContain('"encerradoEm" IS NULL');
  });
});
