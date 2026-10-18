import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock, acao } = vi.hoisted(() => ({ authMock: vi.fn(), acao: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./acoes", () => ({ executarAcaoMotor: acao }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "../atendimentos";
import { apagarMensagemWhatsApp, avisarDigitando, editarMensagemWhatsApp, encaminharMensagemWhatsApp, enviarConteudoInbox, reagirMensagemWhatsApp } from "./acoes-mensagem";
import { MSG_MOTOR_DESCONECTADO } from "./capacidades";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); acao.mockReset(); acao.mockResolvedValue({}); });
const comoUsuario = async <T,>(u: { id: string }, f: () => Promise<T>) => { authMock.mockResolvedValue({ user: { id: u.id } }); return f(); };

async function cenario(over: { criadoEm?: Date; direcao?: "SAIDA" | "ENTRADA"; autorOutro?: boolean } = {}) {
  const autor = await criarUsuario([Papel.VENDEDOR], "Autor");
  const outro = await criarUsuario([Papel.ADMINISTRADOR], "Outro");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], finalidade: "COBRANCA", donoId: (await criarUsuario([Papel.FINANCEIRO], "Dono")).id });
  await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { driver: "MOTOR", sessao: "CONECTADO", providerRef: numero.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
  const m = await prisma.mensagemWhatsApp.create({
    data: {
      numeroId: numero.id, conversaId: at.conversaId, atendimentoId: at.id, direcao: over.direcao ?? "SAIDA", driver: "MOTOR",
      corpo: "oi", origem: "HUMANO", autorId: autor.id, mensagemIdMotor: "c:3EB0X", criadoEm: over.criadoEm ?? new Date(),
    },
  });
  return { autor, outro, numero, at, m };
}
const evento = (tipo: string) => prisma.evento.findFirst({ where: { tipo } });

describe("editar e apagar pelo motor", () => {
  it("editar a própria mensagem chama message.edit com mensagemIdMotor e grava Evento", async () => {
    const { autor, m, numero } = await cenario();
    const r = await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "corrigido" }));
    expect(r.ok).toBe(true);
    expect(acao).toHaveBeenCalledWith(numero.id, "message.edit", { messageId: "c:3EB0X", text: "corrigido" }, { origem: "HUMANO" });
    expect(await evento("MensagemWhatsAppEditada")).toMatchObject({ payload: { antes: "oi", depois: "corrigido" } });
    const d = await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } });
    expect(d.corpo).toBe("corrigido");
    expect(d.editadaEm).not.toBeNull();
  });
  it("editar mensagem de outro atendente é recusado", async () => {
    const { outro, m } = await cenario();
    const r = await comoUsuario(outro, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "x" }));
    expect(r).toEqual({ ok: false, erro: "Só é possível editar as próprias mensagens." });
    expect(acao).not.toHaveBeenCalled();
  });
  it("editar após 15 min é recusado", async () => {
    const { autor, m } = await cenario({ criadoEm: new Date(Date.now() - 16 * 60_000) });
    const r = await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "x" }));
    expect(r).toEqual({ ok: false, erro: "Só é possível editar até 15 minutos após o envio." });
    expect(acao).not.toHaveBeenCalled();
  });
  it("apagar a própria mensagem chama message.delete forEveryone e marca apagadaEm", async () => {
    const { autor, m, numero } = await cenario();
    const r = await comoUsuario(autor, () => apagarMensagemWhatsApp({ mensagemId: m.id }));
    expect(r.ok).toBe(true);
    expect(acao).toHaveBeenCalledWith(numero.id, "message.delete", { messageId: "c:3EB0X", forEveryone: true }, { origem: "HUMANO" });
    expect((await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } })).apagadaEm).not.toBeNull();
    expect(await evento("MensagemWhatsAppApagada")).not.toBeNull();
  });
  it("apagar mensagem de outro atendente é recusado", async () => {
    const { outro, m } = await cenario();
    const r = await comoUsuario(outro, () => apagarMensagemWhatsApp({ mensagemId: m.id }));
    expect(r.ok).toBe(false);
    expect(acao).not.toHaveBeenCalled();
  });
  it("fora do escopo de envio do atendimento → recusado sem chamar o motor", async () => {
    const { m } = await cenario();
    const estranho = await criarUsuario([Papel.PROFESSOR], "Estranho");
    const r = await comoUsuario(estranho, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "x" }));
    expect(r.ok).toBe(false);
    expect(acao).not.toHaveBeenCalled();
  });
});

