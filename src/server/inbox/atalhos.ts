import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoAtendimentos, PAPEIS_INBOX, type Db } from "@/server/whatsapp/escopo";

export type ConversaParaAbrir = { atendimentoId: string; aberta: boolean };
type AlvoConversa = { atendimentoId?: string | null; leadId?: string | null; pessoaId?: string | null };
const INDIVIDUAL: Prisma.AtendimentoWhatsAppWhereInput = { conversa: { contatoId: { not: null }, grupoId: null } };
const ORDEM = [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { id: "desc" }] satisfies Prisma.AtendimentoWhatsAppOrderByWithRelationInput[];
const podeConsultar = (u: UsuarioSessao) => !!u?.id && u.papeis.some(p => PAPEIS_INBOX.includes(p));

export async function atendimentoParaAbrir(u: UsuarioSessao, alvo: AlvoConversa, db: Db = prisma): Promise<ConversaParaAbrir | null> {
  if (!podeConsultar(u) || !(alvo.atendimentoId || alvo.leadId || alvo.pessoaId)) return null;
  const escopo = await escopoAtendimentos(u, { db });
  const buscar = (onde: Prisma.AtendimentoWhatsAppWhereInput) => db.atendimentoWhatsApp.findFirst({
    where: { AND: [escopo, INDIVIDUAL, onde] }, select: { id: true, status: true }, orderBy: ORDEM,
  });
  let a = alvo.atendimentoId ? await buscar({ id: alvo.atendimentoId }) : null;
  if (!a && alvo.leadId) a = await buscar({ leadId: alvo.leadId, status: { not: "ENCERRADO" } });
  if (!a && alvo.pessoaId) a = await buscar({ conversa: { contato: { pessoaId: alvo.pessoaId } }, status: { not: "ENCERRADO" } });
  if (!a) {
    const fontes: Prisma.AtendimentoWhatsAppWhereInput[] = [];
    if (alvo.leadId) fontes.push({ leadId: alvo.leadId });
    if (alvo.pessoaId) fontes.push({ conversa: { contato: { pessoaId: alvo.pessoaId } } });
    if (fontes.length) a = await buscar({ status: "ENCERRADO", OR: fontes });
  }
  return a ? { atendimentoId: a.id, aberta: a.status !== "ENCERRADO" } : null;
}

type CursorAtendimento = { id: string; ultimaMensagemEm: Date | null };
function depoisDe(cursor: CursorAtendimento): Prisma.AtendimentoWhatsAppWhereInput {
  return cursor.ultimaMensagemEm === null
    ? { ultimaMensagemEm: null, id: { lt: cursor.id } }
    : { OR: [
      { ultimaMensagemEm: { lt: cursor.ultimaMensagemEm } },
      { ultimaMensagemEm: cursor.ultimaMensagemEm, id: { lt: cursor.id } },
      { ultimaMensagemEm: null },
    ] };
}

export async function atendimentosParaPessoas(u: UsuarioSessao, pessoaIds: readonly string[], db: Db = prisma): Promise<Map<string, ConversaParaAbrir>> {
  const achados = new Map<string, ConversaParaAbrir>();
  const pendentes = new Set(pessoaIds.filter(Boolean));
  if (!podeConsultar(u) || !pendentes.size) return achados;
  const escopo = await escopoAtendimentos(u, { db });
  for (const encerrado of [false, true]) {
    let cursor: CursorAtendimento | null = null;
    while (pendentes.size) {
      const pagina: (CursorAtendimento & { status: string; conversa: { contato: { pessoaId: string | null } | null } })[] = await db.atendimentoWhatsApp.findMany({
        where: { AND: [
          escopo, INDIVIDUAL,
          { conversa: { contato: { pessoaId: { in: [...pendentes] } } } },
          { status: encerrado ? "ENCERRADO" : { not: "ENCERRADO" } },
          ...(cursor ? [depoisDe(cursor)] : []),
        ] },
        select: { id: true, status: true, ultimaMensagemEm: true, conversa: { select: { contato: { select: { pessoaId: true } } } } },
        orderBy: ORDEM, take: 100,
      });
      for (const a of pagina) {
        const pessoaId = a.conversa.contato?.pessoaId;
        if (pessoaId && pendentes.delete(pessoaId)) achados.set(pessoaId, { atendimentoId: a.id, aberta: a.status !== "ENCERRADO" });
      }
      if (pagina.length < 100) break;
      cursor = pagina[pagina.length - 1];
    }
  }
  return achados;
}
