import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { DriverWhatsApp, StatusTemplate } from "@prisma/client";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/uploads";

// Drivers FALSOS: este arquivo liga WHATSAPP_LIVE=1 para exercitar o caminho "real" do
// despachante (o que os outros int tests nunca fazem) — nenhuma mensagem pode sair.
const { enviarTextoMock, enviarTemplateMock, enviarMidiaMock } = vi.hoisted(() => ({
  enviarTextoMock: vi.fn().mockResolvedValue({ providerMessageId: "wamid-texto" }),
  enviarTemplateMock: vi.fn().mockResolvedValue({ providerMessageId: "wamid-template" }),
  enviarMidiaMock: vi.fn().mockResolvedValue({ providerMessageId: "wamid-midia" }),
}));
vi.mock("./drivers/meta-cloud", () => ({
  driverMetaCloud: { enviarTexto: enviarTextoMock, enviarTemplate: enviarTemplateMock, enviarMidia: enviarMidiaMock },
}));
vi.mock("./drivers/evolution", () => ({
  driverEvolution: { enviarTexto: enviarTextoMock, enviarTemplate: enviarTemplateMock, enviarMidia: enviarMidiaMock },
}));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { despacharFila } from "./despachante";

// Integração do SHADOW por política com o canal LIVE (review PR #51 P1-3): com
// WHATSAPP_LIVE=1, política em ensaio (SHADOW/DESLIGADA) precisa simular TODA automação —
// CRON e LOTE. Só origem HUMANO (resposta na inbox/fila) atravessa o ensaio.

beforeEach(async () => {
  await truncarBanco();
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarTextoMock.mockClear();
  enviarTemplateMock.mockClear();
  enviarMidiaMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function seedContato(telefone = "+50611112222") {
  return prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone } });
}

describe("shadow por política × WHATSAPP_LIVE=1 (P1-3)", () => {
  it("política SHADOW: LOTE vira SIMULADA — o driver NUNCA é chamado no ensaio", async () => {
    const { numero, politica, templates } = await seedCanal({ estado: "SHADOW", janela: [0, 24] });
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "LOTE",
        corpoRenderizado: "lote em ensaio",
        politicaId: politica.id,
        templateId: templates.get("amigavel"),
      },
    });

    const r = await despacharFila();
    expect(r.simuladas).toBe(1);
    expect(r.despachadas).toBe(0);
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect(enviarTemplateMock).not.toHaveBeenCalled();

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("SIMULADA");
  });

  it("política ATIVA: o MESMO lote envia de verdade (contra-prova)", async () => {
    const { numero, politica, templates } = await seedCanal({ estado: "ATIVA", janela: [0, 24] });
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "LOTE",
        corpoRenderizado: "lote aprovado",
        politicaId: politica.id,
        templateId: templates.get("amigavel"),
      },
    });

    const r = await despacharFila();
    expect(r.despachadas).toBe(1);
    expect(enviarTemplateMock).toHaveBeenCalledTimes(1);

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("DESPACHADA");
  });

  it("política SHADOW: origem HUMANO atravessa o ensaio (decisão humana envia)", async () => {
    const { numero } = await seedCanal({ estado: "SHADOW", janela: [0, 24] });
    const humano = await criarUsuario([]);
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "HUMANO",
        corpoRenderizado: "resposta humana",
        autorId: humano.id,
      },
    });

    const r = await despacharFila();
    expect(r.despachadas).toBe(1);
    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
  });
});

describe("shadow PRÓPRIO da saudação reativa × WHATSAPP_LIVE=1 (review PR #53 2ª passada)", () => {
  async function seedSaudacao(estado: "SHADOW" | "ATIVA") {
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511988880000", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "inst-x" },
    });
    const contato = await seedContato();
    await prisma.configComercial.create({ data: { id: "comercial", saudacaoEstado: estado, saudacaoTexto: "Oi!" } });
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", reativa: true, corpoRenderizado: "Oi!" },
    });
  }

  it("saudação em SHADOW: SIMULADA mesmo com live — o driver NÃO é chamado", async () => {
    await seedSaudacao("SHADOW");
    const r = await despacharFila();
    expect(r.simuladas).toBe(1);
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("SIMULADA");
  });

  it("saudação ATIVA: a MESMA reativa envia de verdade (contra-prova) — em Baileys, sem trava S1", async () => {
    await seedSaudacao("ATIVA");
    const r = await despacharFila();
    expect(r.despachadas).toBe(1);
    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("DESPACHADA");
  });
});

