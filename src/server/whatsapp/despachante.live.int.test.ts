import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Papel, type StatusTemplate } from "@prisma/client";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/uploads";

// Driver do motor FALSO: este arquivo liga WHATSAPP_LIVE=1 para exercitar o caminho "real" do
// despachante — nenhuma mensagem pode sair. Desde a Fase 4 (Tarefa 5) só o motor envia; números
// legados (META_CLOUD/BAILEYS) falham com driver_indisponivel sem qualquer I/O.
const { enviarTextoMock, enviarTemplateMock, enviarMidiaMock } = vi.hoisted(() => ({
  enviarTextoMock: vi.fn().mockResolvedValue({ providerMessageId: "3EB0-texto", mensagemIdMotor: "c:texto" }),
  enviarTemplateMock: vi.fn().mockResolvedValue({ providerMessageId: "3EB0-template", mensagemIdMotor: "c:template" }),
  enviarMidiaMock: vi.fn().mockResolvedValue({ providerMessageId: "3EB0-midia", mensagemIdMotor: "c:midia" }),
}));
vi.mock("./drivers/motor", () => ({
  driverMotor: { enviarTexto: enviarTextoMock, enviarTemplate: enviarTemplateMock, enviarMidia: enviarMidiaMock },
}));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { despacharFila } from "./despachante";
import { garantirAtendimento } from "./atendimentos";

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
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone } });
  const numero = await prisma.numeroWhatsApp.findFirstOrThrow();
  const autor = await criarUsuario([Papel.ADMINISTRADOR]);
  const atendimento = await prisma.$transaction((tx) => garantirAtendimento(tx, {
    numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id,
  }));
  return { ...contato, atendimentoId: atendimento.id, autorId: autor.id, conversaId: atendimento.conversaId };
}

describe("shadow por política × WHATSAPP_LIVE=1 (P1-3)", () => {
  it("política SHADOW: LOTE vira SIMULADA — o driver NUNCA é chamado no ensaio", async () => {
    const { numero, politica, templates } = await seedCanal({ estado: "SHADOW", janela: [0, 24] });
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id, atendimentoId: contato.atendimentoId,
        origem: "LOTE", autorId: contato.autorId,
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
        contatoId: contato.id, atendimentoId: contato.atendimentoId,
        origem: "LOTE", autorId: contato.autorId,
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
    const humano = await criarUsuario([Papel.ADMINISTRADOR]);
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id, atendimentoId: contato.atendimentoId,
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

describe("reativa sem IA × WHATSAPP_LIVE=1 (saudação do CRM antigo)", () => {
  // A saudação reativa perdeu a configuração e o produtor com a remoção do CRM antigo: o que sobrar na fila só simula.
  it("SIMULADA mesmo com live — o driver NÃO é chamado", async () => {
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511988880000", rotulo: "Vendas", driver: "MOTOR", finalidade: "VENDAS", providerRef: "n-vendas" },
    });
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, atendimentoId: contato.atendimentoId, origem: "CRON", reativa: true, corpoRenderizado: "Oi!" },
    });
    const r = await despacharFila();
    expect(r.simuladas).toBe(1);
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("SIMULADA");
  });
});

describe("automação CRON pela política × WHATSAPP_LIVE=1 (D38 — automação no motor)", () => {
  async function seedAutomacao(estado: "SHADOW" | "ATIVA", over: { template?: StatusTemplate | null } = {}) {
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511977776666", rotulo: "Vendas", driver: "MOTOR", finalidade: "VENDAS", providerRef: "n-automacao" },
    });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50611113333" } });
    const politica = await prisma.politicaRegua.create({
      data: { nome: "Automação de teste", estado, janelaInicio: 0, janelaFim: 24, diasSemana: [0, 1, 2, 3, 4, 5, 6], numeroRemetenteId: numero.id },
    });
    const template = over.template
      ? await prisma.templateWhatsApp.create({ data: { nome: "aviso_teste", corpo: "Oi {{1}}!", statusMeta: over.template } })
      : null;
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", politicaId: politica.id, corpoRenderizado: "Oi Ana!", templateId: template?.id ?? null, variaveis: ["Ana"] },
    });
  }

  it("ATIVA: a automação ENVIA pelo motor (trava S1 NÃO cancela)", async () => {
    await seedAutomacao("ATIVA");
    const r = await despacharFila();
    expect(r.despachadas).toBe(1);
    expect(r.canceladas).toBe(0);
    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("DESPACHADA");
  });

  it("SHADOW: mesmo com live, a automação SIMULA (ensaio da política)", async () => {
    await seedAutomacao("SHADOW");
    const r = await despacharFila();
    expect(r.simuladas).toBe(1);
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("SIMULADA");
  });

  it("MOTOR com template: sai por enviarTemplate (texto renderizado), sem exigir aprovação Meta", async () => {
    await seedAutomacao("ATIVA", { template: "EM_REVISAO" });
    const r = await despacharFila();
    expect(r.despachadas).toBe(1);
    expect(r.falhas).toBe(0);
    expect(enviarTemplateMock).toHaveBeenCalledTimes(1);
    expect(enviarTemplateMock.mock.calls[0][2]).toMatchObject({ nome: "aviso_teste", corpoRenderizado: "Oi Ana!" });
    expect((await prisma.intencaoMensagem.findFirstOrThrow()).status).toBe("DESPACHADA");
  });
});

describe("mídia no despacho (P1-2 — defesa em profundidade)", () => {
  it("midiaPath fora de whatsapp-out/ FALHA sem tocar o driver (exfiltração barrada)", async () => {
    const { numero } = await seedCanal({ estado: "ATIVA", janela: [0, 24] });
    const humano = await criarUsuario([Papel.ADMINISTRADOR]);
    const contato = await seedContato();
    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id, atendimentoId: contato.atendimentoId,
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
    const humano = await criarUsuario([Papel.ADMINISTRADOR]);
    const contato = await seedContato();

    const dir = path.join(UPLOAD_DIR, "whatsapp-out", humano.id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "foto.jpg"), Buffer.from("jpg-de-teste"));
    try {
      await prisma.intencaoMensagem.create({
        data: {
          numeroId: numero.id,
          contatoId: contato.id, atendimentoId: contato.atendimentoId,
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