describe("reagir e encaminhar pelo motor", () => {
  async function destino(numeroId: string, autorId: string, telefone: string, optOut = false) {
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone, ...(optOut ? { optOutEm: new Date() } : {}) } });
    return prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autorId }));
  }
  it("reagir grava reação do usuário", async () => {
    const { autor, m, numero } = await cenario();
    expect((await comoUsuario(autor, () => reagirMensagemWhatsApp({ mensagemId: m.id, emoji: "👍" }))).ok).toBe(true);
    expect(acao).toHaveBeenCalledWith(numero.id, "message.react", { messageId: "c:3EB0X", emoji: "👍" }, { origem: "HUMANO" });
    expect(await prisma.reacaoMensagemWhatsApp.findFirstOrThrow()).toMatchObject({ emoji: "👍", usuarioId: autor.id, deMim: true });
    await comoUsuario(autor, () => reagirMensagemWhatsApp({ mensagemId: m.id, emoji: "❤️" }));
    expect(await prisma.reacaoMensagemWhatsApp.count()).toBe(1);
    await comoUsuario(autor, () => reagirMensagemWhatsApp({ mensagemId: m.id, emoji: "" }));
    expect(await prisma.reacaoMensagemWhatsApp.count()).toBe(0);
  });
  it("reagir com emoji acima de 32 caracteres ou fora do escopo é recusado", async () => {
    const { autor, m } = await cenario();
    expect((await comoUsuario(autor, () => reagirMensagemWhatsApp({ mensagemId: m.id, emoji: "x".repeat(33) }))).ok).toBe(false);
    const estranho = await criarUsuario([Papel.PROFESSOR], "Estranho");
    expect((await comoUsuario(estranho, () => reagirMensagemWhatsApp({ mensagemId: m.id, emoji: "👍" }))).ok).toBe(false);
    expect(acao).not.toHaveBeenCalled();
  });
  it("encaminhar grava a mensagem HUMANO no destino e o Evento", async () => {
    const { autor, m, numero } = await cenario();
    const dest = await destino(numero.id, autor.id, "+50688880002");
    acao.mockResolvedValue({ key: { id: "FWD0", remoteJid: "50688880002@s.whatsapp.net" } });
    const r = await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }));
    expect(r.ok).toBe(true);
    expect(acao).toHaveBeenCalledWith(numero.id, "message.forward", { messageId: "c:3EB0X", chatId: "50688880002@s.whatsapp.net" }, { origem: "HUMANO" });
    expect(await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "FWD0" } })).toMatchObject({ origem: "HUMANO", autorId: autor.id, atendimentoId: dest.id, corpo: "oi", direcao: "SAIDA" });
    expect(await evento("MensagemWhatsAppEncaminhada")).not.toBeNull();
  });
  it("encaminhar para atendimento fora do escopo é recusado", async () => {
    const { autor, m, numero } = await cenario();
    const dest = await destino(numero.id, autor.id, "+50688880002");
    const estranho = await criarUsuario([Papel.PROFESSOR], "Estranho");
    const r = await comoUsuario(estranho, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }));
    expect(r.ok).toBe(false);
    expect(acao).not.toHaveBeenCalled();
  });
  it("encaminhar para contato com opt-out é recusado", async () => {
    const { autor, m, numero } = await cenario();
    const dest = await destino(numero.id, autor.id, "+50688880002", true);
    const r = await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }));
    expect(r.ok).toBe(false);
    expect(acao).not.toHaveBeenCalled();
  });
  it("encaminhar para outro número → ErroRegra 'Encaminhe só entre conversas do mesmo número.'", async () => {
    const { autor, m } = await cenario();
    const outroNumero = await criarNumeroSetor({ telefoneE164: "+5511999990002", setores: ["COMERCIAL"], finalidade: "COBRANCA", donoId: (await criarUsuario([Papel.FINANCEIRO], "Dono2")).id });
    await prisma.numeroWhatsApp.update({ where: { id: outroNumero.id }, data: { driver: "MOTOR", sessao: "CONECTADO", providerRef: outroNumero.id } });
    const dest = await destino(outroNumero.id, autor.id, "+50688880003");
    const r = await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }));
    expect(r).toEqual({ ok: false, erro: "Encaminhe só entre conversas do mesmo número." });
    expect(acao).not.toHaveBeenCalled();
  });
  it("encaminhar: o servidor revalida o envio no destino — convidado só com leitura é recusado sem chamar o motor", async () => {
    const { autor, m, numero } = await cenario();
    const dest = await destino(numero.id, autor.id, "+50688880002");
    const fin = await criarUsuario([Papel.FINANCEIRO], "Fin");
    const convite = (atendimentoId: string, podeEnviar: boolean) => prisma.participanteAtendimentoWhatsApp.create({ data: {
      atendimentoId, usuarioId: fin.id, concedenteId: autor.id, podeEnviar, motivo: "teste",
      inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3600_000) } });
    await convite(m.atendimentoId!, true);
    await convite(dest.id, false);
    const r = await comoUsuario(fin, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }));
    expect(r).toEqual({ ok: false, erro: "Destino fora do seu escopo." });
    expect(acao).not.toHaveBeenCalled();
    await prisma.participanteAtendimentoWhatsApp.updateMany({ where: { atendimentoId: dest.id }, data: { podeEnviar: true } });
    acao.mockResolvedValue({ key: { id: "FWD1", remoteJid: "50688880002@s.whatsapp.net" } });
    expect((await comoUsuario(fin, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }))).ok).toBe(true);
  });
  it("encaminhar para atendimento encerrado é recusado", async () => {
    const { autor, m, numero } = await cenario();
    const dest = await destino(numero.id, autor.id, "+50688880002");
    await prisma.atendimentoWhatsApp.update({ where: { id: dest.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    const r = await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }));
    expect(r).toEqual({ ok: false, erro: "Destino fora do seu escopo." });
    expect(acao).not.toHaveBeenCalled();
  });
  it("encaminhar com a sessão do motor caída ou mensagem apagada é recusado sem chamar o motor", async () => {
    const { autor, m, numero } = await cenario();
    const dest = await destino(numero.id, autor.id, "+50688880002");
    await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { sessao: "DESCONECTADO" } });
    expect(await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }))).toEqual({ ok: false, erro: MSG_MOTOR_DESCONECTADO });
    await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { sessao: "CONECTADO" } });
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { apagadaEm: new Date() } });
    expect(await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }))).toEqual({ ok: false, erro: "Esta mensagem já foi apagada." });
    expect(acao).not.toHaveBeenCalled();
  });
  it("eco celular do encaminhamento antes da resposta é corrigido para HUMANO", async () => {
    const { autor, m, numero } = await cenario();
    const dest = await destino(numero.id, autor.id, "+50688880002");
    const { processarMensagemEnviada } = await import("./processar-mensagem");
    const eco = await processarMensagemEnviada({
      idEvento: "11111111-1111-4111-8111-111111111111", tipo: "mensagem.enviada", numeroId: numero.id, ocorridoEm: Date.now(),
      dados: { mensagemId: "50688880002@s.whatsapp.net:FWD1", providerMessageId: "FWD1", chatJid: "50688880002@s.whatsapp.net", tipo: "TEXTO", texto: "oi", quando: Date.now(), ehGrupo: false, origem: "celular", contato: { telefoneE164: "+50688880002" } },
    });
    expect(eco).toBe("ok");
    acao.mockResolvedValue({ key: { id: "FWD1", remoteJid: "50688880002@s.whatsapp.net" } });
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: dest.id }))).ok).toBe(true);
    expect(await prisma.mensagemWhatsApp.findFirstOrThrow({ where: { providerMessageId: "FWD1" } })).toMatchObject({ origem: "HUMANO", autorId: autor.id, atendimentoId: dest.id });
    expect(await prisma.mensagemWhatsApp.count({ where: { providerMessageId: "FWD1" } })).toBe(1);
  });
});