describe("cadência comercial × WHATSAPP_LIVE=1 (doc 27 — S1 liberada no Baileys)", () => {
  async function seedComercial(
    estado: "SHADOW" | "ATIVA",
    over: { driver?: DriverWhatsApp; template?: StatusTemplate | null } = {},
  ) {
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511977776666", rotulo: "Vendas", driver: over.driver ?? "BAILEYS", finalidade: "VENDAS", providerRef: "inst-c" },
    });
    const contato = await seedContato();
    const lead = await prisma.lead.create({ data: { codigo: "L-000123", nome: "Ana" } });
    const politica = await prisma.politicaComercial.create({
      // B1 (doc 32): comportamento geral — go-live explícito.
      data: { chave: "LEAD_NOVO_SEM_RESPOSTA", nome: "Lead novo", estado, modoPiloto: false, janelaInicio: 0, janelaFim: 24, diasSemana: [0, 1, 2, 3, 4, 5, 6], numeroRemetenteId: numero.id },
    });
    const template = over.template
      ? await prisma.templateWhatsApp.create({
          data: { nome: "lead_novo_30min", corpo: "Oi {{1}}!", statusMeta: over.template },
        })
      : null;
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", leadId: lead.id, passoComercial: "+30min", politicaComercialId: politica.id, corpoRenderizado: "Oi Ana!", templateId: template?.id ?? null, variaveis: ["Ana"] },
    });
  }

  it("ATIVA: a cadência ENVIA no Baileys (trava S1 NÃO cancela) — review doc 27", async () => {
    await seedComercial("ATIVA");
    const r = await despacharFila();
    expect(r.despachadas).toBe(1);
    expect(r.canceladas).toBe(0);
    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("DESPACHADA");
  });

  it("SHADOW: mesmo com live, a cadência SIMULA (ensaio próprio da política comercial)", async () => {
    await seedComercial("SHADOW");
    const r = await despacharFila();
    expect(r.simuladas).toBe(1);
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("SIMULADA");
  });

  // Camada 2 (doc 26 · review PR #55 P1): no número OFICIAL a cadência não é reativa —
  // +3d/+7d caem fora da janela de 24h. Sem template APROVADO, mandar texto livre é envio
  // indevido (ou erro da API); FALHAR aqui é o comportamento certo — a fila humana mostra
  // o motivo em vez de o degrau sumir em silêncio.
  it("META_CLOUD sem template APROVADO: a cadência FALHA sem tocar o driver", async () => {
    await seedComercial("ATIVA", { driver: "META_CLOUD", template: null });
    const r = await despacharFila();
    expect(r.falhas).toBe(1);
    expect(r.despachadas).toBe(0);
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect(enviarTemplateMock).not.toHaveBeenCalled();

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("FALHOU");
    expect(intencao.motivoFalha).toBe("template_nao_aprovado_meta");
  });

  it("META_CLOUD com template só EM_REVISAO também falha (aprovado é aprovado)", async () => {
    await seedComercial("ATIVA", { driver: "META_CLOUD", template: "EM_REVISAO" });
    const r = await despacharFila();
    expect(r.falhas).toBe(1);
    expect(enviarTemplateMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).motivoFalha).toBe("template_nao_aprovado_meta");
  });

  it("contra-prova: com template APROVADO, o MESMO degrau sai como template na Meta", async () => {
    await seedComercial("ATIVA", { driver: "META_CLOUD", template: "APROVADO" });
    const r = await despacharFila();
    expect(r.despachadas).toBe(1);
    expect(r.falhas).toBe(0);
    expect(enviarTemplateMock).toHaveBeenCalledTimes(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("DESPACHADA");
  });
});

describe("mídia no despacho (P1-2 — defesa em profundidade)", () => {
  it("midiaPath fora de whatsapp-out/ FALHA sem tocar o driver (exfiltração barrada)", async () => {
    const { numero } = await seedCanal({ estado: "ATIVA", janela: [0, 24] });
    const humano = await criarUsuario([]);
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "HUMANO",
        tipo: "IMAGEM",
        midiaPath: "/api/files/999-comprovante.jpg", // comprovante financeiro, não anexo da inbox
        corpoRenderizado: "",
        autorId: humano.id,
      },
    });

    const r = await despacharFila();
    expect(r.falhas).toBe(1);
    expect(enviarMidiaMock).not.toHaveBeenCalled();

    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("FALHOU");
    expect(intencao.motivoFalha).toBe("midia_fora_do_storage_de_envio");
  });

  it("midiaPath do próprio storage de envio é entregue ao driver", async () => {
    const { numero } = await seedCanal({ estado: "ATIVA", janela: [0, 24] });
    const humano = await criarUsuario([]);
    const contato = await seedContato();

    const dir = path.join(UPLOAD_DIR, "whatsapp-out", humano.id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "foto.jpg"), Buffer.from("jpg-de-teste"));
    try {
      await prisma.intencaoMensagem.create({
        data: {
          numeroId: numero.id,
          contatoId: contato.id,
          origem: "HUMANO",
          tipo: "IMAGEM",
          midiaPath: `/api/files/whatsapp-out/${humano.id}/foto.jpg`,
          corpoRenderizado: "legenda",
          autorId: humano.id,
        },
      });

      const r = await despacharFila();
      expect(r.despachadas).toBe(1);
      expect(enviarMidiaMock).toHaveBeenCalledTimes(1);
      const chamada = enviarMidiaMock.mock.calls[0][2] as { mime: string; dadosBase64: string };
      expect(chamada.mime).toBe("image/jpeg");
      expect(Buffer.from(chamada.dadosBase64, "base64").toString()).toBe("jpg-de-teste");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
