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
import { marcarConversaLida } from "../acoes";
import { avisarDigitando } from "./acoes-mensagem";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); acao.mockReset(); acao.mockResolvedValue({}); vi.useRealTimers(); });
const comoUsuario = async <T,>(u: { id: string }, f: () => Promise<T>) => { authMock.mockResolvedValue({ user: { id: u.id } }); return f(); };

async function cenario() {
  const autor = await criarUsuario([Papel.VENDEDOR], "Autor");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], finalidade: "COBRANCA", donoId: (await criarUsuario([Papel.FINANCEIRO], "Dono")).id });
  await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { driver: "MOTOR", sessao: "CONECTADO", providerRef: numero.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001", waId: "50688880001" } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id }));
  await prisma.atendimentoWhatsApp.update({ where: { id: at.id }, data: { naoLidas: 3 } });
  return { autor, numero, at };
}

describe("marcar lida e digitando pelo motor", () => {
  it("abrir conversa chama message.read com o JID", async () => {
    const { autor, numero, at } = await cenario();
    const r = await comoUsuario(autor, () => marcarConversaLida(at.id));
    expect(r.ok).toBe(true);
    expect(acao).toHaveBeenCalledWith(numero.id, "message.read", { chatId: "50688880001@s.whatsapp.net" });
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id } })).naoLidas).toBe(0);
  });
  it("sessão desconectada zera naoLidas sem chamar message.read", async () => {
    const { autor, numero, at } = await cenario();
    await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { sessao: "CAIU" } });
    expect((await comoUsuario(autor, () => marcarConversaLida(at.id))).ok).toBe(true);
    expect(acao).not.toHaveBeenCalled();
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id } })).naoLidas).toBe(0);
  });
  it("motor indisponível não impede zerar naoLidas", async () => {
    const { autor, at } = await cenario();
    acao.mockRejectedValue(new Error("motor fora"));
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await comoUsuario(autor, () => marcarConversaLida(at.id));
    await new Promise((res) => setTimeout(res, 10));
    expect(r.ok).toBe(true);
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id } })).naoLidas).toBe(0);
    expect(JSON.stringify(erro.mock.calls)).not.toContain("50688880001");
    erro.mockRestore();
  });
  it("digitando duas vezes em 10 s chama o motor uma vez", async () => {
    const { autor, numero, at } = await cenario();
    expect((await comoUsuario(autor, () => avisarDigitando(at.id))).ok).toBe(true);
    expect((await comoUsuario(autor, () => avisarDigitando(at.id))).ok).toBe(true);
    expect(acao).toHaveBeenCalledTimes(1);
    expect(acao).toHaveBeenCalledWith(numero.id, "presence", { chatId: "50688880001@s.whatsapp.net", state: "composing" }, { origem: "HUMANO" });
    expect(await prisma.evento.count({ where: { agregadoId: at.id, tipo: { contains: "igitando" } } })).toBe(0);
  });
  it("digitando de novo após 10 s chama o motor outra vez", async () => {
    const { autor, at } = await cenario();
    const base = Date.now();
    const spy = vi.spyOn(Date, "now");
    spy.mockReturnValue(base);
    await comoUsuario(autor, () => avisarDigitando(at.id));
    spy.mockReturnValue(base + 10_001);
    await comoUsuario(autor, () => avisarDigitando(at.id));
    spy.mockRestore();
    expect(acao).toHaveBeenCalledTimes(2);
  });
  it("digitando fora do escopo é recusado sem chamar o motor", async () => {
    const { at } = await cenario();
    const estranho = await criarUsuario([Papel.PROFESSOR], "Estranho");
    const r = await comoUsuario(estranho, () => avisarDigitando(at.id));
    expect(r.ok).toBe(false);
    expect(acao).not.toHaveBeenCalled();
  });
});
