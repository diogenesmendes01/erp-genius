import { describe, it, expect, beforeEach } from "vitest";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { Papel, type EtapaLead, type MotivoPerda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscopoRelatorio } from "./escopo";
import { metricasFunil } from "./funil";
import { metricasPipeline, type FiltrosRelatorio } from "./pipeline";

const DIA = 86_400_000;
const base = new Date("2026-03-02T12:00:00Z");
const em = (dias: number) => new Date(base.getTime() + dias * DIA);
const f: FiltrosRelatorio = { periodo: { inicio: new Date("2026-03-01T00:00:00Z"), fim: new Date("2026-04-30T00:00:00Z") } };
const tudo: EscopoRelatorio = { tipo: "TUDO" };

let vend1: Awaited<ReturnType<typeof criarUsuario>>;
let vend2: Awaited<ReturnType<typeof criarUsuario>>;
let paises: Record<string, string>;

beforeEach(async () => {
  await truncarBanco();
  vend1 = await criarUsuario([Papel.VENDEDOR], "V1");
  vend2 = await criarUsuario([Papel.VENDEDOR], "V2");
  paises = {};
  for (const [iso, moeda, ddi] of [["BR", "BRL", "+55"], ["CR", "CRC", "+506"]] as const) {
    paises[moeda] = (await prisma.pais.create({ data: { nome: iso, codigoISO: iso, moedaLocal: moeda, ddi } })).id;
  }
});

async function op(o: { etapa?: EtapaLead; valor?: number | null; moeda?: string; dono?: string; criadoEm?: Date; temperatura?: "QUENTE" | "FRIO" } = {}) {
  return prisma.oportunidade.create({
    data: {
      nome: "Lead",
      etapa: o.etapa ?? "NOVO",
      vendedorDonoId: o.dono ?? vend1.id,
      criadoEm: o.criadoEm ?? em(0),
      valorPrevisto: o.valor ?? null,
      paisId: o.moeda ? paises[o.moeda] : null,
      temperatura: o.temperatura ?? "MORNO",
    },
  });
}
const ev = (leadId: string, tipo: string, dias: number, payload?: object) =>
  prisma.evento.create({ data: { tipo, agregadoTipo: "Lead", agregadoId: leadId, criadoEm: em(dias), payload } });
const etapa = (leadId: string, de: string, para: string, dias: number) => ev(leadId, "EtapaAlterada", dias, { de, para });

/** "NOVO>QUALIFICADO" → eventos de etapa, um dia depois do outro. */
async function opComEventos(passos: string[]) {
  const o = await op({ etapa: passos.at(-1)!.split(">")[1] as EtapaLead });
  for (const [i, p] of passos.entries()) {
    const [de, para] = p.split(">");
    await etapa(o.id, de, para, i + 1);
  }
  return o;
}
async function opComEventosEm(passos: [string, number][]) {
  const o = await op({ etapa: passos.at(-1)![0].split(">")[1] as EtapaLead });
  for (const [p, d] of passos) {
    const [de, para] = p.split(">");
    await etapa(o.id, de, para, d);
  }
  return o;
}
async function opPerdidaEm(onde: EtapaLead, motivo: MotivoPerda) {
  const o = await op({ etapa: "PERDIDO" });
  await etapa(o.id, "NOVO", onde, 1);
  await ev(o.id, "LeadPerdido", 2, { motivoPerda: motivo });
  await prisma.oportunidade.update({ where: { id: o.id }, data: { motivoPerda: motivo } });
  return o;
}
const chegaram = (r: Awaited<ReturnType<typeof metricasFunil>>, e: string) => r.etapas.find((x) => x.etapa === e)!.chegaram;
const tempo = (r: Awaited<ReturnType<typeof metricasFunil>>, e: string) => r.etapas.find((x) => x.etapa === e)!.tempoMedioDias;

