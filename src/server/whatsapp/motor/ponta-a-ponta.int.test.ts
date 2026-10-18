import { existsSync } from "node:fs";
import path from "node:path";
import { unlink } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// Ponta a ponta com o MOTOR SIMULADO em processo (src/test/motor-simulado.ts): nada de rede externa.
// O ERP fala HTTP de verdade com o simulado (cliente.ts + driver MOTOR reais) e recebe eventos
// assinados pela rota do webhook; só `after` e a sessão são neutralizados.
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => undefined }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && (await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } }));
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return {
    ...original,
    exigirSessao: sessao,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const u = await sessao();
      original.exigirPapel(u, ...papeis);
      return u;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR } from "@/lib/uploads";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { agoraAs, diasDepois, seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { iniciarMotorSimulado, type MotorSimulado } from "@/test/motor-simulado";
import { enviarTextoInbox } from "../acoes";
import { garantirAtendimento } from "../atendimentos";
import { rodarCronRegua } from "../cron";
import { despacharFila } from "../despachante";
import { drenarEventosMotor } from "./drenar";

let sim: MotorSimulado;
const arquivosCriados: string[] = [];

beforeAll(async () => {
  sim = await iniciarMotorSimulado();
});
afterAll(async () => {
  await sim.fechar();
  for (const f of arquivosCriados) await unlink(f).catch(() => undefined);
});

beforeEach(async () => {
  await truncarBanco();
  sim.recebidos.length = 0;
  sim.falharEnvio = null;
  vi.stubEnv("MOTOR_URL", sim.url);
  vi.stubEnv("MOTOR_API_KEY", "k".repeat(40));
  vi.stubEnv("MOTOR_WEBHOOK_SECRET", "s".repeat(40));
  vi.stubEnv("WHATSAPP_LIVE", "1");
});
afterEach(() => vi.unstubAllEnvs());

const TELEFONE = "+50688888888";

async function cenario() {
  const vendedor = await criarUsuario([Papel.VENDEDOR]);
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: TELEFONE, vendedorDonoId: vendedor.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: TELEFONE, leadId: lead.id } });
  const atendimento = await prisma.$transaction((tx) =>
    garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }),
  );
  authMock.mockResolvedValue({ user: { id: vendedor.id } });
  return { vendedor, numero, numeroId: numero.providerRef!, atendimento };
}

const rotaMensagens = (numeroId: string) => `/v1/numeros/${numeroId}/mensagens`;
const envios = (numeroId: string) => sim.recebidos.filter((r) => r.rota === rotaMensagens(numeroId));

function dadosEntrada(over: Record<string, unknown> = {}) {
  return {
    mensagemId: "c:in-1",
    providerMessageId: "IN-1",
    chatJid: "50688888888@s.whatsapp.net",
    ehGrupo: false,
    contato: { jid: "50688888888@s.whatsapp.net", telefoneE164: TELEFONE, nomePerfil: "Maria" },
    tipo: "TEXTO",
    texto: "oi",
    quando: Date.now(),
    ...over,
  };
}

