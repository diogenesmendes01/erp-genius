import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";

beforeEach(async () => { await truncarBanco(); });

async function cenario() {
  const catalogo = await seedCatalogoMinimo();
  const fin = await criarUsuario([Papel.FINANCEIRO]);
  const vendedor = await criarUsuario([Papel.VENDEDOR]);
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna", paisId: catalogo.pais.id, telefoneE164: "+50680001111", whatsapp: true } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC" } });
  const { numero } = await seedCanal({ driver: "BAILEYS", estado: "ATIVA" });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: aluno.telefoneE164!, alunoId: aluno.id, nomeExibicao: aluno.telefoneE164 } });
  const lead = await prisma.lead.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: vendedor.id } });
  const contatoLead = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contatoLead.id, finalidade: "COMERCIAL", leadId: lead.id }));
  const financeiro = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "FINANCEIRO", alunoId: aluno.id, matriculaId: matricula.id }));
  return { fin, a, financeiro };
}

describe("status, prazos e origem do atendimento (M2)", () => {
  it("novo atendimento nasce ABERTO_SEM_RESPONSAVEL; migration semeia prazos provisórios", async () => {
    const { a } = await cenario();
    expect(a.status).toBe("ABERTO_SEM_RESPONSAVEL");
    // truncarBanco apaga o seed; a migration é a fonte dos prazos provisórios (Q3).
    const sql = readFileSync("prisma/migrations/20261016100000_atendimento_status_prazos/migration.sql", "utf8");
    for (const [setor, min] of [["COMERCIAL", 15], ["FINANCEIRO", 240], ["SECRETARIA", 240], ["PEDAGOGICO", 1440]]) {
      expect(sql).toContain(`('${setor}', ${min}, CURRENT_TIMESTAMP)`);
    }
  });
  it("CHECK: ENCERRADO se e somente se encerradoEm", async () => {
    const { a } = await cenario();
    await expect(prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { status: "ENCERRADO" } })).rejects.toThrow(/Atendimento_status_encerrado/);
    await expect(prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { encerradoEm: new Date() } })).rejects.toThrow(/Atendimento_status_encerrado/);
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { encerradoEm: new Date(), status: "ENCERRADO" } });
  });
  it("CHECK: origem não aponta para si mesmo; prazo > 0", async () => {
    const { a } = await cenario();
    await expect(prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { atendimentoOrigemId: a.id } })).rejects.toThrow(/Atendimento_origem_distinta/);
    await expect(prisma.prazoRespostaSetor.create({ data: { finalidade: "COMERCIAL", minutos: 0 } })).rejects.toThrow(/PrazoRespostaSetor_minutos_positivo|Unique|minutos/);
  });
  it("mudar status de atendimento FINANCEIRO não esbarra na imutabilidade do contexto", async () => {
    const { financeiro, fin } = await cenario();
    await prisma.atendimentoWhatsApp.update({ where: { id: financeiro.id }, data: { status: "EM_ATENDIMENTO", responsavelId: fin.id } });
  });
});
