import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DriverWhatsApp } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { criarDemoInbox } from "../../scripts/visual/demo-inbox";

beforeEach(async () => {
  await truncarBanco();
  await prisma.usuario.createMany({ data: [
    { email: "admin@genius.com", nome: "Admin demo", senhaHash: "teste-local", papeis: ["ADMINISTRADOR"] },
    { email: "joao@genius.com", nome: "João demo", senhaHash: "teste-local", papeis: ["VENDEDOR"] },
  ] });
});
afterAll(() => prisma.$disconnect());

describe("fixture visual do Inbox no perfil descartável", () => {
  it("cria somente telefones fictícios na linha, contatos e oportunidades", async () => {
    const ids = await criarDemoInbox(prisma);
    expect((await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: "inbox-demo-numero-307" } })).telefoneE164).toBe("+5500000000300");
    for (const [chave, telefone] of Object.entries({ mariana: "+5500000000301", ventura: "+5500000000302", beatriz: "+5500000000303", lucas: "+5500000000304", thiago: "+5500000000305", semNome: "+5500000000306", fernanda: "+5500000000307" })) {
      expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: `inbox-demo-contato-${chave}-307` } })).telefoneE164).toBe(telefone);
      expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: `inbox-demo-lead-${chave}-307` } })).telefoneE164).toBe(telefone);
    }
    expect(Object.keys(ids)).toHaveLength(7);
  });

  it("repara telefones legados já semeados de forma idempotente sem alterar outro cenário", async () => {
    const ids = await criarDemoInbox(prisma);
    const externo = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5500000000999", rotulo: "Outro cenário", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS" } });
    await prisma.numeroWhatsApp.update({ where: { id: "inbox-demo-numero-307" }, data: { telefoneE164: "+551140028922" } });
    for (const [chave, telefone] of Object.entries({ mariana: "+5511984213307", ventura: "+5511986213308", beatriz: "+5511973334521", lucas: "+5511962224522", thiago: "+5511951114523", semNome: "+5511940004524", fernanda: "+5511939994525" })) {
      await prisma.contatoWhatsApp.update({ where: { id: `inbox-demo-contato-${chave}-307` }, data: { telefoneE164: telefone } });
      await prisma.oportunidade.update({ where: { id: `inbox-demo-lead-${chave}-307` }, data: { telefoneE164: telefone } });
    }
    expect(await criarDemoInbox(prisma)).toEqual(ids);
    expect(await criarDemoInbox(prisma)).toEqual(ids);
    expect((await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: "inbox-demo-numero-307" } })).telefoneE164).toBe("+5500000000300");
    expect(await prisma.contatoWhatsApp.count({ where: { id: { startsWith: "inbox-demo-contato-" }, telefoneE164: { startsWith: "+55000000003" } } })).toBe(7);
    expect(await prisma.oportunidade.count({ where: { id: { startsWith: "inbox-demo-lead-" }, telefoneE164: { startsWith: "+55000000003" } } })).toBe(7);
    expect(await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: externo.id } })).toMatchObject({ telefoneE164: "+5500000000999", rotulo: "Outro cenário" });
    expect(await prisma.atendimentoWhatsApp.count({ where: { id: { in: Object.values(ids) } } })).toBe(7);
  });

  it("recusa telefone de contato modificado e mantém o reparo inteiro atômico", async () => {
    await criarDemoInbox(prisma);
    await prisma.numeroWhatsApp.update({ where: { id: "inbox-demo-numero-307" }, data: { telefoneE164: "+551140028922" } });
    await prisma.contatoWhatsApp.update({ where: { id: "inbox-demo-contato-fernanda-307" }, data: { telefoneE164: "+5500000000888" } });
    await expect(criarDemoInbox(prisma)).rejects.toThrow("configuração inesperada");
    expect((await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: "inbox-demo-numero-307" } })).telefoneE164).toBe("+551140028922");
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: "inbox-demo-contato-fernanda-307" } })).telefoneE164).toBe("+5500000000888");
  });

  it("recusa linha conectada e colisão do telefone fictício com número de outro cenário", async () => {
    await criarDemoInbox(prisma);
    await prisma.numeroWhatsApp.update({ where: { id: "inbox-demo-numero-307" }, data: { sessao: "CONECTADO" } });
    await expect(criarDemoInbox(prisma)).rejects.toThrow("configuração inesperada");
    await prisma.numeroWhatsApp.update({ where: { id: "inbox-demo-numero-307" }, data: { sessao: "DESCONECTADO", telefoneE164: "+551140028922" } });
    const externo = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5500000000300", rotulo: "Outro cenário", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS" } });
    await expect(criarDemoInbox(prisma)).rejects.toThrow("configuração inesperada");
    expect((await prisma.numeroWhatsApp.findUniqueOrThrow({ where: { id: externo.id } })).telefoneE164).toBe("+5500000000300");
  });

  it("semeia sete atendimentos só do cenário, repete sem duplicar e repara caso parcial", async () => {
    const externo = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5500000000999", rotulo: "Outro cenário", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS" } });
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
