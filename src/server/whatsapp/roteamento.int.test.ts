import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: () => Promise.resolve(null) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor, seedCobranca } from "@/test/integracao-whatsapp";
import { atendimentoDoInbound, garantirAtendimento } from "./atendimentos";
import type { Setor } from "./setor";

// Roteamento do inbound pelo setor do número (E4). Sem WHATSAPP_LIVE: nenhum envio real.
beforeEach(async () => { await truncarBanco(); });

let seq = 0;
async function cenario(setores: Setor[], over: { finalidade?: "COBRANCA" | "VENDAS"; donoId?: string; alunoId?: string; telefone?: string } = {}) {
  seq += 1;
  const numero = await criarNumeroSetor({ telefoneE164: `+55119000001${String(seq).padStart(2, "0")}`, setores, finalidade: over.finalidade ?? "COBRANCA", donoId: over.donoId });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: over.telefone ?? `+5070000${String(seq).padStart(4, "0")}`, alunoId: over.alunoId } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  return { numero, contato, conversa };
}
const rotear = (conversaId: string) => prisma.$transaction((tx) => atendimentoDoInbound(tx, conversaId));

describe("roteamento do inbound por setor do número", () => {
  it("1. atendimento aberto: mantém", async () => {
    // Destinatário atual de atendimento com aluno: o telefone do contato é o do aluno.
    const { aluno } = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z") });
    const c = await cenario(["SECRETARIA"], { alunoId: aluno.id, telefone: aluno.telefoneE164! });
    const aberto = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: c.numero.id, contatoId: c.contato.id, finalidade: "SECRETARIA", alunoId: aluno.id }));
    expect(await rotear(c.conversa.id)).toBe(aberto.id);
  });

  it("2. número de um setor: abre na fila do setor (SECRETARIA, sem responsável)", async () => {
    const c = await cenario(["SECRETARIA"]);
    const id = await rotear(c.conversa.id);
    expect(await prisma.atendimentoWhatsApp.findUnique({ where: { id: id! } })).toMatchObject({ finalidade: "SECRETARIA", responsavelId: null, status: "ABERTO_SEM_RESPONSAVEL" });
  });

  it("2b. setor único FINANCEIRO sem matrícula única ou PEDAGOGICO: triagem", async () => {
    const { aluno, matricula } = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z") });
    await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: matricula.produtoId, paisId: matricula.paisId, moeda: "CRC" } });
    const fin = await cenario(["FINANCEIRO"], { alunoId: aluno.id });
    expect(await rotear(fin.conversa.id)).toBeNull();
    const pedag = await cenario(["PEDAGOGICO"], { alunoId: aluno.id });
    expect(await rotear(pedag.conversa.id)).toBeNull();
  });

  it("2c. depois do encerramento: novo atendimento no mesmo setor", async () => {
    const c = await cenario(["SECRETARIA"]);
    const primeiro = await rotear(c.conversa.id);
    await prisma.atendimentoWhatsApp.update({ where: { id: primeiro! }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
    const segundo = await rotear(c.conversa.id);
    expect(segundo).not.toBeNull();
    expect(segundo).not.toBe(primeiro);
    expect(await prisma.atendimentoWhatsApp.findUnique({ where: { id: segundo! } })).toMatchObject({ finalidade: "SECRETARIA", encerradoEm: null });
  });

  it("3. número de vários setores: triagem", async () => {
    const c = await cenario(["SECRETARIA", "COMERCIAL"]);
    expect(await rotear(c.conversa.id)).toBeNull();
  });

  it("4. FINANCEIRO com matrícula única: abre o atendimento financeiro", async () => {
    const { aluno, matricula } = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z") });
    const c = await cenario(["FINANCEIRO"], { alunoId: aluno.id });
    const id = await rotear(c.conversa.id);
    expect(await prisma.atendimentoWhatsApp.findUnique({ where: { id: id! } })).toMatchObject({ finalidade: "FINANCEIRO", matriculaId: matricula.id });
  });

  it("5. linha comercial (VENDAS com dono): regra atual", async () => {
    const dono = await criarUsuario(["VENDEDOR"]);
    const c = await cenario(["COMERCIAL"], { finalidade: "VENDAS", donoId: dono.id });
    const id = await rotear(c.conversa.id);
    expect(await prisma.atendimentoWhatsApp.findUnique({ where: { id: id! } })).toMatchObject({ finalidade: "COMERCIAL" });
    expect(await rotear(c.conversa.id)).toBe(id);
  });
});
