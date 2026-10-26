import type { Prisma } from "@prisma/client";
import { ErroRegra, type UsuarioSessao } from "@/server/_shared/sessao";
import { escopoAtendimentos } from "@/server/whatsapp/escopo";
import { podeVerLeadNaThread } from "@/server/whatsapp/consultas-inbox";
import { capacidadesPainel } from "./permissoes";

/** Contexto de mutação: alvo vem da thread; o ID esperado é somente uma comparação CAS. */
export async function comOportunidadeDoInboxTx<T>(
  tx: Prisma.TransactionClient,
  sessao: UsuarioSessao,
  atendimentoId: string,
  oportunidadeIdEsperada: string,
  executar: (autor: UsuarioSessao, leadId: string) => Promise<T>,
): Promise<T> {
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${atendimentoId} FOR UPDATE`;
  const autor = { ...sessao, papeis: [...sessao.papeis] };
  const resolver = async () => {
    const fresco = await tx.usuario.findUnique({ where: { id: autor.id }, select: { nome: true, papeis: true, permissoes: true, ativo: true } });
    if (!fresco?.ativo) throw new ErroRegra("Sua sessão não está mais ativa.");
    Object.assign(autor, { nome: fresco.nome, papeis: fresco.papeis, permissoes: fresco.permissoes });
    const a = await tx.atendimentoWhatsApp.findFirst({
      where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(autor, { db: tx })] },
      select: { leadId: true, finalidade: true, conversa: { select: { contatoId: true } } },
    });
    if (!a || a.finalidade !== "COMERCIAL" || !a.conversa.contatoId) throw new ErroRegra("Oportunidade não disponível neste atendimento.");
    if (!a.leadId) throw new ErroRegra("Esta conversa não tem oportunidade.");
    if (a.leadId !== oportunidadeIdEsperada) throw new ErroRegra("A oportunidade mudou. Reabra o painel antes de confirmar.");
    const veLead = await podeVerLeadNaThread(autor, atendimentoId, a.leadId, Date.now(), tx);
    if (!veLead || !capacidadesPainel(autor, { finalidade: "COMERCIAL", veLead }).moverEtapa) throw new ErroRegra("Você não tem acesso a esta função do CRM.");
    return a.leadId;
  };
  const leadId = await resolver();
  await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${leadId} FOR UPDATE`;
  if (await resolver() !== leadId) throw new ErroRegra("A oportunidade mudou. Reabra o painel antes de confirmar.");
  return executar(autor, leadId);
}