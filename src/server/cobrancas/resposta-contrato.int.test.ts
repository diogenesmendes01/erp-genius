import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { listarFilaCobranca } from "./consultas";

const envio = new Date("2026-09-15T10:00:00Z");
const resposta = new Date("2026-09-15T11:00:00Z");
beforeEach(async () => { await truncarBanco(); });
async function preparar() {
  const canal = await seedCanal();
  const c = await seedCobranca({ vencimento: new Date("2026-09-20T12:00:00Z") });
  const outra = await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: c.matricula.produtoId, paisId: c.pais.id, moeda: "CRC" } });
  const b = await prisma.cobranca.create({ data: { matriculaId: outra.id, tipo: "MENSALIDADE", valorOriginal: 30, valorNegociado: 30, moeda: "CRC", vencimento: c.cobranca.vencimento } });
  const admin = await criarUsuario([Papel.ADMINISTRADOR]);
  for (const m of [c.matricula, outra]) await prisma.pagadorPreparacaoMatricula.create({ data: { matriculaId: m.id, preparadorId: admin.id,
    versao: 1, tipo: "ALUNO", dados: { alunoId: c.aluno.id }, motivo: "Pagador conferido na fixture", chaveIdempotencia: m.id, entradaHash: m.id } });
  for (const cobranca of [c.cobranca, b]) await prisma.evento.create({ data: { tipo: "CobrancaEnviadaWhatsApp", agregadoTipo: "Cobranca", agregadoId: cobranca.id,
    criadoEm: envio, payload: { passo: "D-7", canal: "api", cicloRegua: 0 } } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: c.aluno.telefoneE164!, alunoId: c.aluno.id } });
  const abrir = (matriculaId: string, contatoId = contato.id) => prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: canal.numero.id, contatoId,
    finalidade: "FINANCEIRO", alunoId: c.aluno.id, matriculaId }));
  const a = await abrir(c.matricula.id); const atendimentoB = await abrir(outra.id);
  return { ...c, canal, outra, b, admin, contato, abrir, a, atendimentoB };
}
async function itens() { return (await listarFilaCobranca()).itens; }

describe("resposta de cobrança pelo atendimento da matrícula", () => {
  it("não atribui transporte ou conversa comercial a contratos financeiros do mesmo telefone", async () => {
    const c = await preparar();
    await prisma.conversaWhatsApp.update({ where: { id: c.a.conversaId }, data: { ultimoInboundEm: resposta } });
    const comercial = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: c.canal.numero.id, contatoId: c.contato.id, finalidade: "COMERCIAL" }));
    await prisma.atendimentoWhatsApp.update({ where: { id: comercial.id }, data: { ultimoInboundEm: resposta } });
    expect((await itens()).every((i) => i.respondeuEm === null)).toBe(true);
    await prisma.atendimentoWhatsApp.update({ where: { id: c.atendimentoB.id }, data: { ultimoInboundEm: resposta } });
    const fila = await itens();
    expect(fila.find((i) => i.id === c.cobranca.id)?.respondeuEm).toBeNull();
    expect(fila.find((i) => i.id === c.b.id)?.respondeuEm).toBe(resposta.toISOString());
  });

  it("preserva resposta histórica do contexto encerrado, sem projetá-la em outro contrato", async () => {
    const c = await preparar();
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { ultimoInboundEm: resposta, encerradoEm: new Date("2026-09-15T12:00:00Z") } });
    const fila = await itens();
    expect(fila.find((i) => i.id === c.cobranca.id)?.respondeuEm).toBe(resposta.toISOString());
    expect(fila.find((i) => i.id === c.b.id)?.respondeuEm).toBeNull();
  });

  it("exige resposta posterior ao envio e não marca cobrança que nunca foi enviada", async () => {
    const c = await preparar();
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { ultimoInboundEm: envio } });
    const semEnvio = await prisma.cobranca.create({ data: { matriculaId: c.matricula.id, tipo: "MENSALIDADE", valorOriginal: 20, valorNegociado: 20,
      moeda: "CRC", vencimento: new Date("2026-10-20T12:00:00Z") } });
    expect((await itens()).find((i) => i.id === c.cobranca.id)?.respondeuEm).toBeNull();
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { ultimoInboundEm: resposta } });
    const fila = await itens();
    expect(fila.find((i) => i.id === c.cobranca.id)?.respondeuEm).toBe(resposta.toISOString());
    expect(fila.find((i) => i.id === semEnvio.id)?.respondeuEm).toBeNull();
  });

  it("confere destinatário contratual atual e identifica empresa como pagador externo", async () => {
    const c = await preparar();
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { ultimoInboundEm: resposta } });
    const telefone = "+50680006666";
    await prisma.pagadorPreparacaoMatricula.create({ data: { matriculaId: c.matricula.id, preparadorId: c.admin.id, versao: 2, tipo: "EMPRESA",
      dados: { nome: "Empresa atual", telefoneE164: telefone }, motivo: "Pagador atualizado na fixture", chaveIdempotencia: "empresa-atual-fixture", entradaHash: "empresa-atual" } });
    let item = (await itens()).find((i) => i.id === c.cobranca.id)!;
    expect(item.respondeuEm).toBeNull();
    expect(item.destino).toMatchObject({ nome: "Empresa atual", telefone, viaResponsavel: true });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone } });
    const novo = await c.abrir(c.matricula.id, contato.id);
    await prisma.atendimentoWhatsApp.update({ where: { id: novo.id }, data: { ultimoInboundEm: resposta } });
    item = (await itens()).find((i) => i.id === c.cobranca.id)!;
    expect(item.respondeuEm).toBe(resposta.toISOString());
    expect((await itens()).find((i) => i.id === c.b.id)?.respondeuEm).toBeNull();
  });
});
