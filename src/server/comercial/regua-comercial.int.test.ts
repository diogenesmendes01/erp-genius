import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel, type DriverWhatsApp, type StatusTemplate } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { salvarReguaComercial } from "./acoes";
import { carregarPoliticaComercial } from "./regua-comercial";
import { CADENCIA_LEAD_NOVO, CADENCIA_PRE_EXPERIMENTAL, CHAVE_LEAD_NOVO, CHAVE_PRE_EXPERIMENTAL } from "./regua-fabrica";
import type { ReguaComercialInput } from "./schema";

// Integração E6/C1 — SALVAMENTO da régua comercial (doc 27 C1). Duas leis são verificadas
// aqui porque quebrá-las só apareceria muito depois, na hora do disparo:
//  · ORDEM CANÔNICA (review PR #55 P2): o motor corta o progresso pela ordem de FÁBRICA, mas
//    o loader ordena por OFFSET. Gravar +4h antes de +30min faria o +30min ser "superado"
//    para sempre — a régua andaria para frente sem nunca ter mandado o 1º degrau.
//  · TEMPLATE APROVADO no oficial (review PR #55 P1): +3d/+7d caem fora da janela de 24h.
//    Armar a régua num META_CLOUD sem template aprovado é armar algo que só quebra no envio.

beforeEach(async () => {
  await truncarBanco();
});

/** Cadência canônica completa, na ordem e nos offsets de fábrica (o "salvamento feliz"). */
function cadenciaFabrica(): ReguaComercialInput["degraus"] {
  return CADENCIA_LEAD_NOVO.map((d) => ({ passo: d.passo, offsetMinutos: d.offsetMinutos, ativo: true }));
}

function payload(over: Partial<ReguaComercialInput> = {}): ReguaComercialInput {
  return {
    // A CHAVE do cenário é obrigatória desde a C2 (doc 27): "um motor, N políticas" — o
    // salvamento precisa saber QUAL cadência canônica validar (review PR #56).
    chave: CHAVE_LEAD_NOVO,
    estado: "SHADOW",
    janelaInicio: 9,
    janelaFim: 20,
    tetoPorContatoDia: 2,
    degraus: cadenciaFabrica(),
    ...over,
  };
}

async function gerenteAutenticado() {
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
  authMock.mockResolvedValue({ user: { id: gerente.id } });
  return gerente;
}

async function seedRemetente(driver: DriverWhatsApp) {
  return prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511944443333", rotulo: "Vendas", driver, finalidade: "VENDAS", providerRef: "inst-r" },
  });
}

/** Um template por passo da cadência, todos no MESMO statusMeta. */
async function seedTemplates(statusMeta: StatusTemplate) {
  const porPasso = new Map<string, string>();
  for (const d of CADENCIA_LEAD_NOVO) {
    const t = await prisma.templateWhatsApp.create({ data: { nome: d.template, corpo: d.texto, statusMeta } });
    porPasso.set(d.passo, t.id);
  }
  return porPasso;
}

describe("salvarReguaComercial × ordem canônica da cadência", () => {
  it("cadência completa e crescente é aceita e materializa os 5 degraus", async () => {
    await gerenteAutenticado();
    const numero = await seedRemetente("BAILEYS");

    const r = await salvarReguaComercial(payload({ numeroRemetenteId: numero.id }));
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);

    const politica = await carregarPoliticaComercial();
    expect(politica.estado).toBe("SHADOW");
    expect(politica.degraus.map((d) => d.passo)).toEqual(CADENCIA_LEAD_NOVO.map((d) => d.passo));
    expect(politica.ordem).toEqual(CADENCIA_LEAD_NOVO.map((d) => d.passo));
  });

  it("offset fora da ordem de fábrica (+4h antes do +30min) é recusado", async () => {
    await gerenteAutenticado();
    const degraus = cadenciaFabrica().map((d) => (d.passo === "+4h" ? { ...d, offsetMinutos: 10 } : d));

    const r = await salvarReguaComercial(payload({ estado: "DESLIGADA", degraus }));
    expect(r.ok).toBe(false);
    expect((r as { erro: string }).erro).toContain("+4h");
    expect(await prisma.politicaComercial.count()).toBe(0); // nada é gravado pela metade
  });

  it("empate de offset também é recusado (a ordem é ESTRITA)", async () => {
    await gerenteAutenticado();
    const degraus = cadenciaFabrica().map((d) => (d.passo === "+4h" ? { ...d, offsetMinutos: 30 } : d));

    const r = await salvarReguaComercial(payload({ estado: "DESLIGADA", degraus }));
    expect(r.ok).toBe(false);
    expect(await prisma.politicaComercial.count()).toBe(0);
  });

  it("passo repetido é recusado", async () => {
    await gerenteAutenticado();
    const degraus = [...cadenciaFabrica(), { passo: "+30min", offsetMinutos: 45, ativo: true }];

    const r = await salvarReguaComercial(payload({ estado: "DESLIGADA", degraus }));
    expect(r.ok).toBe(false);
    expect((r as { erro: string }).erro).toContain("uma única vez");
    expect(await prisma.politicaComercial.count()).toBe(0);
  });

  it("cadência com passo faltando é recusada (a UI não pode 'sumir' com um degrau)", async () => {
    await gerenteAutenticado();
    const degraus = cadenciaFabrica().filter((d) => d.passo !== "+24h");

    const r = await salvarReguaComercial(payload({ estado: "DESLIGADA", degraus }));
    expect(r.ok).toBe(false);
    expect((r as { erro: string }).erro).toContain("+24h");
    expect(await prisma.politicaComercial.count()).toBe(0);
  });

  it("passo fora da cadência canônica é recusado", async () => {
    await gerenteAutenticado();
    const degraus = [...cadenciaFabrica(), { passo: "+15d", offsetMinutos: 21600, ativo: true }];

    const r = await salvarReguaComercial(payload({ estado: "DESLIGADA", degraus }));
    expect(r.ok).toBe(false);
    expect((r as { erro: string }).erro).toContain("+15d");
  });
});

