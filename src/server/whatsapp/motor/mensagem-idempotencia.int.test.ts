import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (6º lote): comandos do menu da mensagem que saem pelo motor.
// - Encaminhar recebe chave: o reenvio da mesma tentativa não encaminha de novo ao contato.
// - Editar com o mesmo texto e apagar a mensagem já apagada por quem repete devolvem ok sem chamar o motor
//   nem gravar outro Evento.

const { authMock, acao } = vi.hoisted(() => ({ authMock: vi.fn(), acao: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./acoes", () => ({ executarAcaoMotor: acao }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "../atendimentos";
import { apagarMensagemWhatsApp, editarMensagemWhatsApp, encaminharMensagemWhatsApp } from "./acoes-mensagem";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); acao.mockReset(); acao.mockResolvedValue({}); });
const comoUsuario = async <T,>(u: { id: string }, f: () => Promise<T>) => { authMock.mockResolvedValue({ user: { id: u.id } }); return f(); };
const contar = (tipo: string) => prisma.evento.count({ where: { tipo } });
const chamadas = (verbo: string) => acao.mock.calls.filter((c) => c[1] === verbo).length;

async function cenario() {
  const autor = await criarUsuario([Papel.VENDEDOR], "Autor");
  const outro = await criarUsuario([Papel.VENDEDOR], "Outro");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], finalidade: "COBRANCA", donoId: (await criarUsuario([Papel.FINANCEIRO], "Dono")).id });
  await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { driver: "MOTOR", sessao: "CONECTADO", providerRef: numero.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
  const m = await prisma.mensagemWhatsApp.create({
    data: { numeroId: numero.id, conversaId: at.conversaId, atendimentoId: at.id, direcao: "SAIDA", driver: "MOTOR", corpo: "oi", origem: "HUMANO", autorId: autor.id, mensagemIdMotor: "c:3EB0X" },
  });
  async function destino(telefone: string) {
    const c = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone } });
    return prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: c.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
  }
  return { autor, outro, numero, at, m, destino };
}

describe("encaminharMensagemWhatsApp com chave (#166)", () => {
  it("a mesma chave encaminha uma vez e devolve ok no reenvio", async () => {
    const { autor, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    acao.mockResolvedValue({ key: { id: "FWD1", remoteJid: "50688880002@s.whatsapp.net" } });
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-001" };
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect(chamadas("message.forward")).toBe(1);
    expect(await contar("MensagemWhatsAppEncaminhada")).toBe(1);
    expect(await prisma.mensagemWhatsApp.count({ where: { atendimentoId: dest.id } })).toBe(1);
  });

  it("o reenvio tardio devolve ok mesmo com a origem já apagada", async () => {
    const { autor, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-002" };
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { apagadaEm: new Date() } });
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect(chamadas("message.forward")).toBe(1);
  });

  it("recusa a mesma chave com outro destino sem chamar o motor; sem chave, como antes", async () => {
    const { autor, m, destino } = await cenario();
    const d1 = await destino("+50688880002");
    const d2 = await destino("+50688880003");
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: d1.id, chaveIdempotencia: "chave-fwd-003" }))).ok).toBe(true);
    const outra = await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: d2.id, chaveIdempotencia: "chave-fwd-003" }));
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/já foi usada/);
    expect(chamadas("message.forward")).toBe(1);
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp({ mensagemId: m.id, atendimentoDestinoId: d1.id }))).ok).toBe(true);
    expect(chamadas("message.forward")).toBe(2);
    expect(await contar("MensagemWhatsAppEncaminhada")).toBe(2);
  });

  it("a chave de outro autor não devolve o encaminhamento dele", async () => {
    const { autor, outro, m, destino } = await cenario();
    const dest = await destino("+50688880002");
    const entrada = { mensagemId: m.id, atendimentoDestinoId: dest.id, chaveIdempotencia: "chave-fwd-004" };
    expect((await comoUsuario(autor, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(true);
    expect((await comoUsuario(outro, () => encaminharMensagemWhatsApp(entrada))).ok).toBe(false);
    expect(chamadas("message.forward")).toBe(1);
  });
});

describe("editar e apagar por natureza (#166)", () => {
  it("editar de novo com o mesmo texto não chama o motor nem grava outro Evento; outro texto edita", async () => {
    const { autor, m } = await cenario();
    expect((await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "corrigido" }))).ok).toBe(true);
    expect((await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: " corrigido " }))).ok).toBe(true);
    expect(chamadas("message.edit")).toBe(1);
    expect(await contar("MensagemWhatsAppEditada")).toBe(1);
    expect((await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "corrigido de novo" }))).ok).toBe(true);
    expect(chamadas("message.edit")).toBe(2);
    expect(await contar("MensagemWhatsAppEditada")).toBe(2);
  });

  it("editar para o texto que a mensagem já tinha, sem edição anterior, segue chamando o motor como antes", async () => {
    const { autor, m } = await cenario();
    expect((await comoUsuario(autor, () => editarMensagemWhatsApp({ mensagemId: m.id, texto: "oi" }))).ok).toBe(true);
    expect(chamadas("message.edit")).toBe(1);
  });

  it("apagar de novo devolve ok sem chamar o motor nem gravar outro Evento", async () => {
    const { autor, m } = await cenario();
    expect((await comoUsuario(autor, () => apagarMensagemWhatsApp({ mensagemId: m.id }))).ok).toBe(true);
    expect((await comoUsuario(autor, () => apagarMensagemWhatsApp({ mensagemId: m.id }))).ok).toBe(true);
    expect(chamadas("message.delete")).toBe(1);
    expect(await contar("MensagemWhatsAppApagada")).toBe(1);
  });

  it("mensagem apagada fora do ERP (sem Evento de quem repete) continua recusada", async () => {
    const { autor, m } = await cenario();
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { apagadaEm: new Date() } });
    expect(await comoUsuario(autor, () => apagarMensagemWhatsApp({ mensagemId: m.id }))).toEqual({ ok: false, erro: "Esta mensagem já foi apagada." });
    expect(acao).not.toHaveBeenCalled();
  });
});
