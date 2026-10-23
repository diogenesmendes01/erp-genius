import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { rodarAlertasSla } from "./alertas-sla";

const agora = new Date("2026-10-19T15:00:00.000Z");
let responsavelId: string;
let sequencia = 0;
type Conexao = { fuso: string; pid: number };
type Gravado = { id: string; instante: string; tipo: string };

async function criarAtendimento(prazoRespostaEm: Date) {
  sequencia += 1;
  const numero = await prisma.numeroWhatsApp.create({ data: {
    telefoneE164: "+550000" + String(sequencia).padStart(7, "0"), rotulo: "SLA ficticio",
    driver: "MOTOR", finalidade: "VENDAS", providerRef: "sla-fuso-" + sequencia,
  } });
  const contato = await prisma.contatoWhatsApp.create({ data: {
    telefoneE164: "+550001" + String(sequencia).padStart(7, "0"), nomeExibicao: "Contato ficticio SLA",
  } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  return prisma.atendimentoWhatsApp.create({ data: {
    conversaId: conversa.id, contextoChave: "sla-fuso:" + sequencia, finalidade: "COMERCIAL",
    responsavelId, status: "EM_ATENDIMENTO", primeiroInboundEm: new Date("2026-10-18T12:00:00Z"), prazoRespostaEm,
  } });
}

/** Envolve a transacao real, sem substituir o callback, SQL ou resultados do produtor. */
async function noFuso<T>(fuso: string, executar: (conexoes: Conexao[], gravados: Gravado[]) => Promise<T>) {
  const original = prisma.$transaction.bind(prisma);
  const conexoes: Conexao[] = [];
  const gravados: Gravado[] = [];
  const espiao = vi.spyOn(prisma, "$transaction").mockImplementation(async <R>(
    operacao: (tx: Prisma.TransactionClient) => Promise<R>,
    opcoes?: Parameters<typeof original>[1],
  ): Promise<R> => original(async (tx) => {
    await tx.$queryRaw`SELECT set_config('TimeZone', ${fuso}, true)`;
    const [antes] = await tx.$queryRaw<Conexao[]>`SELECT current_setting('TimeZone') AS fuso, pg_backend_pid() AS pid`;
    expect(antes.fuso).toBe(fuso);
    const resultado = await operacao(tx);
    const [depois] = await tx.$queryRaw<Conexao[]>`SELECT current_setting('TimeZone') AS fuso, pg_backend_pid() AS pid`;
    expect(depois).toEqual(antes);
    conexoes.push(depois);
    gravados.push(...await tx.$queryRaw<Gravado[]>`
      SELECT id, to_char("slaAlertadoEm", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS instante,
        pg_typeof("slaAlertadoEm")::text AS tipo
      FROM "AtendimentoWhatsApp" WHERE "slaAlertadoEm" IS NOT NULL ORDER BY id`);
    return resultado;
  }, opcoes));
  try {
    return await executar(conexoes, gravados);
  } finally {
    espiao.mockRestore();
  }
}

beforeEach(async () => {
  await truncarBanco();
  responsavelId = (await criarUsuario([Papel.VENDEDOR], "Responsavel ficticio SLA")).id;
  await prisma.prazoRespostaSetor.create({ data: {
    finalidade: "COMERCIAL", minutos: 60, alertarResponsavel: true, alertarGerente: false,
  } });
});

describe.each(["UTC", "America/Sao_Paulo"])("claim SLA em %s", (fuso) => {
  it("preserva a janela UTC nos limites de milissegundo e grava o instante UTC uma unica vez", async () => {
    const vencido = await criarAtendimento(new Date("2026-10-19T14:55:00.000Z"));
    const limiteAgora = await criarAtendimento(new Date("2026-10-19T15:00:00.000Z"));
    const futuro = await criarAtendimento(new Date("2026-10-19T15:00:00.001Z"));
    const limiteDesde = await criarAtendimento(new Date("2026-10-18T15:00:00.000Z"));
    const dentroDesde = await criarAtendimento(new Date("2026-10-18T15:00:00.001Z"));
    const esperados = [vencido.id, limiteAgora.id, dentroDesde.id].sort();

    await noFuso(fuso, async (conexoes, gravados) => {
      expect(await rodarAlertasSla(agora)).toEqual({ alertados: 3, notificacoes: 3 });
      expect(await rodarAlertasSla(agora)).toEqual({ alertados: 0, notificacoes: 0 });
      expect(conexoes).toHaveLength(2);
      expect(conexoes.every((c) => c.fuso === fuso && c.pid > 0)).toBe(true);
      expect(gravados).toHaveLength(6);
      for (const registro of gravados) {
        expect(registro).toMatchObject({ instante: "2026-10-19T15:00:00.000", tipo: "timestamp without time zone" });
      }
    });

    const reclamados = await prisma.atendimentoWhatsApp.findMany({
      where: { slaAlertadoEm: { not: null } }, orderBy: { id: "asc" }, select: { id: true, slaAlertadoEm: true },
    });
    expect(reclamados.map((a) => a.id)).toEqual(esperados);
    for (const a of reclamados) expect(a.slaAlertadoEm).toEqual(agora);
    expect(await prisma.atendimentoWhatsApp.count({
      where: { id: { in: [futuro.id, limiteDesde.id] }, slaAlertadoEm: null },
    })).toBe(2);
    const notificacoes = await prisma.notificacaoUsuario.findMany({ where: { tipo: "SLA_ESTOURADO" } });
    expect(notificacoes.map((n) => n.refId).sort()).toEqual(esperados);
    expect(notificacoes.every((n) => n.usuarioId === responsavelId)).toBe(true);
    const eventos = await prisma.evento.findMany({ where: { tipo: "SlaEstouradoAlertado" } });
    expect(eventos.map((e) => e.agregadoId).sort()).toEqual(esperados);
  });

  it("mantem a exclusao Aria pelo instante de envio sem conversao de colunas", async () => {
    const respondeuNoPrazo = await criarAtendimento(new Date("2026-10-19T14:55:00Z"));
    const respondeuDepois = await criarAtendimento(new Date("2026-10-19T14:55:00Z"));
    for (const [atendimento, enviadaEm] of [
      [respondeuNoPrazo, new Date("2026-10-19T14:55:00.000Z")],
      [respondeuDepois, new Date("2026-10-19T14:55:00.001Z")],
    ] as const) {
      const conversa = await prisma.conversaWhatsApp.findUniqueOrThrow({ where: { id: atendimento.conversaId } });
      await prisma.mensagemWhatsApp.create({ data: {
        atendimentoId: atendimento.id, conversaId: conversa.id, numeroId: conversa.numeroId,
        direcao: "SAIDA", origem: "IA", status: "ENVIADA", driver: "MOTOR",
        criadoEm: new Date("2026-10-19T14:30:00Z"), enviadaEm,
      } });
    }
    await noFuso(fuso, async (conexoes) => {
      expect(await rodarAlertasSla(agora)).toEqual({ alertados: 1, notificacoes: 1 });
      expect(await rodarAlertasSla(agora)).toEqual({ alertados: 0, notificacoes: 0 });
      expect(conexoes).toHaveLength(2);
    });
    expect(await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: respondeuNoPrazo.id } })).toMatchObject({ slaAlertadoEm: null });
    expect(await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: respondeuDepois.id } })).toMatchObject({ slaAlertadoEm: agora });
    expect(await prisma.notificacaoUsuario.count({ where: { refId: respondeuNoPrazo.id } })).toBe(0);
    expect(await prisma.notificacaoUsuario.count({ where: { refId: respondeuDepois.id } })).toBe(1);
  });
});