// A pré-experimental (C2) é o caso limite da mesma lei: os offsets são NEGATIVOS (minutos
// ANTES da aula). "Estritamente crescente na ordem de fábrica" continua valendo — -1440 vem
// antes de -120 —, e é justamente o que impede alguém de gravar o lembrete de 2h antes do de
// 24h e apagar o degrau mais importante da régua (o que ataca o no-show).
//
// O piso do Zod era 0, herdado da C1 (só offsets positivos): NENHUMA cadência negativa
// atravessava a validação, e a régua pré-experimental que a C2 entrega de fábrica era
// inatingível pela UI. O piso agora é simétrico (±30 dias), no schema e no painel.
describe("salvarReguaComercial × cadência de offsets NEGATIVOS (pré-experimental)", () => {
  function cadenciaPreExperimental(): ReguaComercialInput["degraus"] {
    return CADENCIA_PRE_EXPERIMENTAL.map((d) => ({ passo: d.passo, offsetMinutos: d.offsetMinutos, ativo: true }));
  }

  it("offsets de fábrica (-1440 então -120) são aceitos e materializam os 2 degraus", async () => {
    await gerenteAutenticado();
    const numero = await seedRemetente("BAILEYS");

    const r = await salvarReguaComercial(
      payload({ chave: CHAVE_PRE_EXPERIMENTAL, numeroRemetenteId: numero.id, degraus: cadenciaPreExperimental() }),
    );
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);

    const politica = await carregarPoliticaComercial(CHAVE_PRE_EXPERIMENTAL);
    expect(politica.degraus.map((d) => d.passo)).toEqual(["-24h", "-2h"]);
    expect(politica.degraus.map((d) => d.offsetMinutos)).toEqual([-1440, -120]);
    expect(politica.ordem).toEqual(["-24h", "-2h"]);
  });

  it("offsets invertidos (-2h antes do -24h) são recusados", async () => {
    await gerenteAutenticado();
    const degraus = cadenciaPreExperimental().map((d) =>
      d.passo === "-24h" ? { ...d, offsetMinutos: -60 } : d, // -60 > -120: fura a ordem
    );

    const r = await salvarReguaComercial(payload({ chave: CHAVE_PRE_EXPERIMENTAL, estado: "DESLIGADA", degraus }));
    expect(r.ok).toBe(false);
    expect((r as { erro: string }).erro).toContain("-2h");
    expect(await prisma.politicaComercial.count()).toBe(0);
  });
});

describe("salvarReguaComercial × template aprovado no remetente OFICIAL", () => {
  it("META_CLOUD sem template nos degraus ativos: armar em SHADOW é recusado", async () => {
    await gerenteAutenticado();
    const numero = await seedRemetente("META_CLOUD");

    const r = await salvarReguaComercial(payload({ estado: "SHADOW", numeroRemetenteId: numero.id }));
    expect(r.ok).toBe(false);
    expect((r as { erro: string }).erro).toContain("aprovado na Meta");
    expect(await prisma.politicaComercial.count()).toBe(0);
  });

  it("META_CLOUD com templates ainda EM_REVISAO: armar em ATIVA é recusado", async () => {
    await gerenteAutenticado();
    const numero = await seedRemetente("META_CLOUD");
    const templates = await seedTemplates("EM_REVISAO");
    const degraus = cadenciaFabrica().map((d) => ({ ...d, templateId: templates.get(d.passo) }));

    const r = await salvarReguaComercial(payload({ estado: "ATIVA", numeroRemetenteId: numero.id, degraus }));
    expect(r.ok).toBe(false);
    expect((r as { erro: string }).erro).toContain("aprovado na Meta");
    expect(await prisma.politicaComercial.count()).toBe(0);
  });

  it("contra-prova: com todos os templates APROVADOS, a régua arma no oficial", async () => {
    await gerenteAutenticado();
    const numero = await seedRemetente("META_CLOUD");
    const templates = await seedTemplates("APROVADO");
    const degraus = cadenciaFabrica().map((d) => ({ ...d, templateId: templates.get(d.passo) }));

    const r = await salvarReguaComercial(payload({ estado: "ATIVA", numeroRemetenteId: numero.id, degraus }));
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    expect((await prisma.politicaComercial.findUniqueOrThrow({ where: { chave: CHAVE_LEAD_NOVO } })).estado).toBe("ATIVA");
  });

  it("degrau INATIVO sem template não trava o oficial (a exigência é só dos ativos)", async () => {
    await gerenteAutenticado();
    const numero = await seedRemetente("META_CLOUD");
    const templates = await seedTemplates("APROVADO");
    const degraus = cadenciaFabrica().map((d) =>
      d.passo === "+7d" ? { ...d, ativo: false } : { ...d, templateId: templates.get(d.passo) },
    );

    const r = await salvarReguaComercial(payload({ estado: "ATIVA", numeroRemetenteId: numero.id, degraus }));
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    // O degrau desligado sai da política CARREGADA (o motor não o enxerga), mas continua gravado.
    const politica = await carregarPoliticaComercial();
    expect(politica.degraus.map((d) => d.passo)).not.toContain("+7d");
  });

  it("no BAILEYS a mesma cadência sem template nenhum arma (texto livre — Camada 2 não vale)", async () => {
    await gerenteAutenticado();
    const numero = await seedRemetente("BAILEYS");

    const r = await salvarReguaComercial(payload({ estado: "ATIVA", numeroRemetenteId: numero.id }));
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
  });
});
