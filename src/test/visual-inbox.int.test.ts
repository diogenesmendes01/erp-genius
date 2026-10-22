import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { criarDemoInbox } from "../../scripts/visual/demo-inbox";

beforeAll(async () => {
  await truncarBanco();
  await prisma.usuario.createMany({ data: [
    { email: "admin@genius.com", nome: "Admin demo", senhaHash: "teste-local", papeis: ["ADMINISTRADOR"] },
    { email: "joao@genius.com", nome: "João demo", senhaHash: "teste-local", papeis: ["VENDEDOR"] },
  ] });
});
afterAll(() => prisma.$disconnect());

describe("fixture visual do Inbox no perfil descartável", () => {
  it("semeia sete atendimentos só do cenário, repete sem duplicar e repara caso parcial", async () => {
    const externo = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5500000000999", rotulo: "Outro cenário", driver: "BAILEYS", finalidade: "VENDAS" } });
    const ids = await criarDemoInbox(prisma);
    expect(Object.keys(ids).sort()).toEqual(["beatriz", "fernanda", "lucas", "mariana", "semNome", "thiago", "ventura"]);
    expect(await prisma.atendimentoWhatsApp.count({ where: { id: { in: Object.values(ids) } } })).toBe(7);
    expect(await prisma.evento.count({ where: { id: "inbox-demo-nota-beatriz-307" } })).toBe(1);
    expect(await prisma.mensagemWhatsApp.count({ where: { atendimentoId: ids.beatriz, status: "FALHOU" } })).toBe(1);
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: ids.lucas } })).atendimentoOrigemId).toBe("inbox-demo-lucas-origem-307");
    expect(await prisma.pessoaTag.count({ where: { pessoaId: "inbox-demo-pessoa-mariana-307" } })).toBe(3);

    expect(await criarDemoInbox(prisma)).toEqual(ids);
    expect(await prisma.atendimentoWhatsApp.count({ where: { id: { in: Object.values(ids) } } })).toBe(7);
    expect(await prisma.evento.count({ where: { id: "inbox-demo-nota-beatriz-307" } })).toBe(1);

    // Simula um preparo interrompido antes de concluir Fernanda, preservando número/contato/conversa.
    await prisma.mensagemWhatsApp.delete({ where: { id: "inbox-demo-msg-fernanda-307" } });
    await prisma.atendimentoWhatsApp.delete({ where: { id: ids.fernanda } });
    expect(await criarDemoInbox(prisma)).toEqual(ids);
    expect(await prisma.atendimentoWhatsApp.count({ where: { id: { in: Object.values(ids) } } })).toBe(7);
    expect(await prisma.mensagemWhatsApp.count({ where: { id: "inbox-demo-msg-fernanda-307" } })).toBe(1);
    expect(await prisma.numeroWhatsApp.findUnique({ where: { id: externo.id } })).toMatchObject({ rotulo: "Outro cenário" });
  });
});
