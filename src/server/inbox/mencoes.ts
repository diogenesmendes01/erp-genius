import type { Prisma } from "@prisma/client";
import { extrairMencoes, type TokenMencao } from "@/lib/mencoes-nota";
import { normalizarParaOrdenacao } from "@/lib/nome-ordenacao";
import { ErroRegra, type UsuarioSessao } from "@/server/_shared/sessao";
import { atendimentoVisivel } from "@/server/whatsapp/atendimentos";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { usuariosRelevantesParaMencao, type UsuarioMencao } from "./usuarios-mencoes";
export { extrairMencoes } from "@/lib/mencoes-nota";

/** Tupla JSON é inequívoca mesmo se um ID contiver separadores. Nunca vai ao texto público. */
export const idDaNotificacaoMencao = (eventoId: string, usuarioId: string) => `mencao-nota:${JSON.stringify([eventoId, usuarioId])}`;

/** Somente primeira criação da nota: todos os dados/ACL na mesma transação, inclusive pool1. */
export async function notificarMencoesNaNota(tx: Prisma.TransactionClient, entrada: { atendimentoId: string; eventoId: string; autor: UsuarioSessao; nota: string; mencoes?: readonly TokenMencao[] }): Promise<void> {
  const { autor, nota, atendimentoId, eventoId } = entrada;
  const tokens = entrada.mencoes ?? [];
  let livre = nota;
  for (const t of [...tokens].reverse()) livre = livre.slice(0, t.inicio) + " ".repeat(t.fim - t.inicio) + livre.slice(t.fim);
  const primeiros = [...new Set([...livre.matchAll(/(?<![\p{L}\p{N}_@.])@([\p{L}\p{M}][\p{L}\p{M}'’-]*)/gu)].map(m => normalizarParaOrdenacao(m[1])))];
  const relevantes = primeiros.length ? await usuariosRelevantesParaMencao(tx, autor.id, { primeiros }) : [];
  const selecionados = tokens.length ? await tx.usuario.findMany({
    where: { id: { in: [...new Set(tokens.map(t => t.usuarioId))] } },
    select: { id: true, nome: true, ativo: true, papeis: true, permissoes: true },
  }) : [];
  const completos = relevantes.length <= 200;
  const unicos = new Map<string, UsuarioMencao>();
  for (const p of [...(completos ? relevantes : []), ...selecionados]) unicos.set(p.id, p);
  const autorizados: UsuarioMencao[] = [];
  for (const p of unicos.values()) {
    if (p.id === autor.id || !p.ativo || !p.papeis.some(r => PAPEIS_INBOX.includes(r))) continue;
    if (await atendimentoVisivel(p, atendimentoId, false, tx)) autorizados.push(p);
  }
  let ids: string[];
  try { ids = extrairMencoes(nota, autorizados, tokens, completos); }
  catch { throw new ErroRegra("Confira as pessoas selecionadas na nota e tente novamente."); }
  for (const usuarioId of ids) await tx.notificacaoUsuario.create({ data: {
    id: idDaNotificacaoMencao(eventoId, usuarioId), usuarioId, tipo: "MENCAO_NOTA", refTipo: "AtendimentoWhatsApp", refId: atendimentoId,
    titulo: `${autor.nome} mencionou você numa nota`,
  } });
}
