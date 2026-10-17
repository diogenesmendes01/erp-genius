import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoAtendimentos } from "@/server/whatsapp/escopo";
import { whereBuscaConversas } from "@/server/whatsapp/busca-inbox";
import { preferenciasDoUsuario } from "@/server/whatsapp/preferencias-consulta";
import {
  contextoInclude, podeVerLeadNaThread, notasDoLead, resumirConversa,
  type ConversaResumo, type MensagemThread, type NotaInternaThread,
} from "@/server/whatsapp/consultas-inbox";
import { codificarCursor, decodificarCursor, type CursorInbox } from "./cursor";
import type { FiltrosInbox } from "./filtros";

export interface ItemListaInbox extends ConversaResumo {
  status: string; responsavelNome: string | null; prazoRespostaEm: string | null;
  fixada: boolean; silenciada: boolean; naoLidas: number; grupo: boolean;
}

const LIMITE_LISTA = 50;
const LIMITE_FIXADAS = 100;
const LIMITE_THREAD = 60;
const LIMITE_THREAD_MAX = 100;

/** Atendimentos com não lida PARA ESTE usuário (mesma regra de preferenciasDoUsuario), em qualquer posição da lista. */
async function idsComNaoLidaPessoal(usuarioId: string): Promise<string[]> {
  const linhas = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT a."id" FROM "AtendimentoWhatsApp" a
    LEFT JOIN "PreferenciaConversaUsuario" p ON p."conversaId" = a."conversaId" AND p."usuarioId" = ${usuarioId}
    WHERE p."marcadaNaoLida" = true
       OR (p."lidaAte" IS NULL AND a."naoLidas" > 0)
       OR (p."lidaAte" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "MensagemWhatsApp" m
            WHERE m."atendimentoId" = a."id" AND m."direcao" = 'ENTRADA' AND m."criadoEm" > p."lidaAte"))`);
  return linhas.map((l) => l.id);
}

/** Filtros da URL como condições; sempre combinadas com o escopo (nunca o substituem). */
async function condicoesDosFiltros(u: UsuarioSessao, f: FiltrosInbox): Promise<Prisma.AtendimentoWhatsAppWhereInput[]> {
  const c: Prisma.AtendimentoWhatsAppWhereInput[] = [];
  if (f.setor) c.push({ finalidade: f.setor });
  if (f.numeroId) c.push({ conversa: { numeroId: f.numeroId } });
  if (f.responsavel === "eu") c.push({ responsavelId: u.id });
  else if (f.responsavel === "fila") c.push({ responsavelId: null, encerradoEm: null });
  else if (f.responsavel) c.push({ responsavelId: f.responsavel });
  if (f.status) c.push({ status: f.status });
  if (f.prazoEstourado) c.push({ prazoRespostaEm: { lt: new Date() }, primeiraRespostaEm: null, encerradoEm: null });
  if (f.busca) c.push(whereBuscaConversas(f.busca));
  if (f.naoLidas) c.push({ id: { in: await idsComNaoLidaPessoal(u.id) } });
  return c;
}

const fixadaDoUsuario = (usuarioId: string): Prisma.AtendimentoWhatsAppWhereInput =>
  ({ conversa: { preferenciasUsuarios: { some: { usuarioId, fixadaEm: { not: null } } } } });

/** Condição "depois do cursor" na ordem (ultimaMensagemEm DESC NULLS LAST, id DESC). */
function depoisDoCursor(c: CursorInbox): Prisma.AtendimentoWhatsAppWhereInput {
  if (c.em === null) return { ultimaMensagemEm: null, id: { lt: c.id } };
  const em = new Date(c.em);
  return { OR: [{ ultimaMensagemEm: { lt: em } }, { ultimaMensagemEm: em, id: { lt: c.id } }, { ultimaMensagemEm: null }] };
}

/**
 * Página da lista do inbox (keyset). O escopo é sempre a base; filtros só restringem. Fixadas do usuário
 * vêm numa consulta própria, só na primeira página, e ficam fora das páginas por cursor.
 */
export async function listarAtendimentosPagina(
  u: UsuarioSessao, f: FiltrosInbox, cursor: string | null, limite = LIMITE_LISTA,
): Promise<{ itens: ItemListaInbox[]; proximo: string | null }> {
  const tamanho = Math.min(Math.max(Math.trunc(limite) || LIMITE_LISTA, 1), 200);
  const pos = cursor ? decodificarCursor(cursor) : null;
  const base: Prisma.AtendimentoWhatsAppWhereInput = { AND: [await escopoAtendimentos(u), ...await condicoesDosFiltros(u, f)] };
  const include = { ...contextoInclude, responsavel: { select: { nome: true } },
    mensagens: { orderBy: { criadoEm: "desc" as const }, take: 1, select: { corpo: true, tipo: true } } };

  const fixadas = pos ? [] : await prisma.atendimentoWhatsApp.findMany({
    where: { AND: [base, fixadaDoUsuario(u.id)] }, take: LIMITE_FIXADAS, include,
    orderBy: [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  });
  const naoFixada: Prisma.AtendimentoWhatsAppWhereInput = { NOT: fixadaDoUsuario(u.id) };
  const linhas = await prisma.atendimentoWhatsApp.findMany({
    where: { AND: [base, naoFixada, ...(pos ? [depoisDoCursor(pos)] : [])] }, take: tamanho + 1, include,
    orderBy: [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  });
  const temMais = linhas.length > tamanho;
  const pagina = linhas.slice(0, tamanho);
  const ultimo = pagina[pagina.length - 1];
  const proximo = temMais && ultimo ? codificarCursor({ em: ultimo.ultimaMensagemEm?.toISOString() ?? null, id: ultimo.id }) : null;

  const todas = [...fixadas, ...pagina];
  const prefs = await preferenciasDoUsuario(u.id, todas.map((a) => a.id));
  const itens = todas.map((a): ItemListaInbox => {
    const pref = prefs.get(a.id);
    return { ...resumirConversa(a), status: a.status, responsavelNome: a.responsavel?.nome ?? null,
      prazoRespostaEm: a.prazoRespostaEm?.toISOString() ?? null,
      fixada: pref?.fixada ?? false, silenciada: pref?.silenciada ?? false,
      naoLidas: pref?.naoLidas ?? a.naoLidas, grupo: !!a.conversa.grupoId };
  });
  return { itens, proximo };
}

const dataCursor = (m: { criadoEm: Date; id: string }) => codificarCursor({ em: m.criadoEm.toISOString(), id: m.id });

/**
 * Página da thread, ordem (criadoEm, id). Sem `antes`/`depois`: as mais recentes. `antes`: as anteriores
 * ao cursor. `depois`: as posteriores. Devolve em ordem cronológica; `antes`/`depois` são os cursores para
 * continuar (null quando não há mais naquele sentido; em `antes=` o sentido "depois" não é calculado).
 * 404 (null) fora do escopo.
 */
export async function listarMensagensPagina(
  u: UsuarioSessao, atendimentoId: string, o: { antes?: string; depois?: string; limite?: number } = {},
): Promise<{ mensagens: MensagemThread[]; notas: NotaInternaThread[]; antes: string | null; depois: string | null } | null> {
  const atendimento = await prisma.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(u)] },
    select: { id: true, finalidade: true, leadId: true },
  });
  if (!atendimento) return null;
  const tamanho = Math.min(Math.max(Math.trunc(o.limite ?? LIMITE_THREAD) || LIMITE_THREAD, 1), LIMITE_THREAD_MAX);
  const cAntes = o.antes ? decodificarCursor(o.antes) : null;
  const cDepois = !cAntes && o.depois ? decodificarCursor(o.depois) : null;
  const sentido = cDepois ? "asc" : "desc";
  const pos = cDepois ?? cAntes;
  const operador = sentido === "asc" ? "gt" : "lt";
  const dataPos = pos?.em ? new Date(pos.em) : null;
  const posicao: Prisma.MensagemWhatsAppWhereInput = pos && dataPos
    ? { OR: [{ criadoEm: { [operador]: dataPos } }, { criadoEm: dataPos, id: { [operador]: pos.id } }] } : {};
  const linhas = await prisma.mensagemWhatsApp.findMany({
    where: { AND: [{ atendimentoId: atendimento.id }, posicao] }, take: tamanho + 1,
    orderBy: [{ criadoEm: sentido }, { id: sentido }],
    include: { autor: { select: { nome: true } }, template: { select: { nome: true } },
      favoritosUsuarios: { where: { usuarioId: u.id }, select: { id: true } } },
  });
  const temMais = linhas.length > tamanho;
  const pagina = linhas.slice(0, tamanho);
  if (sentido === "desc") pagina.reverse();
  const mensagens: MensagemThread[] = pagina.map((m) => ({
    id: m.id, direcao: m.direcao, tipo: m.tipo, corpo: m.corpo, midiaPath: m.midiaPath, status: m.status, origem: m.origem,
    autorNome: m.autor?.nome ?? null, templateNome: m.template?.nome ?? null, criadoEm: m.criadoEm.toISOString(),
    participanteNome: m.participanteNome, favorita: m.favoritosUsuarios.length > 0, clientMessageId: m.clientMessageId }));
  const primeira = pagina[0], ultima = pagina[pagina.length - 1];
  // Notas internas só na primeira carga (sem cursor), e só para quem pode ver o lead (LC-L02).
  const verNotas = !pos && atendimento.finalidade === "COMERCIAL" && !!atendimento.leadId
    && await podeVerLeadNaThread(u, atendimento.id, atendimento.leadId, Date.now());
  const notas = verNotas ? await notasDoLead(atendimento.leadId!) : [];
  return {
    mensagens, notas,
    antes: sentido === "desc" && temMais && primeira ? dataCursor(primeira) : null,
    depois: sentido === "asc" && temMais && ultima ? dataCursor(ultima) : null,
  };
}
