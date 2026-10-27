import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { CANAL_INBOX } from "./barramento";
import { avisarAtendimento } from "./aviso";

beforeEach(() => truncarBanco());
afterAll(() => prisma.$disconnect());

async function cenario() {
  const numero = await criarNumeroSetor({ telefoneE164: "+5500000000321", setores: ["COMERCIAL"] });
  const criar = async (telefoneE164: string) => {
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164 } });
    return prisma.$transaction(tx => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL" }));
  };
  return { alvo: await criar("+5500000001321"), sentinela: await criar("+5500000002321") };
}

async function escutar() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const quadros: unknown[] = [];
  client.on("notification", n => { if (n.channel === CANAL_INBOX && n.payload) quadros.push(JSON.parse(n.payload)); });
  await client.connect();
  await client.query("LISTEN " + CANAL_INBOX);
  const doAtendimento = (id: string) => quadros.filter(x => !!x && typeof x === "object" && "atendimentoId" in x && x.atendimentoId === id);
  const esperar = (id: string) => vi.waitFor(() => expect(doAtendimento(id)).toHaveLength(1), { timeout: 3000 });
  return { quadros, doAtendimento, esperar, sair: () => client.end() };
}

describe("aviso transacional do atendimento pelo trigger existente", () => {
  it("autocommit publica exatamente tipo e IDs, sem conteúdo ou destinatário privado", async () => {
    const { alvo } = await cenario(), escuta = await escutar();
    try {
      await avisarAtendimento(prisma, alvo.id);
      await escuta.esperar(alvo.id);
      expect(escuta.doAtendimento(alvo.id)).toEqual([{ tipo: "atendimento.atualizado", atendimentoId: alvo.id, mensagemId: null, conversaId: alvo.conversaId }]);
    } finally { await escuta.sair(); }
  });
  it("na transação não avisa antes do commit, mas o consumidor recebe após confirmar", async () => {
    const { alvo, sentinela } = await cenario(), escuta = await escutar();
    try {
      await prisma.$transaction(async tx => {
        await avisarAtendimento(tx, alvo.id);
        await avisarAtendimento(prisma, sentinela.id);
        await escuta.esperar(sentinela.id);
        expect(escuta.doAtendimento(alvo.id)).toEqual([]);
      }, { timeout: 10000 });
      await escuta.esperar(alvo.id);
      expect(escuta.doAtendimento(alvo.id)).toEqual([{ tipo: "atendimento.atualizado", atendimentoId: alvo.id, mensagemId: null, conversaId: alvo.conversaId }]);
    } finally { await escuta.sair(); }
  });
  it("rollback não publica: commit sentinela posterior comprova a escuta sem pausa arbitrária", async () => {
    const { alvo, sentinela } = await cenario(), escuta = await escutar();
    try {
      await expect(prisma.$transaction(async tx => {
        await avisarAtendimento(tx, alvo.id);
        throw new Error("rollback-controlado-321");
      })).rejects.toThrow("rollback-controlado-321");
      await avisarAtendimento(prisma, sentinela.id);
      await escuta.esperar(sentinela.id);
      expect(escuta.doAtendimento(alvo.id)).toEqual([]);
    } finally { await escuta.sair(); }
  });
  it("ID inexistente não inventa aviso nem toca outro atendimento", async () => {
    const { sentinela } = await cenario(), escuta = await escutar();
    try {
      await avisarAtendimento(prisma, "atendimento-ausente-321");
      await avisarAtendimento(prisma, sentinela.id);
      await escuta.esperar(sentinela.id);
      expect(escuta.doAtendimento("atendimento-ausente-321")).toEqual([]);
      expect(escuta.quadros).toHaveLength(1);
    } finally { await escuta.sair(); }
  });
});
