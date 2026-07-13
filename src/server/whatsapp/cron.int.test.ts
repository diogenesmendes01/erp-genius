import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco, eventosDo } from "@/test/integracao";
import { agoraAs, diasDepois, seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { rodarCronRegua } from "./cron";
import { despacharFila } from "./despachante";
import { processarMensagemNormalizada } from "./inbound";

// Integração E1 (doc 30): cron reusa o cérebro, grava INTENÇÕES na outbox e o despachante
// aplica os guard-rails. Sem WHATSAPP_LIVE=1 tudo vira SIMULADA — nenhum driver é chamado
// (segurança de ambiente, gap A5). Fuso dos testes = fuso da máquina (helpers compartilhados).

beforeEach(async () => {
  await truncarBanco();
});

describe("cron da régua — enfileira e o despachante simula (shadow)", () => {
  it("D-7 devido → intenção SIMULADA com corpo renderizado; NENHUM evento/mensagem real", async () => {
    const agora = agoraAs(10);
    await seedCanal({ estado: "SHADOW" });
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7) });

    const r = await rodarCronRegua(agora);
    expect(r.executou).toBe(true);
    expect(r.acoesDevidas).toBe(1);
    expect(r.enfileiradas).toBe(1);
    expect(r.despacho?.simuladas).toBe(1);
    expect(r.despacho?.despachadas).toBe(0);

    const intencao = await prisma.intencaoMensagem.findUnique({
      where: { cobrancaId_passo: { cobrancaId: cobranca.id, passo: "D-7" } },
    });
    expect(intencao?.status).toBe("SIMULADA");
    expect(intencao?.corpoRenderizado).toContain("Maria");
    expect(intencao?.corpoRenderizado).not.toMatch(/\{(nome|valor|vencimento)\}/);

    // Shadow NÃO cumpre degrau: sem evento de domínio, sem mensagem no log.
    expect(await eventosDo("Cobranca", cobranca.id)).toHaveLength(0);
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);
  });

  it("idempotência: segunda rodada não duplica a intenção (SIMULADA reabre a MESMA linha)", async () => {
    const agora = agoraAs(10);
    await seedCanal();
    await seedCobranca({ vencimento: diasDepois(agora, 7) });

    await rodarCronRegua(agora);
    const r2 = await rodarCronRegua(agora);
    expect(r2.enfileiradas).toBe(0);
    // SIMULADA não é terminal (review PR #49): o ensaio reabre e re-simula a mesma
    // intenção — ao sair do shadow, o envio real acontece. Nunca nasce uma 2ª linha.
    expect(r2.reabertas).toBe(1);
    expect(await prisma.intencaoMensagem.count()).toBe(1);
    expect((await prisma.intencaoMensagem.findFirst())?.status).toBe("SIMULADA");
  });

  it("destino S2: responsável FINANCEIRO com telefone vence o telefone do aluno (Kids nunca o aluno)", async () => {
    const agora = agoraAs(10);
    await seedCanal();
    await seedCobranca({
      vencimento: diasDepois(agora, 7),
      telefoneAluno: "+50600000001",
      responsavelTelefone: "+50600000002",
    });

    await rodarCronRegua(agora);
    const contato = await prisma.contatoWhatsApp.findFirst();
    expect(contato?.telefoneE164).toBe("+50600000002");
    expect(contato?.responsavelId).not.toBeNull();
  });

  it("sem destino (S2): sem telefone algum → intenção não nasce, contabiliza semDestino", async () => {
    const agora = agoraAs(10);
    await seedCanal();
    await seedCobranca({ vencimento: diasDepois(agora, 7), telefoneAluno: null });

    const r = await rodarCronRegua(agora);
    expect(r.semDestino).toBe(1);
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("degrau cumprido MANUALMENTE ontem não é re-enviado pelo cron (mesmo evento, mesma projeção)", async () => {
    const agora = agoraAs(10);
    await seedCanal();
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7) });
    await prisma.evento.create({
      data: {
        tipo: "CobrancaEnviadaWhatsApp",
        agregadoTipo: "Cobranca",
        agregadoId: cobranca.id,
        payload: { modelo: "amigavel", passo: "D-7", canal: "manual" },
        versao: 2,
      },
    });

    const r = await rodarCronRegua(agora);
    expect(r.acoesDevidas).toBe(0); // D-7 feito, D-3 ainda não chegou → futuro
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("TRAVA S1 (lei): número remetente Baileys → cron não roda", async () => {
    const agora = agoraAs(10);
    await seedCanal({ driver: "BAILEYS" });
    await seedCobranca({ vencimento: diasDepois(agora, 7) });

    const r = await rodarCronRegua(agora);
    expect(r.executou).toBe(false);
    expect(r.motivoParada).toBe("trava_driver_oficial");
    expect(await prisma.intencaoMensagem.count()).toBe(0);
  });

  it("política DESLIGADA (nascimento de fábrica) → nada acontece", async () => {
    const agora = agoraAs(10);
    await seedCanal({ estado: "DESLIGADA" });
    await seedCobranca({ vencimento: diasDepois(agora, 7) });

    const r = await rodarCronRegua(agora);
    expect(r.executou).toBe(false);
    expect(r.motivoParada).toBe("politica_desligada");
  });
});