describe("trava de sessão do motor", () => {
  it.each(["CAIU", "DESCONECTADO"] as const)("sessão %s: editar, apagar, reagir, encaminhar, conteúdo e digitando recusam sem chamar o motor", async (sessao) => {
    const { autor, numero, at, m } = await cenario();
    await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { sessao } });
    const contato2 = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880002" } });
    const destino = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato2.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
    const recusa = { ok: false, erro: MSG_MOTOR_DESCONECTADO };
    await comoUsuario(autor, async () => {
      expect(await editarMensagemWhatsApp({ mensagemId: m.id, texto: "x" })).toEqual(recusa);
      expect(await apagarMensagemWhatsApp({ mensagemId: m.id })).toEqual(recusa);
      expect(await reagirMensagemWhatsApp({ mensagemId: m.id, emoji: "👍" })).toEqual(recusa);
      expect(await encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: destino.id })).toEqual(recusa);
      expect(await enviarConteudoInbox({ atendimentoId: at.id, conteudo: { tipo: "LOCALIZACAO", latitude: 1, longitude: 1 } })).toEqual(recusa);
      expect(await avisarDigitando(at.id)).toEqual(recusa);
    });
    expect(acao).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    expect(await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ corpo: "oi", apagadaEm: null });
  });
});