describe("ponta a ponta com o motor simulado", () => {
  it("Inbox → motor → eco erp → status LIDA", async () => {
    const { atendimento, numeroId } = await cenario();
    expect((await enviarTextoInbox({ conversaId: atendimento.id, texto: "olá" })).ok).toBe(true);

    const envio = envios(numeroId)[0];
    const corpo = envio.corpo as { clientMessageId: string; texto: string };
    expect(envio.cabecalhos.authorization).toBe(`Bearer ${"k".repeat(40)}`);
    expect(envio.cabecalhos["x-origem"]).toBe("HUMANO");
    expect(corpo).toMatchObject({ tipo: "texto", texto: "olá", paraE164: TELEFONE });

    const eco = {
      mensagemId: "c:3EB01", providerMessageId: "3EB01", chatJid: "50688888888@s.whatsapp.net", ehGrupo: false,
      contato: { telefoneE164: TELEFONE }, tipo: "TEXTO", texto: "olá", quando: Date.now(),
      clientMessageId: corpo.clientMessageId, origem: "erp",
    };
    expect((await sim.emitir("mensagem.enviada", numeroId, eco)).status).toBe(200);
    expect((await sim.emitir("mensagem.status", numeroId, { providerMessageId: "3EB01", clientMessageId: corpo.clientMessageId, status: "LIDA" })).status).toBe(200);
    await drenarEventosMotor();

    const mensagens = await prisma.mensagemWhatsApp.findMany();
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]).toMatchObject({ origem: "HUMANO", direcao: "SAIDA", status: "LIDA", driver: "MOTOR", clientMessageId: corpo.clientMessageId, providerMessageId: "3EB01", mensagemIdMotor: "c:3EB01" });
    expect(await prisma.eventoMotorRecebido.count({ where: { processadoEm: null } })).toBe(0);
  });

  it("recebida com mídia → arquivo em whatsapp/ e mensagem ENTRADA", async () => {
    const { atendimento, numeroId } = await cenario();
    await sim.emitir("mensagem.recebida", numeroId, dadosEntrada({ tipo: "IMAGEM", texto: null, midia: { mime: "image/png", nome: "foto.png", tamanho: sim.midia.bytes.length } }));
    await drenarEventosMotor();

    expect(sim.recebidos.some((r) => r.rota === `/v1/numeros/${numeroId}/midia/c%3Ain-1`)).toBe(true);
    const m = await prisma.mensagemWhatsApp.findFirstOrThrow();
    expect(m).toMatchObject({ direcao: "ENTRADA", tipo: "IMAGEM", atendimentoId: atendimento.id });
    expect(m.midiaPath).toMatch(/^\/api\/files\/whatsapp\/[^/]+\.png$/);
    const arquivo = path.join(UPLOAD_DIR, ...m.midiaPath!.slice("/api/files/".length).split("/"));
    arquivosCriados.push(arquivo);
    expect(existsSync(arquivo)).toBe(true);
  });

  it("eco do celular → CELULAR e atendimento respondido", async () => {
    const { atendimento, numeroId } = await cenario();
    await sim.emitir("mensagem.enviada", numeroId, dadosEntrada({ providerMessageId: "CEL-1", mensagemId: "c:cel-1", texto: "resposta pelo celular", origem: "celular" }));
    await drenarEventosMotor();

    const m = await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "CEL-1" } });
    expect(m).toMatchObject({ direcao: "SAIDA", origem: "CELULAR", autorId: null, atendimentoId: atendimento.id });
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimento.id } })).primeiraRespostaEm).not.toBeNull();
  });

  it("reenvio do mesmo evento (mesmo idEvento) não duplica nada", async () => {
    const { numeroId } = await cenario();
    const idEvento = "7f0e6a52-6c0f-4a0b-9f4b-1d2f6c3a9b10";
    const dados = dadosEntrada({ providerMessageId: "IN-DUP", mensagemId: "c:in-dup" });
    expect((await sim.emitir("mensagem.recebida", numeroId, dados, { idEvento })).status).toBe(200);
    expect((await sim.emitir("mensagem.recebida", numeroId, dados, { idEvento })).status).toBe(200);
    await drenarEventosMotor();
    await drenarEventosMotor();

    expect(await prisma.eventoMotorRecebido.count()).toBe(1);
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);
  });

  it("motor responde NAO_ENVIADO numero_desconectado → ADIADA; volta → enviada uma vez", async () => {
    const { atendimento, numeroId } = await cenario();
    sim.falharEnvio = "NAO_ENVIADO";
    const r = await enviarTextoInbox({ conversaId: atendimento.id, texto: "tem alguém aí?" });
    expect(r.ok).toBe(true);
    let intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao).toMatchObject({ status: "ADIADA", motivoFalha: "motor_numero_desconectado" });
    expect(await prisma.mensagemWhatsApp.count()).toBe(0);

    sim.falharEnvio = null;
    await despacharFila(new Date(Date.now() + 61_000), { intencaoId: intencao.id });
    intencao = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id }, include: { mensagem: true } });
    expect(intencao.status).toBe("DESPACHADA");
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);

    const tentativas = envios(numeroId).map((e) => (e.corpo as { clientMessageId: string }).clientMessageId);
    expect(tentativas).toHaveLength(2);
    expect(new Set(tentativas).size).toBe(1);
    // reexecutar o despacho não envia de novo
    await despacharFila(new Date(Date.now() + 120_000), { intencaoId: intencao.id });
    expect(envios(numeroId)).toHaveLength(2);
  });

  it("régua de cobrança CRON em número MOTOR envia na janela e simula sem WHATSAPP_LIVE", async () => {
    const agora = agoraAs(10);
    const { numero } = await seedCanal({ estado: "ATIVA", janela: [0, 24] });
    const { cobranca } = await seedCobranca({ vencimento: diasDepois(agora, 7) });
    const ref = numero.providerRef!;

    // sem WHATSAPP_LIVE: tudo vira SIMULADA e nada chega ao motor
    vi.stubEnv("WHATSAPP_LIVE", "");
    const seco = await rodarCronRegua(agora);
    expect(seco.despacho).toMatchObject({ simuladas: 1, despachadas: 0 });
    expect(envios(ref)).toHaveLength(0);
    expect((await prisma.intencaoMensagem.findFirstOrThrow({ where: { cobrancaId: cobranca.id } })).status).toBe("SIMULADA");

    // com WHATSAPP_LIVE=1: a mesma intenção sai pelo motor, uma vez
    vi.stubEnv("WHATSAPP_LIVE", "1");
    const real = await rodarCronRegua(agora);
    expect(real.despacho).toMatchObject({ despachadas: 1 });
    const enviados = envios(ref);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].cabecalhos["x-origem"]).toBe("AUTOMACAO");
    expect(enviados[0].corpo).toMatchObject({ tipo: "texto", paraE164: "+50688887777" });
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow({ where: { cobrancaId: cobranca.id } });
    expect(intencao.status).toBe("DESPACHADA");
    expect(await prisma.mensagemWhatsApp.count()).toBe(1);
  });
});
