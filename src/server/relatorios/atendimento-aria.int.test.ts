import { describe, it, expect, beforeEach } from "vitest";
import { Papel, type OrigemEnvio } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import type { EscopoRelatorio } from "./escopo";
import { metricasAtendimento } from "./atendimento";
import { metricasAriaEquipe } from "./aria";
import type { FiltrosRelatorio } from "./pipeline";

const f: FiltrosRelatorio = { periodo: { inicio: new Date("2026-11-01T00:00:00Z"), fim: new Date("2026-12-01T00:00:00Z") } };
const tudo: EscopoRelatorio = { tipo: "TUDO" };
const dia = (hhmm: string, d = "2026-11-10") => new Date(`${d}T${hhmm}:00Z`);

let vend1: Awaited<ReturnType<typeof criarUsuario>>;
let vend2: Awaited<ReturnType<typeof criarUsuario>>;
let numeroId: string;
let seq = 0;

beforeEach(async () => {
  await truncarBanco();
  vend1 = await criarUsuario([Papel.VENDEDOR], "V1");
  vend2 = await criarUsuario([Papel.VENDEDOR], "V2");
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Costa_Rica" } });
  numeroId = (await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+50670000000", rotulo: "Vendas", driver: "MOTOR", finalidade: "VENDAS", providerRef: "n1" },
  })).id;
});

interface Opc {
  inbound?: string;
  resposta?: string;
  por?: OrigemEnvio;
  dono?: string;
  prazo?: Date;
  finalidade?: "COMERCIAL" | "SECRETARIA";
  lead?: { etapa?: "MATRICULADO" | "PERDIDO" | "NOVO"; motivoPerda?: "NAO_RESPONDEU" };
}

