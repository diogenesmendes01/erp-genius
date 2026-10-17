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
import { apagarMensagemWhatsApp, editarMensagemWhatsApp } from "./acoes-mensagem";

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
