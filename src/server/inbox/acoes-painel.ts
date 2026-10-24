"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao } from "@/server/_shared/sessao";
import { alterarTagNaTransacao, criarOuObterTagNaTransacao } from "@/server/crm/tags";
import { capacidadesPainel } from "./permissoes";
import { pessoaDoAtendimento } from "./painel-detalhes";
import { avisarAtendimento } from "./aviso";

const Id = z.string().min(1, "Contato não encontrado.");
async function executarTag(atendimentoId: string, entrada: { tipo: "atribuir" | "remover"; tagId: string } | { tipo: "criar"; nome: string }): Promise<Resultado<{ tagId: string }>> {
  return executarAcao(async () => {
    const usuario = await exigirSessao(); const id = Id.parse(atendimentoId);
    return prisma.$transaction(async tx => {
      // Serializa mudanças do contexto do atendimento antes de resolver identidade/autorização.
      await tx.$executeRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const pessoa = await pessoaDoAtendimento(usuario, id, tx);
      if (!pessoa) throw new ErroRegra("Contato não encontrado.");
      const capacidades = capacidadesPainel(usuario, { finalidade: "COMERCIAL", veLead: pessoa.leadId !== null });
      if (!capacidades.editarTags || (entrada.tipo === "criar" && !capacidades.criarTag)) throw new ErroRegra("Você não tem acesso a esta função do CRM.");
      const tagId = entrada.tipo === "criar" ? (await criarOuObterTagNaTransacao(tx, usuario, { nome: entrada.nome, cor: "NEUTRA" })).id : entrada.tagId;
      const mudou = await alterarTagNaTransacao(tx, usuario, { pessoaId: pessoa.pessoaId, tagId }, entrada.tipo === "remover" ? "remover" : "atribuir", async () => {
        const atual = await pessoaDoAtendimento(usuario, id, tx);
        if (!atual || atual.pessoaId !== pessoa.pessoaId || atual.leadId !== pessoa.leadId) throw new ErroRegra("O contato mudou enquanto você editava. Recarregue o painel e tente de novo.");
        const agora = capacidadesPainel(usuario, { finalidade: "COMERCIAL", veLead: atual.leadId !== null });
        if (!agora.editarTags || (entrada.tipo === "criar" && !agora.criarTag)) throw new ErroRegra("Você não tem acesso a esta função do CRM.");
      });
      if (mudou) await avisarAtendimento(tx, id);
      return { tagId };
    });
  });
}
export async function atribuirTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado> {
  const r = await executarTag(atendimentoId, { tipo: "atribuir", tagId }); return r.ok ? { ok: true } : r;
}
export async function removerTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado> {
  const r = await executarTag(atendimentoId, { tipo: "remover", tagId }); return r.ok ? { ok: true } : r;
}
export async function criarEAtribuirTagNoInbox(atendimentoId: string, nome: string): Promise<Resultado<{ tagId: string }>> {
  return executarTag(atendimentoId, { tipo: "criar", nome });
}