async function atend(o: Opc = {}) {
  seq += 1;
  const dono = o.dono ?? vend1.id;
  const lead = await prisma.oportunidade.create({
    data: { nome: `Lead ${seq}`, vendedorDonoId: dono, etapa: o.lead?.etapa ?? "NOVO", motivoPerda: o.lead?.motivoPerda ?? null, criadoEm: dia("09:00") },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+5068000${String(seq).padStart(4, "0")}`, leadId: lead.id } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId, contatoId: contato.id } });
  const inbound = dia(o.inbound ?? "10:00");
  const a = await prisma.atendimentoWhatsApp.create({
    data: {
      conversaId: conversa.id, contextoChave: `c${seq}`, finalidade: o.finalidade ?? "COMERCIAL", leadId: lead.id,
      criadoEm: inbound, primeiroInboundEm: inbound, prazoRespostaEm: o.prazo ?? null,
      primeiraRespostaEm: o.resposta && (o.por ?? "HUMANO") !== "IA" ? dia(o.resposta) : null,
    },
  });
  await prisma.mensagemWhatsApp.create({
    data: { conversaId: conversa.id, numeroId, atendimentoId: a.id, direcao: "ENTRADA", corpo: "oi", driver: "MOTOR", criadoEm: inbound, providerMessageId: `in${seq}` },
  });
  if (o.resposta) {
    await prisma.mensagemWhatsApp.create({
      data: { conversaId: conversa.id, numeroId, atendimentoId: a.id, direcao: "SAIDA", origem: o.por ?? "HUMANO", corpo: "olá", driver: "MOTOR", criadoEm: dia(o.resposta), providerMessageId: `out${seq}` },
    });
  }
  return { a, lead };
}
const atendRespondidoPor = (por: OrigemEnvio, extra: Opc = {}) => atend({ resposta: "10:30", por, ...extra });

describe("atendimento e Aria × equipe", () => {
  it("primeira_resposta_da_coluna_da_fase3", async () => {
    await atend({ inbound: "10:00", resposta: "10:30" });
    expect((await metricasAtendimento(f, tudo)).primeiraRespostaMediaMin).toBe(30);
  });

  it("celular_conta_como_equipe", async () => {
    await atendRespondidoPor("CELULAR");
    expect((await metricasAriaEquipe(f, tudo)).equipe.atendimentos).toBe(1);
  });

  it("atendimento_da_aria_pela_primeira_saida", async () => {
    await atendRespondidoPor("IA");
    await atendRespondidoPor("HUMANO");
    const m = await metricasAriaEquipe(f, tudo);
    expect([m.aria.atendimentos, m.equipe.atendimentos]).toEqual([1, 1]);
  });

  it("vendedor_nao_ve_lado_da_equipe_inteira", async () => {
    await atendRespondidoPor("HUMANO", { dono: vend1.id });
    await atendRespondidoPor("HUMANO", { dono: vend1.id });
    await atendRespondidoPor("HUMANO", { dono: vend2.id });
    const m = await metricasAriaEquipe(f, { tipo: "USUARIOS", ids: [vend1.id] });
    expect(m.equipe.atendimentos).toBe(2);
    expect((await metricasAtendimento(f, { tipo: "USUARIOS", ids: [vend1.id] })).conversas).toBe(2);
    expect((await metricasAtendimento(f, tudo)).conversas).toBe(3);
  });

  it("escopo_pelo_responsavel_do_atendimento_tambem", async () => {
    const { a } = await atendRespondidoPor("HUMANO", { dono: vend2.id });
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { responsavelId: vend1.id } });
    expect((await metricasAtendimento(f, { tipo: "USUARIOS", ids: [vend1.id] })).conversas).toBe(1);
  });

  it("calor_no_fuso_da_escola", async () => {
    await atend({ inbound: "01:30" });
    // 2026-11-15T01:30Z = 19h30 de sábado (14/11) na Costa Rica; domingo = 0, sábado = 6; 19h = coluna 12
    await prisma.atendimentoWhatsApp.updateMany({ data: { primeiroInboundEm: new Date("2026-11-15T01:30:00Z") } });
    await prisma.mensagemWhatsApp.updateMany({ data: { criadoEm: new Date("2026-11-15T01:30:00Z") } });
    const r = await metricasAtendimento(f, tudo);
    expect(r.calor).toHaveLength(7);
    expect(r.calor[0]).toHaveLength(15);
    expect(r.calor[6][12]).toBe(1);
    expect(r.calor.flat().reduce((s, n) => s + n, 0)).toBe(1);
  });

  it("volume_por_dia_no_fuso_separa_aria_e_equipe", async () => {
    await atendRespondidoPor("IA");
    await atendRespondidoPor("CELULAR");
    await atendRespondidoPor("HUMANO");
    const r = await metricasAtendimento(f, tudo);
    expect(r.volume).toEqual([{ dia: "2026-11-10", aria: 1, equipe: 2 }]);
  });

  it("so_comercial_e_prazo_estourado", async () => {
    await atend({ finalidade: "SECRETARIA" });
    await atend({ inbound: "10:00", resposta: "11:00", prazo: dia("10:30") }); // respondeu depois do prazo
    await atend({ inbound: "10:00", resposta: "10:10", prazo: dia("10:30") }); // dentro do prazo
    await atend({ prazo: new Date("2026-01-01T10:30:00Z") }); // sem resposta, prazo vencido
    const r = await metricasAtendimento(f, tudo);
    expect(r.conversas).toBe(3);
    expect(r.prazoEstourado).toBe(2);
    expect(r.foraDoHorarioPct).toBeNull();
  });

  it("vazio_nao_quebra_e_taxas_ficam_nulas", async () => {
    const a = await metricasAtendimento(f, tudo);
    expect(a).toMatchObject({ conversas: 0, primeiraRespostaMediaMin: null, prazoEstourado: 0, volume: [] });
    const m = await metricasAriaEquipe(f, tudo);
    expect(m.aria).toEqual({ atendimentos: 0, conversao: null, primeiraRespostaMediaMin: null, perdidosSemResposta: 0 });
    expect([m.taxaHandoff, m.sugestoesAprovadas, m.etapasAvancadasAria]).toEqual([null, null, 0]);
  });

  it("conversao_perdidos_e_acoes_da_aria", async () => {
    const g = await atendRespondidoPor("IA", { lead: { etapa: "MATRICULADO" } });
    await atendRespondidoPor("IA", { lead: { etapa: "PERDIDO", motivoPerda: "NAO_RESPONDEU" } });
    await atendRespondidoPor("HUMANO", { lead: { etapa: "MATRICULADO" } });
    const turno = await prisma.turnoAgenteIA.create({
      data: { ancoraMensagemId: "m-ancora", atendimentoId: g.a.id, tipo: "ATENDIMENTO", resultado: "ok" },
    });
    const acao = (acaoTipo: "HANDOFF" | "MOVER_ETAPA" | "RESPONDER", status: "EXECUTADA" | "APROVADA" | "REJEITADA") =>
      prisma.acaoAgenteIA.create({
        data: { turnoId: turno.id, atendimentoId: g.a.id, oportunidadeId: g.lead.id, acao: acaoTipo, modoConfigurado: "x", status, confianca: 90, payload: {}, reversivel: true },
      });
    await acao("HANDOFF", "EXECUTADA");
    await acao("MOVER_ETAPA", "EXECUTADA");
    await acao("RESPONDER", "APROVADA");
    await acao("RESPONDER", "REJEITADA");
    const m = await metricasAriaEquipe(f, tudo);
    expect(m.aria).toMatchObject({ atendimentos: 2, conversao: 0.5, perdidosSemResposta: 1, primeiraRespostaMediaMin: 30 });
    expect(m.equipe).toMatchObject({ atendimentos: 1, conversao: 1 });
    expect(m.taxaHandoff).toBe(0.5);
    expect(m.etapasAvancadasAria).toBe(1);
    expect(m.sugestoesAprovadas).toBe(0.5);
  });
});
