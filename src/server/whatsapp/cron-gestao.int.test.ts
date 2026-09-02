import { describe, it, expect, beforeEach, vi } from "vitest";
import { EtapaLead } from "@prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { rodarGestao } from "./cron-gestao";
import { despacharFila } from "./despachante";

// C5 (doc 27): alerta de SLA + relatório diário do gestor — idempotência, regra de ouro
// (nasce desligada) e o caminho GESTAO no despachante (shadow próprio, isento de janela).

let dono: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  dono = await criarUsuario([]);
});

async function seedNumero() {
  return prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511955556666", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "inst-g", donoId: dono.id },
  });
}

async function ligarGestao(numeroId: string, over: Record<string, unknown> = {}) {
  await prisma.configComercial.upsert({
    where: { id: "comercial" },
    create: {
      id: "comercial",
      gestaoEstado: "SHADOW",
      gestaoTelefoneE164: "+5511900009999",
      gestaoNumeroId: numeroId,
      gestaoSlaMinutos: 30,
      gestaoRelatorioHora: 19,
      ...over,
    },
    update: {
      gestaoEstado: "SHADOW",
      gestaoTelefoneE164: "+5511900009999",
      gestaoNumeroId: numeroId,
      gestaoSlaMinutos: 30,
      gestaoRelatorioHora: 19,
      ...over,
    },
  });
}

async function seedLeadEstourado(min = 45) {
  return prisma.lead.create({
    data: {
      codigo: `L-${Math.floor(Math.random() * 1e6)}`,
      nome: "Parado",
      etapa: EtapaLead.NOVO,
      criadoEm: new Date(Date.now() - min * 60_000),
    },
  });
}

describe("regra de ouro", () => {
  it("desligada (default) → nada é gerado", async () => {
    await seedLeadEstourado();
    const r = await rodarGestao();
    expect(r.executou).toBe(false);
    expect(r.motivoParada).toBe("gestao_desligada");
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });
});

describe("alerta de SLA", () => {
  it("leads estourados viram UMA mensagem agregada + evento por lead (idempotente)", async () => {
    const numero = await seedNumero();
    await ligarGestao(numero.id);
    const l1 = await seedLeadEstourado(45);
    const l2 = await seedLeadEstourado(60);
    await seedLeadEstourado(10); // dentro do SLA — não alerta

    const r1 = await rodarGestao(new Date());
    expect(r1.alertaSla.leadsAlertados).toBe(2);
    const intencoes = await prisma.intencaoMensagem.findMany();
    expect(intencoes).toHaveLength(1);
    expect(intencoes[0].origem).toBe("GESTAO");
    expect(intencoes[0].corpoRenderizado).toContain("Alerta de SLA");
    expect(intencoes[0].corpoRenderizado).toContain("2 lead(s)");

    // Tick seguinte: os mesmos leads NÃO re-alertam.
    const r2 = await rodarGestao(new Date());
    expect(r2.alertaSla.leadsAlertados).toBe(0);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "AlertaSlaEnviado", agregadoId: l1.id } })).toBe(1);
    expect(await prisma.evento.count({ where: { tipo: "AlertaSlaEnviado", agregadoId: l2.id } })).toBe(1);
  });
});

describe("relatório diário", () => {
  it("sai UMA vez por dia a partir da hora configurada, com funil e gargalos", async () => {
    const numero = await seedNumero();
    await ligarGestao(numero.id, { gestaoRelatorioHora: 0 }); // qualquer hora serve no teste

    const r1 = await rodarGestao(new Date());
    expect(r1.relatorio.enviado).toBe(true);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { origem: "GESTAO" } });
    expect(intencao.corpoRenderizado).toContain("Relatório diário");
    expect(intencao.corpoRenderizado).toContain("Gargalos");

    const r2 = await rodarGestao(new Date());
    expect(r2.relatorio.enviado).toBe(false);
    expect(r2.relatorio.motivo).toBe("ja_enviado_hoje");
  });

  it("antes da hora configurada não envia", async () => {
    const numero = await seedNumero();
    await ligarGestao(numero.id, { gestaoRelatorioHora: 23 });
    const cedo = new Date();
    cedo.setHours(8, 0, 0, 0);
    const r = await rodarGestao(cedo);
    expect(r.relatorio.enviado).toBe(false);
    expect(r.relatorio.motivo).toBe("antes_da_hora");
  });
});

describe("despachante × origem GESTAO", () => {
  it("SHADOW da gestão simula; ATIVA sem WHATSAPP_LIVE também simula (ambiente)", async () => {
    const numero = await seedNumero();
    await ligarGestao(numero.id);
    await seedLeadEstourado(45);
    await rodarGestao(new Date());

    const r = await despacharFila(new Date());
    expect(r.simuladas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("SIMULADA");
  });

  it("mensagem de gestão é isenta da janela de horário (madrugada despacha mesmo assim)", async () => {
    const numero = await seedNumero();
    await ligarGestao(numero.id);
    await seedLeadEstourado(45);
    await rodarGestao(new Date());

    const madrugada = new Date();
    madrugada.setHours(3, 0, 0, 0);
    const r = await despacharFila(madrugada);
    // Não fica ADIADA por "fora_da_janela": vira SIMULADA direto (shadow do ambiente).
    expect(r.adiadas).toBe(0);
    expect(r.simuladas).toBe(1);
  });
});
