import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { listarAtendimentosPagina } from "@/server/inbox/consultas-pagina";
import type { HorarioAtendimento } from "@/server/crm-config/horario-atendimento";
import { aplicarInbound } from "./status-atendimento";

const d = (s: string) => new Date(s);
const util: HorarioAtendimento = { intervalos: [1, 2, 3, 4, 5].map((dia) => ({ dia, inicio: "08:00", fim: "18:00" })), feriados: [] };
let seq = 0;

async function sla(finalidade: "COMERCIAL", c: { minutos: number; contarSoNoHorario: boolean; horario: unknown }) {
  const dados = { minutos: c.minutos, contarSoNoHorario: c.contarSoNoHorario, horario: c.horario === null ? undefined : (c.horario as object) };
  await prisma.prazoRespostaSetor.upsert({ where: { finalidade }, create: { finalidade, ...dados }, update: dados });
}
async function abrirComercial() {
  seq += 1;
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: `+55119000${String(seq).padStart(5, "0")}`, rotulo: "Vendas", driver: "MOTOR", finalidade: "VENDAS", providerRef: `n-${seq}` } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+50690${String(seq).padStart(6, "0")}` } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  return prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: `COMERCIAL:${seq}`, finalidade: "COMERCIAL" } });
}
const prazoDe = async (id: string) => (await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id } })).prazoRespostaEm;
async function inboundSextaNoite() {
  const a = await abrirComercial();
  await prisma.$transaction((tx) => aplicarInbound(tx, a.id, d("2026-10-16T19:00-03:00")));
  return a;
}

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "America/Sao_Paulo" }, update: { fusoInstitucional: "America/Sao_Paulo" } });
});
afterEach(() => { vi.useRealTimers(); });

describe("prazo da 1ª resposta respeita o horário do setor", () => {
  it("inbound_sexta_noite_vence_segunda", async () => {
    await sla("COMERCIAL", { minutos: 60, contarSoNoHorario: true, horario: util });
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-19T09:00-03:00"));
  });

  it("flag_desligada_conta_corrido", async () => {
    await sla("COMERCIAL", { minutos: 60, contarSoNoHorario: false, horario: util });
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-16T20:00-03:00"));
  });

  it("sem_horario_conta_corrido", async () => {
    await sla("COMERCIAL", { minutos: 60, contarSoNoHorario: true, horario: null });
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-16T20:00-03:00"));
  });

  it("horario_corrompido_conta_corrido_e_avisa", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await sla("COMERCIAL", { minutos: 60, contarSoNoHorario: true, horario: { intervalos: "x" } });
    const a = await inboundSextaNoite();
    expect(await prazoDe(a.id)).toEqual(d("2026-10-16T20:00-03:00"));
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it("usa_o_fuso_da_escola", async () => {
    await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "America/Costa_Rica" } });
    await sla("COMERCIAL", { minutos: 30, contarSoNoHorario: true, horario: util });
    const a = await abrirComercial();
    await prisma.$transaction((tx) => aplicarInbound(tx, a.id, d("2026-10-19T07:30-06:00")));
    expect(await prazoDe(a.id)).toEqual(d("2026-10-19T08:30-06:00"));
  });

  it("filtro_prazo_estourado_usa_o_prazo_util", async () => {
    await sla("COMERCIAL", { minutos: 60, contarSoNoHorario: true, horario: util });
    const a = await inboundSextaNoite();
    const admin = await criarUsuario([Papel.ADMINISTRADOR]);
    const ids = async () => (await listarAtendimentosPagina({ id: admin.id, papeis: [Papel.ADMINISTRADOR] } as never, { prazoEstourado: true }, null)).itens.map((i) => i.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d("2026-10-17T12:00-03:00")); // sábado: ainda no prazo útil
    expect(await ids()).not.toContain(a.id);
    vi.setSystemTime(d("2026-10-19T09:01-03:00")); // segunda, passou da 1ª hora útil
    expect(await ids()).toContain(a.id);
  });
});
