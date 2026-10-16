import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Papel } from "@prisma/client";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { aplicarInbound, aplicarResposta, prazoRespostaEm } from "./status-atendimento";

beforeEach(async () => { await truncarBanco(); });

async function cenario() {
  await prisma.prazoRespostaSetor.create({ data: { finalidade: "COMERCIAL", minutos: 15 } });
  const { numero } = await seedCanal({ driver: "BAILEYS", estado: "ATIVA" });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777" } });
  const dados = { numeroId: numero.id, contatoId: contato.id, finalidade: "SECRETARIA" as const };
  const primeiro = await prisma.$transaction((tx) => garantirAtendimento(tx, dados));
  return { dados, primeiro };
}

describe("status, prazo e reabertura (E3.3)", () => {
  it("inbound marca primeiroInboundEm e prazo; resposta humana marca primeiraRespostaEm uma vez", async () => {
    const { dados } = await cenario();
    const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { ...dados, finalidade: "COMERCIAL" }));
    const inicio = new Date("2026-10-16T12:00:00Z");
    await prisma.$transaction((tx) => aplicarInbound(tx, a.id, inicio));
    let lido = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } });
    expect(lido.primeiroInboundEm).toEqual(inicio);
    expect(lido.prazoRespostaEm).toEqual(new Date(inicio.getTime() + 15 * 60_000));
    expect(await prisma.$transaction((tx) => prazoRespostaEm(tx, "COMERCIAL", inicio))).toEqual(lido.prazoRespostaEm);
    // 2º inbound não move o prazo
    await prisma.$transaction((tx) => aplicarInbound(tx, a.id, new Date(inicio.getTime() + 60_000)));
    lido = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } });
    expect(lido.prazoRespostaEm).toEqual(new Date(inicio.getTime() + 15 * 60_000));

    const r1 = new Date(inicio.getTime() + 5 * 60_000);
    await prisma.$transaction((tx) => aplicarResposta(tx, a.id, r1));
    await prisma.$transaction((tx) => aplicarResposta(tx, a.id, new Date(r1.getTime() + 60_000)));
    lido = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: a.id } });
    expect(lido.primeiraRespostaEm).toEqual(r1);
    expect(lido.status).toBe("AGUARDANDO_CLIENTE");
  });

  it("setor sem prazo configurado não grava prazo", async () => {
    const { primeiro } = await cenario();
    await prisma.$transaction((tx) => aplicarInbound(tx, primeiro.id, new Date()));
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: primeiro.id } })).prazoRespostaEm).toBeNull();
  });

  it("responsável preenchido nasce EM_ATENDIMENTO", async () => {
    const { dados } = await cenario();
    const outro = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688885555" } });
    const u = await criarUsuario([Papel.SECRETARIA_ACADEMICA]);
    const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { ...dados, contatoId: outro.id, responsavelId: u.id }));
    expect(a.status).toBe("EM_ATENDIMENTO");
  });

  it("sem reabrir, devolve o encerrado; abrir de novo cria atendimento novo com #2, #3", async () => {
    const { dados, primeiro } = await cenario();
    const encerrar = (id: string) => prisma.atendimentoWhatsApp.update({ where: { id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    const encerrado = await encerrar(primeiro.id);
    const mesmo = await prisma.$transaction((tx) => garantirAtendimento(tx, dados));
    expect(mesmo.id).toBe(encerrado.id);

    const novo = await prisma.$transaction((tx) => garantirAtendimento(tx, { ...dados, reabrir: true }));
    expect(novo.id).not.toBe(encerrado.id);
    expect(novo.contextoChave).toBe(`${encerrado.contextoChave}#2`);
    expect(novo.status).toBe("ABERTO_SEM_RESPONSAVEL");
    // aberto existente é reaproveitado
    expect((await prisma.$transaction((tx) => garantirAtendimento(tx, { ...dados, reabrir: true }))).id).toBe(novo.id);
    await encerrar(novo.id);
    const terceiro = await prisma.$transaction((tx) => garantirAtendimento(tx, { ...dados, reabrir: true }));
    expect(terceiro.contextoChave).toBe(`${encerrado.contextoChave}#3`);
  });

  it("linha VENDAS: COMERCIAL encerrado abre #2 com ou sem reabrir (atendimentoComercialDaLinha já separa)", async () => {
    const { numero } = await seedCanal({ driver: "BAILEYS", estado: "ATIVA" });
    await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { finalidade: "VENDAS" } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
    const dados = { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL" as const };
    const primeiro = await prisma.$transaction((tx) => garantirAtendimento(tx, dados));
    await prisma.atendimentoWhatsApp.update({ where: { id: primeiro.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    const segundo = await prisma.$transaction((tx) => garantirAtendimento(tx, { ...dados, reabrir: true }));
    expect(segundo.id).not.toBe(primeiro.id);
    expect(segundo.encerradoEm).toBeNull();
    expect(segundo.contextoChave).toBe(`${primeiro.contextoChave}:2`);
    await prisma.atendimentoWhatsApp.update({ where: { id: segundo.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    const terceiro = await prisma.$transaction((tx) => garantirAtendimento(tx, dados));
    expect(terceiro.encerradoEm).toBeNull();
    expect(terceiro.contextoChave).toBe(`${primeiro.contextoChave}:3`);
  });

  it("reabertura concorrente abre um só atendimento", async () => {
    const { dados, primeiro } = await cenario();
    await prisma.atendimentoWhatsApp.update({ where: { id: primeiro.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    await Promise.all([1, 2].map(() => prisma.$transaction((tx) => garantirAtendimento(tx, { ...dados, reabrir: true }))));
    expect(await prisma.atendimentoWhatsApp.count({ where: { conversaId: primeiro.conversaId, encerradoEm: null } })).toBe(1);
  });
});
