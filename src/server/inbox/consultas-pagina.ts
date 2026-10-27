import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoAtendimentos } from "@/server/whatsapp/escopo";
import { setoresDeNumero } from "@/server/whatsapp/numero-setor";
import type { Setor } from "@/server/whatsapp/setor";
import {
  contextoInclude, podeVerLeadNaThread, notasDoLead, resumirConversa,
  type ConversaResumo, type MensagemThread, type NotaInternaThread,
} from "@/server/whatsapp/consultas-inbox";
import { capacidadesDoNumero } from "@/server/whatsapp/motor/capacidades";
import { notasInternasDoAtendimento } from "@/server/whatsapp/notas-consulta";
import type { RecursoMotor } from "@/components/conversa/recursos-canal";
import { codificarCursor, decodificarCursor } from "./cursor";
import type { ContagensChipsInbox, FiltrosInbox } from "./filtros";
import { resolverOperacaoListaInbox, type OperacaoListaInbox, type OpcoesOperacaoInbox } from "./contexto-lista";
import { condicoesWhereDosFiltros } from "./filtros-sql";
import { selecionarIdsPaginaInbox, preferenciasDaPaginaSql, contarLegadosComContexto } from "./consulta-sql";
import { idsHandoffPendente, sugestoesPendentesPorAtendimento, derivarEstadoAria, linhaEstadoDe, type EstadoAria } from "./estado-aria";
import { autorDaPrevia, type AutorPrevia } from "./previa";

export interface ItemListaInbox extends ConversaResumo {
  estadoAria: EstadoAria | null; atendidoPorVoce: boolean; previaAutor: AutorPrevia | null; previaRotulo: string | null;
  status: string; responsavelNome: string | null; prazoRespostaEm: string | null;
  fixada: boolean; silenciada: boolean; naoLidas: number; grupo: boolean;
  responsavelId: string | null; numeroDonoId: string | null; setoresDoNumero: Setor[]; atendimentoOrigemId: string | null;
  capacidades: RecursoMotor[];
}

const LIMITE_LISTA = 50;
const LIMITE_THREAD = 60;
const LIMITE_THREAD_MAX = 100;

export async function contarChipsInbox(u:UsuarioSessao,f:FiltrosInbox,o:OpcoesOperacaoInbox={}):Promise<ContagensChipsInbox> {
  const op=resolverOperacaoListaInbox(u,o);
  const ctx=f.aria?await op.global():{db:op.db,usuarioId:op.usuarioId,agora:op.agora,escopo:await op.escopo()};
  return contarLegadosComContexto(ctx,f);
}
export async function listarAtendimentosPagina(u:UsuarioSessao,f:FiltrosInbox,cursor:string|null,limite=LIMITE_LISTA,o:OpcoesOperacaoInbox={}):Promise<{itens:ItemListaInbox[];proximo:string|null}> {
  const op=resolverOperacaoListaInbox(u,o),tamanho=Math.min(Math.max(Math.trunc(limite)||LIMITE_LISTA,1),200);
  const pos=cursor?decodificarCursor(cursor):null;
  const ctx=f.aria?await op.global():{db:op.db,usuarioId:op.usuarioId,agora:op.agora,escopo:await op.escopo()};
  const {fixadas,normais}=await selecionarIdsPaginaInbox(ctx,f,pos,tamanho);
  const pagina=normais.slice(0,tamanho),ultimo=pagina.at(-1);
  const proximo=normais.length>tamanho&&ultimo?codificarCursor({em:ultimo.ultimaMensagemEm?.toISOString()??null,id:ultimo.id}):null;
  const ids=[...new Set([...fixadas,...pagina].map(a=>a.id))];
  if(!ids.length)return {itens:[],proximo};
  const linhas=await op.db.atendimentoWhatsApp.findMany({
    where:{AND:[{id:{in:ids}},await op.escopo(),...condicoesWhereDosFiltros(u.id,f,op.agora)]},include:includeLista,
  });
  const porId=new Map(linhas.map(a=>[a.id,a]));
  const ordenadas=ids.flatMap(id=>{const a=porId.get(id);return a?[a]:[];});
  const itens=(await montarItens(op,ordenadas)).filter(a=>(!f.aria||a.estadoAria===f.aria)&&(!f.naoLidas||a.naoLidas>0));
  return {itens,proximo};
}