describe("despachante — guard-rails", () => {
  it("LEI DO DESPACHANTE: inbound do contato cancela intenção automática ainda na fila", async () => {
    const agora = agoraAs(23); // fora da janela [9,20] → a intenção fica ADIADA na fila
    const { numero } = await seedCanal({ janela: [9, 20] });
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7) });

    await rodarCronRegua(agora);
    const antes = await prisma.intencaoMensagem.findFirst();
    expect(antes?.status).toBe("ADIADA");

    // Responsável responde no número da escola → lei cancela no ingresso.
    const resultado = await processarMensagemNormalizada({
      numeroProviderRef: numero.providerRef,
      contatoWaId: "50688887777",
      providerMessageId: "wamid.teste.1",
      corpo: "posso pagar sexta?",
      tipo: "TEXTO",
      driver: "META_CLOUD",
      fromMe: false,
      quando: new Date(agora.getTime() + 60_000),
    });
    expect(resultado).toBe("gravada");

    const depois = await prisma.intencaoMensagem.findUnique({
      where: { cobrancaId_passo: { cobrancaId: cobranca.id, passo: "D-7" } },
    });
    expect(depois?.status).toBe("CANCELADA");
    expect(depois?.motivoFalha).toBe("conversa_viva");
  });

  it("claim ENVIANDO: em voo não é tocado; órfão (stale) vira FALHOU envio_interrompido", async () => {
    const agora = agoraAs(10);
    await seedCanal();
    await seedCobranca({ vencimento: diasDepois(agora, 7) });
    await rodarCronRegua(agora); // cria a intenção (SIMULADA no ensaio)

    // Claim de outro worker, DENTRO do prazo → despachante não toca (nem re-simula).
    await prisma.intencaoMensagem.updateMany({
      data: { status: "ENVIANDO", despacharAposEm: new Date(agora.getTime() + 600_000) },
    });
    await despacharFila(agora);
    expect((await prisma.intencaoMensagem.findFirst())?.status).toBe("ENVIANDO");

    // Claim órfão (prazo vencido = worker morreu no meio) → FALHOU com motivo, fila humana.
    await prisma.intencaoMensagem.updateMany({
      data: { despacharAposEm: new Date(agora.getTime() - 60_000) },
    });
    await despacharFila(agora);
    const it2 = await prisma.intencaoMensagem.findFirst();
    expect(it2?.status).toBe("FALHOU");
    expect(it2?.motivoFalha).toBe("envio_interrompido");
  });

  it("retry de webhook não duplica mensagem (dedupe por providerMessageId)", async () => {
    const { numero } = await seedCanal();
    const m = {
      numeroProviderRef: numero.providerRef,
      contatoWaId: "50688887777",
      providerMessageId: "wamid.dup",
      corpo: "oi",
      tipo: "TEXTO" as const,
      driver: "META_CLOUD" as const,
      fromMe: false,
      quando: new Date(),
    };
    expect(await processarMensagemNormalizada(m)).toBe("gravada");
    expect(await processarMensagemNormalizada(m)).toBe("duplicada");
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);
  });

  it("opt-out (lei) cancela; fora da janela adia", async () => {
    const agora = agoraAs(23); // 23h no fuso da máquina
    await seedCanal({ janela: [9, 20] });
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7) });

    // 1ª rodada: fora da janela → ADIADA (mesmo em shadow, o ensaio respeita a janela).
    const r1 = await rodarCronRegua(agora);
    expect(r1.despacho?.adiadas).toBe(1);
    const adiada = await prisma.intencaoMensagem.findUnique({
      where: { cobrancaId_passo: { cobrancaId: cobranca.id, passo: "D-7" } },
    });
    expect(adiada?.status).toBe("ADIADA");
    expect(adiada?.motivoFalha).toBe("fora_da_janela");

    // Contato faz opt-out → no horário certo, a intenção adiada é CANCELADA (lei vence).
    await prisma.contatoWhatsApp.updateMany({ data: { optOutEm: new Date() } });
    const dali2h = new Date(agora.getTime() + 2 * 3600_000);
    const r2 = await despacharFila(dali2h > (adiada?.despacharAposEm ?? dali2h) ? dali2h : new Date((adiada?.despacharAposEm ?? dali2h).getTime() + 1000));
    expect(r2.canceladas).toBe(1);
    const cancelada = await prisma.intencaoMensagem.findFirst();
    expect(cancelada?.status).toBe("CANCELADA");
    expect(cancelada?.motivoFalha).toBe("opt_out");
  });
});
