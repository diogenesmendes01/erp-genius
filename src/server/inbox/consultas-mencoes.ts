import { prisma } from "@/lib/prisma";
import { PAPEL_LABEL } from "@/lib/labels";
import type { CandidatoMencao } from "@/lib/mencoes-nota";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { atendimentoVisivel } from "@/server/whatsapp/atendimentos";
import { usuariosRelevantesParaMencao } from "./usuarios-mencoes";
import { normalizarParaOrdenacao } from "@/lib/nome-ordenacao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";

const normal = normalizarParaOrdenacao;
/** Busca limitada; nunca lista usuários antes de conferir leitura do solicitante. */
export async function listarCandidatosMencao(u: UsuarioSessao, id: string, busca: string): Promise<CandidatoMencao[] | null> {
  if (!await atendimentoVisivel(u, id)) return null;
  const q = normal(busca.trim());
  if (q.length < 2 || q.length > 60) return [];
  const pessoas = await usuariosRelevantesParaMencao(prisma, u.id, { busca: q });
  const saida: CandidatoMencao[] = [];
  for (const p of pessoas) {
    if (!p.ativo || p.id === u.id || !p.papeis.some(r => PAPEIS_INBOX.includes(r)) || !normal(p.nome).includes(q)) continue;
    if (!await atendimentoVisivel(p, id)) continue;
    saida.push({ id: p.id, nome: p.nome, descricao: p.papeis.filter(r => PAPEIS_INBOX.includes(r)).map(r => PAPEL_LABEL[r]).join(" · ") });
    if (saida.length === 20) break;
  }
  return saida;
}
