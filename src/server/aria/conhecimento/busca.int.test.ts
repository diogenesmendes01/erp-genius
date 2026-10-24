import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { buscarTrechos } from "./busca";

let criadorId: string;

async function fonte(nome: string, texto: string, status: "PRONTA" | "PROCESSANDO" | "ERRO" = "PRONTA") {
  const f = await prisma.fonteConhecimento.create({
    data: { tipo: "TEXTO", nome, status, hashConteudo: `h-${nome}-${Math.random()}`, criadoPorId: criadorId },
  });
  await prisma.trechoConhecimento.create({ data: { fonteId: f.id, ordem: 0, texto } });
  return f.id;
}

beforeEach(async () => {
  await truncarBanco();
  criadorId = (await criarUsuario([])).id;
});

describe("busca nos trechos", () => {
  it("acha_com_plural_e_acento", async () => {
    const fonteId = await fonte("Horários", "As turmas noturnas começam às 19h.");
    const r = await buscarTrechos("turma noturna", [fonteId]);
    expect(r[0].texto).toContain("19h");
    expect(r[0].fonteId).toBe(fonteId);
    expect(r[0].rank).toBeGreaterThan(0);
  });

  it("so_fontes_informadas", async () => {
    await fonte("Horários", "As turmas noturnas começam às 19h.");
    expect(await buscarTrechos("turma", [])).toEqual([]);
    const outra = await fonte("Outra", "Nada a ver com isso.");
    expect(await buscarTrechos("turma", [outra])).toEqual([]);
  });

  it("ignora_fonte_arquivada_e_nao_pronta", async () => {
    const arquivada = await fonte("A", "A turma começa cedo.");
    const processando = await fonte("B", "A turma começa tarde.", "PROCESSANDO");
    const erro = await fonte("C", "A turma começa à tarde.", "ERRO");
    const controle = await fonte("D", "A turma começa ao meio-dia.");
    // Controle positivo: antes de arquivar, a mesma consulta acha a fonte.
    expect(await buscarTrechos("turma", [arquivada])).toHaveLength(1);
    await prisma.fonteConhecimento.update({ where: { id: arquivada }, data: { arquivadaEm: new Date() } });
    const r = await buscarTrechos("turma", [arquivada, processando, erro, controle]);
    expect(r.map((t) => t.fonteId)).toEqual([controle]);
    // Voltando a PRONTA, a fonte em processamento passa a aparecer (a consulta casa com o texto).
    await prisma.fonteConhecimento.update({ where: { id: processando }, data: { status: "PRONTA" } });
    expect((await buscarTrechos("turma", [processando])).map((t) => t.fonteId)).toEqual([processando]);
  });

  it("ignora_fonte_vencida", async () => {
    const vencida = await fonte("V", "A turma começa cedo.");
    const vigente = await fonte("F", "A turma começa tarde.");
    const semValidade = await fonte("S", "A turma começa ao meio-dia.");
    await prisma.fonteConhecimento.update({ where: { id: vencida }, data: { validoAte: new Date(Date.now() + 60_000) } });
    // Controle positivo: dentro da validade a fonte aparece.
    expect((await buscarTrechos("turma", [vencida])).map((t) => t.fonteId)).toEqual([vencida]);
    await prisma.fonteConhecimento.update({ where: { id: vencida }, data: { validoAte: new Date(Date.now() - 1000) } });
    await prisma.fonteConhecimento.update({ where: { id: vigente }, data: { validoAte: new Date(Date.now() + 864e5) } });
    const r = await buscarTrechos("turma", [vencida, vigente, semValidade], 10);
    expect(r.map((t) => t.fonteId).sort()).toEqual([vigente, semValidade].sort());
  });

  it("consulta_com_aspas_e_simbolos_nao_quebra", async () => {
    const fonteId = await fonte("Horários", "As turmas noturnas.");
    expect(await buscarTrechos("'); DROP TABLE x; --", [fonteId])).toEqual([]);
    expect(await buscarTrechos(`"turmas noturnas" ; ) ' --`, [fonteId])).toHaveLength(1);
    expect(await prisma.trechoConhecimento.count()).toBe(1);
    // A busca continua funcionando depois da consulta maliciosa.
    const r = await buscarTrechos("turma noturna", [fonteId]);
    expect(r).toHaveLength(1);
    expect(r[0].fonteId).toBe(fonteId);
  });

  it("respeita_limite_e_ordena_por_rank", async () => {
    const id = await fonte("L", "turma turma turma noturna");
    for (let i = 1; i <= 3; i++) await prisma.trechoConhecimento.create({ data: { fonteId: id, ordem: i, texto: `turma ${i}` } });
    const r = await buscarTrechos("turma", [id], 2);
    expect(r).toHaveLength(2);
    expect(r[0].rank).toBeGreaterThanOrEqual(r[1].rank);
  });
  it("423 validade UTC independe do fuso na mesma conexao e restaura a sessao", async () => {
    const vencida = await fonte("V423", "A turma começa cedo.");
    const vigente = await fonte("F423", "A turma começa cedo.");
    const semValidade = await fonte("S423", "A turma começa cedo.");
    const arquivada = await fonte("A423", "A turma começa cedo.");
    const processando = await fonte("P423", "A turma começa cedo.", "PROCESSANDO");
    const erro = await fonte("E423", "A turma começa cedo.", "ERRO");
    await fonte("Fora423", "A turma começa cedo.");
    await prisma.fonteConhecimento.update({ where: { id: arquivada }, data: { arquivadaEm: new Date() } });
    const ids = [vencida, vigente, semValidade, arquivada, processando, erro];
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("connection_limit", "1");
    const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    type Sessao = { pid: number; tz: string };
    const matriz: { zona: string; mesmaConexao: boolean; ids: string[] }[] = [];
    let chamadas = 0, restauradaNoTx = false, falhaTx: unknown;
    try {
      const [original] = await db.$queryRaw<Sessao[]>`SELECT pg_backend_pid() AS pid, current_setting('TimeZone') AS tz`;
      try {
        await db.$transaction(async tx => {
          // NOW é estável na transação; fixtures UTC não dependem do relógio Node.
          await tx.$executeRaw(Prisma.sql`UPDATE "FonteConhecimento" SET "validoAte" =
            (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + CASE WHEN id = ${vencida} THEN INTERVAL '-1 second' ELSE INTERVAL '1 second' END
            WHERE id IN (${vencida}, ${vigente})`);
          // Apenas transporte de teste: SQL, parâmetros e resultado são os da função real.
          // Captura ANTES do spy para não depender do proxy do cliente transacional.
          const consultarTx = tx.$queryRaw.bind(tx);
          const encaminhamento = vi.spyOn(prisma, "$queryRaw").mockImplementation(consultarTx);
          let saudavel = true;
          try {
            for (const zona of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) {
              await consultarTx(Prisma.sql`SELECT set_config('TimeZone', ${zona}, true)`);
              const [antes] = await consultarTx<Sessao[]>(Prisma.sql`SELECT pg_backend_pid() AS pid, current_setting('TimeZone') AS tz`);
              const resultado = await buscarTrechos("turma", ids, 10);
              const [depois] = await consultarTx<Sessao[]>(Prisma.sql`SELECT pg_backend_pid() AS pid, current_setting('TimeZone') AS tz`);
              matriz.push({ zona: antes.tz, mesmaConexao: antes.pid === original.pid && depois.pid === original.pid && depois.tz === zona, ids: resultado.map(t => t.fonteId).sort() });
            }
            chamadas = encaminhamento.mock.calls.length;
          } catch (e) { saudavel = false; throw e; }
          finally {
            encaminhamento.mockRestore();
            if (saudavel) {
              await consultarTx(Prisma.sql`SELECT set_config('TimeZone', ${original.tz}, true)`);
              const [restaurada] = await consultarTx<Sessao[]>(Prisma.sql`SELECT pg_backend_pid() AS pid, current_setting('TimeZone') AS tz`);
              restauradaNoTx = restaurada.pid === original.pid && restaurada.tz === original.tz;
            }
          }
        }, { timeout: 15000 });
      } catch (e) { falhaTx = e; }
      // Mesmo pool1, inclusive após rollback se alguma consulta lançou erro.
      const [final] = await db.$queryRaw<Sessao[]>`SELECT pg_backend_pid() AS pid, current_setting('TimeZone') AS tz`;
      expect(final).toEqual(original);
      if (falhaTx) throw falhaTx;
      expect(restauradaNoTx).toBe(true);
      expect(chamadas).toBe(3);
      expect(matriz).toEqual(["UTC", "America/Sao_Paulo", "Asia/Tokyo"].map(zona => ({ zona, mesmaConexao: true, ids: [vigente, semValidade].sort() })));
    } finally { await db.$disconnect(); }
  });

});
