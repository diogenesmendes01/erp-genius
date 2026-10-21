import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import type { HorarioAtendimento } from "@/server/crm-config/horario-atendimento";
import { aplicarInbound } from "./status-atendimento";

// Feriados no SLA: o prazo da 1ª resposta pula os FERIADOS do calendário escolar institucional aprovado
// vigente (o mesmo da agenda), somados aos feriados do setor. Não há cadastro paralelo de feriados.
const d = (s: string) => new Date(s);
const util: HorarioAtendimento = { intervalos: [1, 2, 3, 4, 5].map((dia) => ({ dia, inicio: "08:00", fim: "18:00" })), feriados: [] };
type Periodo = { id: string; nome: string; tipo: "FERIADO" | "RECESSO" | "FERIAS"; inicio: string; fim: string };
const feriado = (id: string, inicio: string, fim = inicio): Periodo => ({ id, nome: `Feriado ${id}`, tipo: "FERIADO", inicio, fim });
let seq = 0;
let preparador: { id: string };
let decisor: { id: string };

async function sla(c: { minutos: number; contarSoNoHorario: boolean; horario: HorarioAtendimento }) {
  await prisma.prazoRespostaSetor.upsert({ where: { finalidade: "COMERCIAL" }, create: { finalidade: "COMERCIAL", ...c }, update: c });
}
async function calendario(versao: number, periodos: Periodo[], aprovada: boolean | null) {
  await prisma.versaoCalendarioEscolar.create({ data: {
    versao, preparadorId: preparador.id, fusoInstitucional: "America/Sao_Paulo", periodos, motivo: "Calendário de teste do SLA",
    chaveIdempotencia: `cal-sla-${versao}`, entradaHash: `h${versao}`,
    ...(aprovada === null ? {} : { decisao: { create: { decisorId: decisor.id, aprovada, motivo: "Decisão de teste" } } }),
  } });
}
async function abrirComercial() {
  seq += 1;
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: `+55119100${String(seq).padStart(5, "0")}`, rotulo: "Vendas", driver: "MOTOR", finalidade: "VENDAS", providerRef: `nf-${seq}` } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+50691${String(seq).padStart(6, "0")}` } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  return prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: `COMERCIAL:f${seq}`, finalidade: "COMERCIAL" } });
}
const prazoDe = async (id: string) => (await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id } })).prazoRespostaEm;
/** Sexta 16/10/2026 19:00 em São Paulo: fora do horário; sem feriado, 60 min vencem segunda 19/10 09:00. */
async function inboundSextaNoite() {
  const a = await abrirComercial();
  await prisma.$transaction((tx) => aplicarInbound(tx, a.id, d("2026-10-16T19:00-03:00")));
  return a;
}

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "America/Sao_Paulo" }, update: { fusoInstitucional: "America/Sao_Paulo" } });
  preparador = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  decisor = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gerente");
});

describe("prazo da 1ª resposta pula feriados do calendário escolar", () => {
  it("feriado_do_calendario_aprovado_pula_o_dia", async () => {
    await sla({ minutos: 60, contarSoNoHorario: true, horario: util });
    await calendario(1, [feriado("seg", "2026-10-19")], true);
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-20T09:00-03:00"));
  });

  it("feriado_de_varios_dias", async () => {
    await sla({ minutos: 60, contarSoNoHorario: true, horario: util });
    await calendario(1, [feriado("semana", "2026-10-19", "2026-10-21")], true);
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-22T09:00-03:00"));
  });

  it("proposta_pendente_ou_reprovada_nao_vale", async () => {
    await sla({ minutos: 60, contarSoNoHorario: true, horario: util });
    await calendario(1, [feriado("seg", "2026-10-19")], null);
    await calendario(2, [feriado("seg", "2026-10-19")], false);
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-19T09:00-03:00"));
  });

  it("vale_a_versao_aprovada_mais_recente", async () => {
    await sla({ minutos: 60, contarSoNoHorario: true, horario: util });
    await calendario(1, [feriado("seg", "2026-10-19")], true);
    await calendario(2, [], true); // feriado removido na versão seguinte
    await calendario(3, [feriado("ter", "2026-10-20")], null); // pendente: ainda não vale
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-19T09:00-03:00"));
  });

  it("recesso_e_ferias_nao_fecham_o_atendimento", async () => {
    await sla({ minutos: 60, contarSoNoHorario: true, horario: util });
    await calendario(1, [
      { id: "r", nome: "Recesso", tipo: "RECESSO", inicio: "2026-10-19", fim: "2026-10-19" },
      { id: "f", nome: "Férias", tipo: "FERIAS", inicio: "2026-10-19", fim: "2026-10-30" },
    ], true);
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-19T09:00-03:00"));
  });

  it("feriado_do_setor_e_da_escola_somam", async () => {
    await sla({ minutos: 60, contarSoNoHorario: true, horario: { ...util, feriados: ["2026-10-20"] } });
    await calendario(1, [feriado("seg", "2026-10-19")], true);
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-21T09:00-03:00"));
  });

  it("contagem_corrida_ignora_feriados", async () => {
    await sla({ minutos: 60, contarSoNoHorario: false, horario: util });
    await calendario(1, [feriado("sex", "2026-10-16")], true);
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-16T20:00-03:00"));
  });

  it("usa_o_dia_civil_do_fuso_da_escola", async () => {
    // Costa Rica (−06:00): sexta 16/10 19:00 local é sábado 01:00 UTC. O feriado 19/10 é a segunda local.
    await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "America/Costa_Rica" } });
    await sla({ minutos: 60, contarSoNoHorario: true, horario: util });
    await calendario(1, [feriado("seg", "2026-10-19")], true);
    const a = await abrirComercial();
    await prisma.$transaction((tx) => aplicarInbound(tx, a.id, d("2026-10-16T19:00-06:00")));
    expect(await prazoDe(a.id)).toEqual(d("2026-10-20T09:00-06:00"));
  });

  it("prazo_gravado_nao_e_recalculado_ao_publicar_feriado", async () => {
    await sla({ minutos: 60, contarSoNoHorario: true, horario: util });
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-19T09:00-03:00"));
    await calendario(1, [feriado("seg", "2026-10-19")], true);
    // Novo inbound do mesmo atendimento: o prazo já gravado fica (D7).
    await prisma.$transaction((tx) => aplicarInbound(tx, a.id, d("2026-10-17T10:00-03:00")));
    expect(await prazoDe(a.id)).toEqual(d("2026-10-19T09:00-03:00"));
    // Um atendimento novo já usa o feriado publicado.
    const b = await inboundSextaNoite();
    expect(await prazoDe(b.id)).toEqual(d("2026-10-20T09:00-03:00"));
  });
});