describe("funil por eventos de etapa", () => {
  it("chegou_conta_etapas_puladas", async () => {
    await opComEventos(["NOVO>QUALIFICADO", "QUALIFICADO>PROPOSTA"]);
    const r = await metricasFunil(f, tudo);
    expect(chegaram(r, "EM_ATENDIMENTO")).toBe(1);
    expect(chegaram(r, "EXPERIMENTAL_AGENDADA")).toBe(1);
    expect(chegaram(r, "PROPOSTA")).toBe(1);
    expect(chegaram(r, "AGUARDANDO_MATRICULA")).toBe(0);
    expect(r.etapas.find((x) => x.etapa === "NOVO")!.conversaoProxima).toBe(1);
    expect(r.etapas.find((x) => x.etapa === "PROPOSTA")!.conversaoProxima).toBe(0);
    expect(r.etapas.find((x) => x.etapa === "PROPOSTA")!.agora).toBe(1);
  });
  it("tempo_soma_idas_e_voltas", async () => {
    await opComEventosEm([["NOVO>EM_ATENDIMENTO", 0], ["EM_ATENDIMENTO>QUALIFICADO", 2], ["QUALIFICADO>EM_ATENDIMENTO", 3], ["EM_ATENDIMENTO>QUALIFICADO", 4]]);
    const r = await metricasFunil(f, tudo);
    expect(tempo(r, "EM_ATENDIMENTO")).toBe(3);
    expect(chegaram(r, "EM_ATENDIMENTO")).toBe(1); // a volta não conta como nova chegada
  });
  it("fora_do_periodo_nao_conta_e_eventos_de_acao_especifica_contam", async () => {
    const o = await op({ etapa: "PROPOSTA" });
    await ev(o.id, "PropostaEnviada", 5);
    await ev(o.id, "ExperimentalAgendada", 3);
    const r = await metricasFunil(f, tudo);
    expect(chegaram(r, "EXPERIMENTAL_AGENDADA")).toBe(1);
    expect(chegaram(r, "PROPOSTA")).toBe(1);
    const fora = await metricasFunil({ periodo: { inicio: new Date("2027-01-01T00:00:00Z"), fim: new Date("2027-02-01T00:00:00Z") } }, tudo);
    expect(chegaram(fora, "NOVO")).toBe(0);
    expect(fora.etapas[0].conversaoProxima).toBeNull();
  });
  it("perda_registra_etapa_onde_parou", async () => {
    await opPerdidaEm("PROPOSTA", "PRECO");
    expect((await metricasFunil(f, tudo)).perdas[0]).toEqual({ motivo: "PRECO", quantidade: 1, etapaMaisComum: "PROPOSTA" });
  });
  it("perdas_agrupam_por_motivo_e_ordenam_por_quantidade", async () => {
    await opPerdidaEm("QUALIFICADO", "TEMPO");
    await opPerdidaEm("PROPOSTA", "PRECO");
    await opPerdidaEm("PROPOSTA", "PRECO");
    await opPerdidaEm("QUALIFICADO", "PRECO");
    const { perdas } = await metricasFunil(f, tudo);
    expect(perdas).toEqual([
      { motivo: "PRECO", quantidade: 3, etapaMaisComum: "PROPOSTA" },
      { motivo: "TEMPO", quantidade: 1, etapaMaisComum: "QUALIFICADO" },
    ]);
  });
  it("escopo_filtra_o_funil", async () => {
    await opComEventos(["NOVO>QUALIFICADO"]);
    const o2 = await op({ dono: vend2.id });
    await etapa(o2.id, "NOVO", "QUALIFICADO", 1);
    expect(chegaram(await metricasFunil(f, { tipo: "USUARIOS", ids: [vend2.id] }), "QUALIFICADO")).toBe(1);
    expect(chegaram(await metricasFunil(f, tudo), "QUALIFICADO")).toBe(2);
  });
});

describe("pipeline", () => {
  it("pipeline_por_moeda_e_sem_valor", async () => {
    await op({ valor: 700, moeda: "BRL" });
    await op({ valor: 85000, moeda: "CRC" });
    await op({ valor: 300, moeda: "BRL" });
    await op({ valor: null });
    await op({ valor: 999, moeda: "BRL", etapa: "PERDIDO" }); // fechada não entra
    expect(await metricasPipeline(f, tudo)).toMatchObject({
      valorPipeline: [{ moeda: "BRL", valor: 1000 }, { moeda: "CRC", valor: 85000 }],
      semValor: 1,
      abertas: 4,
    });
  });
  it("conversao_null_sem_criadas", async () => expect((await metricasPipeline(f, tudo)).conversao).toBeNull());
  it("ganhas_ticket_ciclo_e_conversao", async () => {
    const a = await op({ etapa: "MATRICULADO", valor: 100, moeda: "BRL", criadoEm: em(0) });
    await etapa(a.id, "AGUARDANDO_MATRICULA", "MATRICULADO", 10);
    const b = await op({ etapa: "MATRICULADO", valor: 300, moeda: "BRL", criadoEm: em(0) });
    await etapa(b.id, "AGUARDANDO_MATRICULA", "MATRICULADO", 20);
    await op({ etapa: "QUALIFICADO" });
    await op({ etapa: "PERDIDO" });
    const r = await metricasPipeline(f, tudo);
    expect(r).toMatchObject({ criadas: 4, ganhas: 2, ticketMedio: [{ moeda: "BRL", valor: 200 }], cicloMedioDias: 15 });
    expect(r.conversao).toBe(0.5);
  });
  it("escopo_vendedor_filtra", async () => {
    await op({ dono: vend1.id });
    await op({ dono: vend1.id });
    for (let i = 0; i < 3; i++) await op({ dono: vend2.id });
    expect((await metricasPipeline(f, { tipo: "USUARIOS", ids: [vend1.id] })).criadas).toBe(2);
    expect((await metricasPipeline({ ...f, responsavelId: vend2.id }, tudo)).criadas).toBe(3);
    expect((await metricasPipeline({ ...f, responsavelId: vend2.id }, { tipo: "USUARIOS", ids: [vend1.id] })).criadas).toBe(0);
  });
  it("filtros_temperatura_e_autor", async () => {
    await op({ temperatura: "QUENTE" });
    await op({ temperatura: "FRIO" });
    expect((await metricasPipeline({ ...f, temperatura: "QUENTE" }, tudo)).criadas).toBe(1);
    expect((await metricasPipeline({ ...f, autor: "EQUIPE" }, tudo)).criadas).toBe(2);
    expect((await metricasPipeline({ ...f, autor: "ARIA" }, tudo)).criadas).toBe(0);
  });
});