type LinhaLista = Awaited<ReturnType<typeof prisma.atendimentoWhatsApp.findMany<{ include: typeof includeLista }>>>[number];
const includeLista = { ...contextoInclude, responsavel: { select: { nome: true } },
  mensagens: { orderBy: [{ criadoEm: "desc" as const }, { id: "desc" as const }], take: 1,
    select: { corpo: true, tipo: true, direcao: true, origem: true, autorId: true, criadoEm: true, autor: { select: { nome: true } } } } };

async function montarItens(op:OperacaoListaInbox, todas:LinhaLista[]):Promise<ItemListaInbox[]> {
  if(!todas.length)return [];
  const {db,usuarioId,agora}=op,ids=[...new Set(todas.map(a=>a.id))];
  const global=await op.global();
  const ctx={ariaAtiva:global.ariaAtiva,agora,handoffPendentes:new Set(await idsHandoffPendente(db,ids))};
  const pendentes=await sugestoesPendentesPorAtendimento(db,ids,agora);
  const prefs=await preferenciasDaPaginaSql(db,usuarioId,ids,agora);
  return todas.map((a): ItemListaInbox => {
    const pref = prefs.get(a.id), mensagem = a.mensagens[0];
    const previa = autorDaPrevia(mensagem ? { ...mensagem, autorNome: mensagem.autor?.nome ?? null } : null, pendentes.get(a.id) ?? null, usuarioId);
    return { ...resumirConversa(a), status: a.status, responsavelNome: a.responsavel?.nome ?? null,
      estadoAria: derivarEstadoAria(linhaEstadoDe(a), ctx, pendentes.has(a.id)), atendidoPorVoce: a.responsavelId === usuarioId,
      previaAutor: previa.autor, previaRotulo: previa.rotulo,
      prazoRespostaEm: a.prazoRespostaEm?.toISOString() ?? null,
      fixada: pref?.fixada ?? false, silenciada: pref?.silenciada ?? false,
      naoLidas: pref?.naoLidas ?? a.naoLidas, grupo: !!a.conversa.grupoId,
      responsavelId: a.responsavelId, numeroDonoId: a.conversa.numero.donoId, setoresDoNumero: setoresDeNumero(a.conversa.numero),
      atendimentoOrigemId: a.atendimentoOrigemId,
      capacidades: capacidadesDoNumero({ driver: a.conversa.numero.driver, ativo: a.conversa.numero.ativo, sessao: a.conversa.numero.sessao }) };
  });
}

export async function obterItemListaInbox(u:UsuarioSessao,atendimentoId:string,o:OpcoesOperacaoInbox={}):Promise<ItemListaInbox|null> {
  const op=resolverOperacaoListaInbox(u,o);
  const a=await op.db.atendimentoWhatsApp.findFirst({where:{AND:[{id:atendimentoId},await op.escopo()]},include:includeLista});
  return a?(await montarItens(op,[a]))[0]!:null;
}

const dataCursor = (m: { criadoEm: Date; id: string }) => codificarCursor({ em: m.criadoEm.toISOString(), id: m.id });

export async function listarMensagensPagina(
  u: UsuarioSessao, atendimentoId: string, o: { antes?: string; depois?: string; limite?: number } = {},
): Promise<{ mensagens: MensagemThread[]; notas: NotaInternaThread[] | null; antes: string | null; depois: string | null; temMais: boolean } | null> {
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
  if (pos && pos.em === null) return null;
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
    participanteNome: m.participanteNome, favorita: m.favoritosUsuarios.length > 0, clientMessageId: m.clientMessageId,
    propria: m.direcao === "SAIDA" && m.autorId === u.id, apagada: !!m.apagadaEm }));
  const primeira = pagina[0], ultima = pagina[pagina.length - 1];
  const verNotasLead = !cAntes && atendimento.finalidade === "COMERCIAL" && !!atendimento.leadId
    && await podeVerLeadNaThread(u, atendimento.id, atendimento.leadId, Date.now());
  const notas = cAntes ? null : [
    ...await notasInternasDoAtendimento(atendimento.id),
    ...(verNotasLead ? await notasDoLead(atendimento.leadId!) : []),
  ].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));
  return {
    mensagens, notas,
    antes: primeira ? dataCursor(primeira) : null,
    depois: ultima ? dataCursor(ultima) : null,
    temMais,
  };
}
