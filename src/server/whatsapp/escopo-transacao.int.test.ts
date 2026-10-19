import { DriverWhatsApp, Papel } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { atendimentoVisivel, garantirAtendimento } from "./atendimentos";
import { escopoAtendimentos } from "./escopo";

// #207 (C4 da R1 e C2 da R2): a checagem de escopo aceita o `db` da transação. Dentro dela, o escopo é lido
// NELA: enxerga o que a própria transação gravou e ainda não foi commitado (o atendimento, a cobertura, a equipe),
// e não pede outra conexão do pool. A trava de pool (uma conexão só) fica em acoes-atendimento-pool.int.test.ts.

beforeEach(async () => { await truncarBanco(); });

const sessao = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });
class Desfazer extends Error {}
/** Roda `f` numa transação que nunca é commitada: tudo que ela grava some no fim. */
async function semCommit(f: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<void>) {
  await expect(prisma.$transaction(async (tx) => { await f(tx); throw new Desfazer(); })).rejects.toBeInstanceOf(Desfazer);
}
const contar = (db: { atendimentoWhatsApp: { count: typeof prisma.atendimentoWhatsApp.count } }, id: string, where: object) =>
  db.atendimentoWhatsApp.count({ where: { AND: [{ id }, where] } });

describe("escopo dentro da transação (db opcional)", () => {
  it("atendimentoVisivel com a tx enxerga o atendimento criado nela, ainda não commitado; sem a tx, não", async () => {
    const v1 = await criarUsuario([Papel.VENDEDOR], "Vend Um");
    const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL"], finalidade: "AGENDA", donoId: null });
    await semCommit(async (tx) => {
      const contato = await tx.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
      const a = await garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: v1.id });
      expect((await atendimentoVisivel(sessao(v1), a.id, false, tx))?.id).toBe(a.id);
      expect(await atendimentoVisivel(sessao(v1), a.id)).toBeNull();
    });
  });

  it("escopo comercial: a cobertura gravada na tx vale para escopoAtendimentos com a tx", async () => {
    const titular = await criarUsuario([Papel.VENDEDOR], "Titular");
    const substituto = await criarUsuario([Papel.VENDEDOR], "Substituto");
    const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
    const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990002", rotulo: "Vendas", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", donoId: null } });
    const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688880002", vendedorDonoId: titular.id } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
    const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
    await semCommit(async (tx) => {
      await tx.coberturaCarteira.create({ data: { titularId: titular.id, substitutoId: substituto.id, concedenteId: gerente.id, inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3_600_000), motivo: "Férias do titular" } });
      expect(await contar(tx, a.id, await escopoAtendimentos(substituto, { db: tx }))).toBe(1);
      expect(await contar(tx, a.id, await escopoAtendimentos(substituto))).toBe(0);
    });
  });

  it("linha comercial: o vendedor posto na equipe do gerente dentro da tx entra nos donos de linha visíveis", async () => {
    const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
    const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
    const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999990003", rotulo: "Linha", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", donoId: vendedor.id } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880003" } });
    const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL" }));
    await semCommit(async (tx) => {
      await tx.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
      // O gerente comercial já vê o setor inteiro; o que se mede aqui é o ramo da linha, lido na tx.
      expect(JSON.stringify(await escopoAtendimentos(gerente, { db: tx }))).toContain(vendedor.id);
      expect(JSON.stringify(await escopoAtendimentos(gerente))).not.toContain(vendedor.id);
      expect((await atendimentoVisivel(sessao(gerente), a.id, false, tx))?.id).toBe(a.id);
    });
  });
});
