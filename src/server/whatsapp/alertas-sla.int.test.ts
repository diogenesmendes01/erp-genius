import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { rodarAlertasSla } from "./alertas-sla";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let v1: U, g1: U, admin: U;
let seq = 0;
const agora = new Date("2026-10-19T15:00:00Z");
const minutos = (n: number) => new Date(agora.getTime() + n * 60_000);

async function sla(finalidade: "COMERCIAL" | "SECRETARIA", c: { alertarResponsavel: boolean; alertarGerente: boolean }) {
  await prisma.prazoRespostaSetor.upsert({ where: { finalidade }, create: { finalidade, minutos: 60, ...c }, update: c });
}
async function atendimento(over: { prazo?: Date; responsavelId?: string | null; finalidade?: "COMERCIAL" | "SECRETARIA"} = {}) {
  seq += 1;
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: `+55119100${String(seq).padStart(5, "0")}`, rotulo: "Vendas", driver: "MOTOR", finalidade: "VENDAS", providerRef: `n-${seq}` } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: (await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+50691${String(seq).padStart(6, "0")}`, nomeExibicao: `Maria ${seq}` } })).id } });
  const responsavelId = over.responsavelId === undefined ? v1.id : over.responsavelId;
  return prisma.atendimentoWhatsApp.create({
    data: {
      conversaId: conversa.id, contextoChave: `x:${seq}`, finalidade: over.finalidade ?? "COMERCIAL", responsavelId,
      status: responsavelId ? "EM_ATENDIMENTO" : "ABERTO_SEM_RESPONSAVEL",
      primeiroInboundEm: minutos(-120), prazoRespostaEm: over.prazo ?? minutos(-5),
    },
  });
}
const contarNotif = (id: string) => prisma.notificacaoUsuario.count({ where: { tipo: "SLA_ESTOURADO", refId: id } });
const eventosSla = async (id: string) => (await eventosDo("AtendimentoWhatsApp", id)).filter((e) => e.tipo === "SlaEstouradoAlertado");

beforeEach(async () => {
  await truncarBanco();
  v1 = await criarUsuario([Papel.VENDEDOR], "V1");
  g1 = await criarUsuario([Papel.GERENTE_COMERCIAL], "G1");
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  await sla("COMERCIAL", { alertarResponsavel: true, alertarGerente: false });
});

describe("rodarAlertasSla", () => {
  it("estourado_gera_notificacao_e_evento_uma_vez", async () => {
    const a = await atendimento();
    expect(await rodarAlertasSla(agora)).toEqual({ alertados: 1, notificacoes: 1 });
    expect(await rodarAlertasSla(agora)).toEqual({ alertados: 0, notificacoes: 0 });
    expect(await contarNotif(a.id)).toBe(1);
    expect(await eventosSla(a.id)).toHaveLength(1);
    const n = await prisma.notificacaoUsuario.findFirstOrThrow({ where: { refId: a.id } });
    expect(n).toMatchObject({ usuarioId: v1.id, refTipo: "AtendimentoWhatsApp", titulo: `Prazo estourado: Maria ${seq} (Comercial)` });
    expect((await eventosSla(a.id))[0]).toMatchObject({ autorId: null, payload: { finalidade: "COMERCIAL", responsavelId: v1.id, destinatarios: [v1.id] } });
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).slaAlertadoEm).toEqual(agora);
  });

  it("responsavel_e_gerente_recebem_um_cada", async () => {
    await sla("COMERCIAL", { alertarResponsavel: true, alertarGerente: true });
    const a = await atendimento();
    expect((await rodarAlertasSla(agora)).notificacoes).toBe(2);
    expect((await prisma.notificacaoUsuario.findMany({ where: { refId: a.id }, select: { usuarioId: true } })).map((n) => n.usuarioId).sort()).toEqual([v1.id, g1.id].sort());
  });

  it("concorrencia_nao_duplica", async () => {
    const a = await atendimento();
    const [x, y] = await Promise.all([rodarAlertasSla(agora), rodarAlertasSla(agora)]);
    expect(x.alertados + y.alertados).toBe(1);
    expect(await contarNotif(a.id)).toBe(1);
  });

  it("respondido_encerrado_ou_aria_nao_alerta", async () => {
    const respondido = await atendimento();
    await prisma.atendimentoWhatsApp.update({ where: { id: respondido.id }, data: { primeiraRespostaEm: minutos(-10), status: "AGUARDANDO_CLIENTE" } });
    const encerrado = await atendimento();
    await prisma.atendimentoWhatsApp.update({ where: { id: encerrado.id }, data: { status: "ENCERRADO", encerradoEm: minutos(-1) } });
    // Conversa de grupo não abre atendimento (trigger do banco); o filtro grupoId do claim é só defesa.
    const aria = await atendimento();
    const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: aria.id }, include: { conversa: true } });
    await prisma.mensagemWhatsApp.create({ data: { atendimentoId: aria.id, conversaId: conv.conversaId, numeroId: conv.conversa.numeroId, direcao: "SAIDA", origem: "IA", status: "ENVIADA", driver: "MOTOR", corpo: "Olá!", criadoEm: minutos(-30) } });
    expect((await rodarAlertasSla(agora)).alertados).toBe(0);
  });

  it("aria_que_respondeu_depois_do_prazo_ou_falhou_nao_evita_o_alerta", async () => {
    const a = await atendimento();
    const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id }, include: { conversa: true } });
    const msg = { atendimentoId: a.id, conversaId: conv.conversaId, numeroId: conv.conversa.numeroId, direcao: "SAIDA" as const, origem: "IA" as const, driver: "MOTOR" as const };
    await prisma.mensagemWhatsApp.create({ data: { ...msg, status: "FALHOU", criadoEm: minutos(-30) } });
    await prisma.mensagemWhatsApp.create({ data: { ...msg, status: "ENVIADA", criadoEm: minutos(-1) } });
    expect((await rodarAlertasSla(agora)).alertados).toBe(1);
  });

  it("alertas_desligados_marcam_sem_notificar", async () => {
    await sla("COMERCIAL", { alertarResponsavel: false, alertarGerente: false });
    const a = await atendimento();
    await rodarAlertasSla(agora);
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } })).slaAlertadoEm).not.toBeNull();
    expect(await contarNotif(a.id)).toBe(0);
    expect((await eventosSla(a.id))[0].payload).toMatchObject({ destinatarios: [] });
  });

  it("estouro_antigo_fora_da_janela_nao_alerta", async () => {
    await atendimento({ prazo: minutos(-25 * 60) });
    expect((await rodarAlertasSla(agora)).alertados).toBe(0);
  });

  it("ainda_no_prazo_nao_alerta", async () => {
    await atendimento({ prazo: minutos(1) });
    expect((await rodarAlertasSla(agora)).alertados).toBe(0);
  });

  it("sem_responsavel_vai_ao_gerente_e_sem_gerente_ao_admin", async () => {
    const a = await atendimento({ responsavelId: null });
    await rodarAlertasSla(agora);
    expect((await eventosSla(a.id))[0].payload).toMatchObject({ destinatarios: [g1.id] });
    await prisma.usuario.update({ where: { id: g1.id }, data: { ativo: false } });
    const b = await atendimento({ responsavelId: null });
    await rodarAlertasSla(agora);
    expect((await eventosSla(b.id))[0].payload).toMatchObject({ destinatarios: [admin.id] });
  });

  it("gerente_desativado_nao_recebe", async () => {
    await sla("COMERCIAL", { alertarResponsavel: true, alertarGerente: true });
    const g2 = await criarUsuario([Papel.GERENTE_COMERCIAL], "G2");
    await prisma.usuario.update({ where: { id: g1.id }, data: { ativo: false } });
    const a = await atendimento();
    await rodarAlertasSla(agora);
    const destinatarios = ((await eventosSla(a.id))[0].payload as { destinatarios: string[] }).destinatarios;
    expect(destinatarios).not.toContain(g1.id);
    expect(destinatarios).toEqual([v1.id, g2.id]);
  });

  it("secretaria_sem_responsavel_vai_ao_admin", async () => {
    await sla("SECRETARIA", { alertarResponsavel: true, alertarGerente: false });
    const a = await atendimento({ finalidade: "SECRETARIA", responsavelId: null });
    await rodarAlertasSla(agora);
    expect((await eventosSla(a.id))[0].payload).toMatchObject({ destinatarios: [admin.id] });
  });
});
