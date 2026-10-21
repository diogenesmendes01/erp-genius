import { DriverWhatsApp } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { assinarInbox, iniciarEscuta, esperaReconexaoMs, type AvisoInbox } from "./barramento";

let a: { id: string; conversaId: string }; let numeroId: string;

beforeAll(async () => { await iniciarEscuta(process.env.DATABASE_URL!); });
beforeEach(async () => {
  await truncarBanco();
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999999999", rotulo: "Inst", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS" } });
  numeroId = numero.id;
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: lead.id } });
  a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
});
afterAll(() => prisma.$disconnect());

const criarMensagemEntrada = (corpo: string) => prisma.mensagemWhatsApp.create({ data: { numeroId, conversaId: a.conversaId, atendimentoId: a.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo } });
const escutar = () => { const r: AvisoInbox[] = []; const sair = assinarInbox((x) => r.push(x)); return { r, sair }; };
const pausa = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe("barramento do inbox", () => {
  it("iniciarEscuta é idempotente", async () => {
    await iniciarEscuta(process.env.DATABASE_URL!); await iniciarEscuta();
  });
  it("insert de mensagem gera aviso sem conteúdo, depois do commit", async () => {
    const { r, sair } = escutar();
    const m = await criarMensagemEntrada("segredo");
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "mensagem.nova", atendimentoId: a.id, mensagemId: m.id, conversaId: a.conversaId }), { timeout: 2000 });
    expect(JSON.stringify(r)).not.toContain("segredo"); sair();
  });
  it("rollback não avisa", async () => {
    const { r, sair } = escutar();
    await expect(prisma.$transaction(async (tx) => {
      await tx.mensagemWhatsApp.create({ data: { numeroId, conversaId: a.conversaId, atendimentoId: a.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "x" } });
      throw new Error("desfaz");
    })).rejects.toThrow("desfaz");
    await pausa(500); expect(r).toEqual([]); sair();
  });
  it("update de status da mensagem → mensagem.status; update do atendimento → atendimento.atualizado", async () => {
    const m = await criarMensagemEntrada("oi"); await pausa(300);
    const { r, sair } = escutar();
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { status: "LIDA" } });
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "mensagem.status", atendimentoId: a.id, mensagemId: m.id, conversaId: a.conversaId }), { timeout: 2000 });
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { naoLidas: 3 } });
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId }), { timeout: 2000 });
    sair();
  });
  it("reclassificar a mensagem (atendimentoId) → atendimento.atualizado", async () => {
    const m = await prisma.mensagemWhatsApp.create({ data: { numeroId, conversaId: a.conversaId, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "oi" } });
    await pausa(300);
    const { r, sair } = escutar();
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { atendimentoId: a.id } });
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: m.id, conversaId: a.conversaId }), { timeout: 2000 });
    sair();
  });
  it("C5: ao reconectar o LISTEN emite resync às assinaturas (e não na primeira conexão)", async () => {
    const { r, sair } = escutar();
    expect(r.filter((x) => x.tipo === "resync")).toHaveLength(0);
    // Derruba só a conexão de escuta deste banco (a que fez LISTEN no canal), nunca outras.
    const mortos = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(pg_terminate_backend(pid))::int AS n FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid() AND query LIKE 'LISTEN inbox_eventos%'`);
    expect(mortos[0].n).toBeGreaterThan(0);
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" }), { timeout: 8000 });
    // A escuta voltou a funcionar.
    const m = await criarMensagemEntrada("depois");
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "mensagem.nova", atendimentoId: a.id, mensagemId: m.id, conversaId: a.conversaId }), { timeout: 3000 });
    sair();
  });
  it("espera de reconexão: 1 s, 2 s, 4 s… até 30 s", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(esperaReconexaoMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});
