import type { Prisma } from "@prisma/client";
import { extrairMencoes, gruposLexicaisMencao, type TokenMencao } from "@/lib/mencoes-nota";
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
  // O sentinel precede os grupos; tokens por ID nunca dependem do alias lexical.
  for (const p of [...(completos ? relevantes : []), ...selecionados]) unicos.set(p.id, p);
  const autorizados = new Map<string, UsuarioMencao>();
  const verificados = new Map<string, boolean>();
  const autorizar = async (p: UsuarioMencao): Promise<boolean> => {
    const anterior = verificados.get(p.id);
    if (anterior !== undefined) return anterior;
    const permitido = p.id !== autor.id && p.ativo && p.papeis.some(r => PAPEIS_INBOX.includes(r))
      && Boolean(await atendimentoVisivel(p, atendimentoId, false, tx));
    verificados.set(p.id, permitido);
    if (permitido) autorizados.set(p.id, p);
    return permitido;
  };
  for (const p of selecionados) await autorizar(p);
  if (completos) for (const grupos of gruposLexicaisMencao(livre, [...unicos.values()])) {
    for (const grupo of grupos) {
      let temAutorizado = false;
      // Nunca parar no primeiro membro: dois homonimos visiveis continuam ambiguos.
      for (const p of grupo) if (await autorizar(p)) temAutorizado = true;
      // Ambiguidade tambem impede fallback curto; so nenhum visivel tenta o proximo alias.
      if (temAutorizado) break;
    }
  }
  let ids: string[];
  try { ids = extrairMencoes(nota, [...autorizados.values()], tokens, completos); }
  catch { throw new ErroRegra("Confira as pessoas selecionadas na nota e tente novamente."); }
  for (const usuarioId of ids) await tx.notificacaoUsuario.create({ data: {
    id: idDaNotificacaoMencao(eventoId, usuarioId), usuarioId, tipo: "MENCAO_NOTA", refTipo: "AtendimentoWhatsApp", refId: atendimentoId,
    titulo: `${autor.nome} mencionou você numa nota`,
  } });
}
