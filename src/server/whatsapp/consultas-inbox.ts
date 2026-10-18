import { Papel, type EtapaLead, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { temPapel, transicaoManualPermitida, type UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";
import { escopoAtendimentos } from "./escopo";
import { LIMITE_CONVERSAS, LIMITE_NAO_LIDAS_FORA, mesclarPorRecencia, whereBuscaConversas, whereCanalInbox, type CanalInbox } from "./busca-inbox";
import { ehLinhaComercial } from "./linha-comercial";
import { atendimentoVisivel } from "./atendimentos";
import { INCLUDE_MATRICULA_DESTINO, resolverDestinoFinanceiroDaMatricula } from "./destinatario-financeiro";
import { contatoCorrespondeDestinoFinanceiro } from "./destinatario-atual";
import { nomeDoAtendimento, nomeEFonteDoAtendimento, type FonteNome } from "./nome-contato";
import { carregarTrilhasVencimentoCivil, incluirFonteVencimentoCivil, referenciaVencimentoCivil, type ReferenciaVencimentoCivil } from "@/server/financeiro/vencimento-civil";
import { comContatoIndividual } from "./grupos";
import type { RecursoMotor } from "@/components/conversa/recursos-canal";
import { capacidadesDoNumero } from "./motor/capacidades";

export interface ConversaResumo {
  /** Identificador de atendimento; o transporte e os demais assuntos não ficam expostos. */
  id: string; numeroId: string; numeroRotulo: string; finalidade: string; driver: string;
  contatoId: string; contatoNome: string; contatoTelefone: string; optOut: boolean;
  vinculo: string | null; naoLidas: number; ultimaMensagemEm: string | null; preview: string | null;
  /** Conversa de linha comercial (SPEC-ERP-005): espelho do WhatsApp do vendedor. */
  linhaComercial: boolean;
}
export interface MensagemThread {
  id: string; direcao: "ENTRADA" | "SAIDA"; tipo: string; corpo: string | null; midiaPath: string | null;
  status: string; origem: string | null; autorNome: string | null; templateNome: string | null; criadoEm: string;
  /** Remetente em conversa de grupo (nulo em conversa individual). */
  participanteNome: string | null;
  /** Favorita do usuário da sessão (tabela pessoal). */
  favorita: boolean;
  clientMessageId: string | null;
  /** Saída escrita pelo usuário da sessão (editar/apagar só valem para as próprias); ausente conta como falso. */
  propria?: boolean;
  /** Apagada para todos pelo motor (`apagadaEm`); o corpo fica guardado. Ausente conta como falso. */
  apagada?: boolean;
}
export interface CobrancaAtivaThread {
  id: string; matriculaId: string; alunoId: string; alunoNome: string; moeda: string; vencimento: ReferenciaVencimentoCivil;
  valorNegociado: number; valorRecebido: number; saldo: number; status: string;
}
export interface NotaInternaThread { id: string; nota: string; autorNome: string | null; criadoEm: string }
export interface LeadNaThread {
  id: string; nome: string; etapa: string; temperatura: string; dataExperimental: string | null;
  etapasPermitidas: string[]; notas: NotaInternaThread[];
}
export interface ThreadConversa {
  conversaId: string; finalidade: string; matricula: { id: string; codigo: string | null } | null; podeEnviar: boolean; podeVincular: boolean; podeReautorizar: boolean;
  /** Editar o nome salvo do contato: fora do pedagógico e só se o usuário vê todos os atendimentos do contato. */
  podeEditarNome: boolean;
  /** Conversa de linha comercial; `podeCriarLead` = botão "Criar lead" (LC-D05). */
  linhaComercial: boolean; podeCriarLead: boolean;
  pendenciaDestinatario: string | null;
  numero: { id: string; rotulo: string; driver: string; finalidade: string; sessao: string; ativo: boolean };
  contato: { id: string; nome: string; telefone: string; optOutEm: string | null;
    /** Nome salvo no ERP e nome de perfil do WhatsApp; `fonteNome` diz qual dos cadastros está na tela. */
    nomeSalvo: string | null; nomePerfil: string | null; fonteNome: FonteNome;
    alunoId: string | null; alunoNome: string | null; responsavelId: string | null; responsavelNome: string | null;
    leadId: string | null; leadNome: string | null };
  janela24h: { aberta: boolean; fechaEm: string | null } | null;
  /** Recursos do motor que o número executa agora (`recursos={(r) => capacidades.includes(r)}` na tela). */
  capacidades: RecursoMotor[];
  silencio: { ativo: boolean; ate: string | null }; cobrancaAtiva: CobrancaAtivaThread | null;
  lead: LeadNaThread | null; mensagens: MensagemThread[];
}
export interface PessoasVinculo {
  alunos: { id: string; nome: string }[];
  responsaveis: { id: string; nome: string }[];
  leads: { id: string; nome: string; codigo: string | null }[];
}

export const contextoInclude = {
  matricula: { select: { id: true, codigo: true } },
  conversa: { include: { numero: { include: { setores: { select: { finalidade: true } } } }, contato: { include: { responsavel: { select: { nome: true } } } } } },
  aluno: { select: { id: true, primeiroNome: true, sobrenome: true } },
  lead: { select: { id: true, nome: true, etapa: true, temperatura: true, dataExperimental: true } },
} as const;

export async function listarConversas(usuario: UsuarioSessao): Promise<ConversaResumo[]> {
  return (await listarConversasInbox(usuario)).itens;
}

/**
 * Lista da inbox (E4): as LIMITE_CONVERSAS mais recentes e, se a lista foi cortada, também todas as
 * que têm não lidas — nenhuma conversa com mensagem por ler fica fora da lista. `busca` filtra no
 * servidor (nome do contato/aluno/lead ou telefone). `limitada` avisa a tela de que há mais antigas.
 */
export async function listarConversasInbox(usuario: UsuarioSessao, { busca = "", canal = "" }: { busca?: string; canal?: CanalInbox | "" } = {}): Promise<{ itens: ConversaResumo[]; limitada: boolean }> {
  const escopo = await escopoAtendimentos(usuario);
  // O filtro opcional só restringe o escopo obrigatório; nunca o substitui (doc 37).
  const filtros = [whereBuscaConversas(busca), whereCanalInbox(canal)].filter((f) => Object.keys(f).length);
  const where: Prisma.AtendimentoWhatsAppWhereInput = filtros.length ? { AND: [escopo, ...filtros] } : escopo;
  const orderBy = [{ ultimaMensagemEm: "desc" as const }, { criadoEm: "desc" as const }];
  const include = { ...contextoInclude, mensagens: { orderBy: { criadoEm: "desc" as const }, take: 1, select: { corpo: true, tipo: true } } };
  const recentes = await prisma.atendimentoWhatsApp.findMany({ where, take: LIMITE_CONVERSAS + 1, orderBy, include });
  const limitada = recentes.length > LIMITE_CONVERSAS;
  const lista = recentes.slice(0, LIMITE_CONVERSAS);
  const naoLidasFora = limitada
    ? await prisma.atendimentoWhatsApp.findMany({
        where: { AND: [where, { naoLidas: { gt: 0 } }, { id: { notIn: lista.map((a) => a.id) } }] },
        take: LIMITE_NAO_LIDAS_FORA, orderBy, include,
      })
    : [];
  // As não lidas de fora entram na MESMA ordem por recência, sem ir para o topo.
  // Sem reordenar por não-lidas aqui (ganho rápido 22 da auditoria): o polling de 30s da
  // inbox reconsulta a lista com frequência, e um agrupamento "não lidas primeiro" fazia a
  // conversa pular de posição sempre que naoLidas cruzava zero (lida em outra aba, nova
  // mensagem chegando) — a linha some debaixo do cursor de quem estava prestes a clicar. A
  // ordem já vem estável do banco (orderBy ultimaMensagemEm desc); o badge de não lidas
  // continua visível por linha, só não pula mais a lista inteira.
  return { itens: mesclarPorRecencia(lista, naoLidasFora).map(resumirConversa), limitada };
}

export type AtendimentoDaLista = Prisma.AtendimentoWhatsAppGetPayload<{ include: typeof contextoInclude & { mensagens: { select: { corpo: true; tipo: true } } } }>;

export function resumirConversa(atendimento: AtendimentoDaLista): ConversaResumo {
  const a = comContatoIndividual(atendimento);
  const pedag = a.finalidade === "PEDAGOGICO";
  const nome = nomeDoAtendimento(a);
  const m = a.mensagens[0];
  return { id: a.id, numeroId: a.conversa.numeroId, numeroRotulo: pedag ? "Canal institucional" : a.conversa.numero.rotulo,
    finalidade: a.finalidade, driver: a.conversa.numero.driver, contatoId: a.conversa.contato.id,
    contatoNome: nome, contatoTelefone: pedag ? "" : a.conversa.contato.telefoneE164,
    optOut: !!a.conversa.contato.optOutEm, vinculo: a.finalidade === "FINANCEIRO" ? (a.matricula ? `matrícula · ${a.matricula.codigo ?? a.matricula.id}` : "Financeiro legado · matrícula não identificada")
      : pedag ? (a.matricula ? `matrícula · ${a.matricula.codigo ?? a.matricula.id}` : "Pedagógico legado · matrícula não identificada")
        : a.alunoId ? `aluno · ${nome}` : a.leadId ? `lead · ${nome}` : null,
    naoLidas: a.naoLidas, ultimaMensagemEm: a.ultimaMensagemEm?.toISOString() ?? null,
    preview: m ? m.tipo === "TEXTO" ? (m.corpo ?? "").slice(0, 90) : `[${m.tipo.toLowerCase()}]` : null,
    linhaComercial: a.finalidade === "COMERCIAL" && ehLinhaComercial(a.conversa.numero) };
}

export async function contarNaoLidas(usuario: UsuarioSessao): Promise<number> {
  const r = await prisma.atendimentoWhatsApp.aggregate({ where: await escopoAtendimentos(usuario), _sum: { naoLidas: true } });
  return r._sum.naoLidas ?? 0;
}

export async function carregarThread(usuario: UsuarioSessao, atendimentoId: string): Promise<ThreadConversa | null> {
  const achado = await prisma.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(usuario)] },
    include: { ...contextoInclude, mensagens: { orderBy: { criadoEm: "desc" }, take: 300,
      include: { autor: { select: { nome: true } }, template: { select: { nome: true } },
        favoritosUsuarios: { where: { usuarioId: usuario.id }, select: { id: true } } } } },
  });
  if (!achado) return null;
  const a = comContatoIndividual(achado);
  const pedag = a.finalidade === "PEDAGOGICO";
  const comercial = a.finalidade === "COMERCIAL";
  const financeiro = a.finalidade === "FINANCEIRO" && temPapel(usuario, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
  const c = a.conversa;
  const { nome, fonte: fonteNome } = nomeEFonteDoAtendimento(a);
  const agora = Date.now();
  const fechaEm = c.ultimoInboundEm ? new Date(c.ultimoInboundEm.getTime() + 24 * 3600_000) : null;
  const politica = financeiro ? await carregarPoliticaRegua() : null;
  const silencio = silencioPosInbound(a, politica?.silencioPosInboundHoras ?? null, agora);
  const podeEnviar = !!await atendimentoVisivel(usuario, a.id, true);
  const linhaComercial = comercial && ehLinhaComercial(c.numero);
  // LC-L02: ver a conversa pela linha não abre o lead de outra carteira (etapa, notas, copiloto).
  const verLead = comercial && !!a.leadId && await podeVerLeadNaThread(usuario, a.id, a.leadId, agora);
  return { conversaId: a.id, finalidade: a.finalidade, matricula: financeiro || pedag ? a.matricula : null,
    podeEnviar, linhaComercial,
    ...regrasCadastroDoAtendimento(usuario, a, linhaComercial),
    podeReautorizar: temPapel(usuario, Papel.ADMINISTRADOR),
    podeEditarNome: !pedag && await contatoSoNoAlcance(usuario, c.contato.id),
    pendenciaDestinatario: pedag && a.alunoId && !podeEnviar ? "A autorização ou o vínculo do destinatário precisa ser conferido antes de novo envio." : null,
    numero: { id: c.numeroId, rotulo: pedag ? "Canal institucional" : c.numero.rotulo, driver: c.numero.driver,
      finalidade: a.finalidade, sessao: c.numero.sessao, ativo: c.numero.ativo },
    contato: { id: c.contato.id, nome, telefone: pedag ? "" : c.contato.telefoneE164,
      nomeSalvo: pedag ? null : c.contato.nomeExibicao, nomePerfil: pedag ? null : c.contato.nomePerfil, fonteNome,
      optOutEm: c.contato.optOutEm?.toISOString() ?? null, alunoId: a.alunoId,
      alunoNome: a.aluno ? nomeCompleto(a.aluno) : null, responsavelId: null, responsavelNome: null,
      leadId: verLead ? a.leadId : null, leadNome: verLead ? a.lead?.nome ?? null : null },
    capacidades: capacidadesDoNumero({ driver: c.numero.driver, ativo: c.numero.ativo, sessao: c.numero.sessao }),
    janela24h: c.numero.driver === "META_CLOUD" ? { aberta: !!fechaEm && agora < fechaEm.getTime(), fechaEm: fechaEm?.toISOString() ?? null } : null,
    silencio,
    cobrancaAtiva: financeiro && a.alunoId && a.matriculaId ? await cobrancaAtivaDoAtendimento(a.matriculaId, a.alunoId, c.contato.id) : null,
    lead: verLead && a.lead ? await leadNaThread(a.lead) : null,
    mensagens: [...a.mensagens].reverse().map((m) => ({ id: m.id, direcao: m.direcao, tipo: m.tipo, corpo: m.corpo,
      midiaPath: m.midiaPath, status: m.status, origem: m.origem, autorNome: m.autor?.nome ?? null,
      templateNome: m.template?.nome ?? null, criadoEm: m.criadoEm.toISOString(),
      participanteNome: m.participanteNome, favorita: m.favoritosUsuarios.length > 0, clientMessageId: m.clientMessageId,
      propria: m.direcao === "SAIDA" && m.autorId === usuario.id, apagada: !!m.apagadaEm })) };
}

/** Botões de cadastro da conversa (os do Inbox antigo): criar lead/oportunidade só em linha comercial sem lead e aberta; vincular fora do pedagógico. */
export function regrasCadastroDoAtendimento(
  usuario: UsuarioSessao, a: { finalidade: string; leadId: string | null; encerradoEm: Date | null }, linhaComercial: boolean,
): { podeCriarLead: boolean; podeVincular: boolean } {
  return {
    podeCriarLead: linhaComercial && !a.leadId && !a.encerradoEm
      && temPapel(usuario, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.ADMINISTRADOR),
    podeVincular: a.finalidade !== "PEDAGOGICO" && temPapel(usuario, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR),
  };
}

/** Silêncio da régua depois de uma resposta do contato (S4) que ninguém tratou. */
export function silencioPosInbound(
  a: { ultimoInboundEm: Date | null; inboundTratadoEm: Date | null }, horas: number | null, agora: number,
): { ativo: boolean; ate: string | null } {
  const ate = a.ultimoInboundEm && horas !== null ? new Date(a.ultimoInboundEm.getTime() + horas * 3600_000) : null;
  const ativo = !!ate && agora < ate.getTime() && (!a.inboundTratadoEm || a.inboundTratadoEm < a.ultimoInboundEm!);
  return { ativo, ate: ativo ? ate!.toISOString() : null };
}

/** Ações de cadastro e de cobrança do painel lateral do Inbox novo; mesmas regras e alçadas da thread do Inbox antigo. Sem telefone (regra 5). */
export interface AcoesContatoInbox {
  contatoId: string; contatoNome: string;
  nomeSalvo: string | null; nomePerfil: string | null; fonteNome: FonteNome;
  alunoId: string | null;
  /** Oportunidade do atendimento, só para quem a vê (LC-L02); o link é /funil?o=<id>. */
  leadId: string | null;
  podeCriarLead: boolean; podeVincular: boolean; podeEditarNome: boolean;
  /** Só no FINANCEIRO e para FINANCEIRO/SECRETARIA_ACADEMICA (as alçadas de marcarConversaTratada). */
  cobranca: { silencio: { ativo: boolean; ate: string | null }; ativa: CobrancaAtivaThread | null } | null;
}

/** null fora do escopo do usuário e em conversa de grupo (sem contato individual). */
export async function carregarAcoesContatoInbox(usuario: UsuarioSessao, atendimentoId: string): Promise<AcoesContatoInbox | null> {
  const achado = await prisma.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(usuario)] }, include: contextoInclude,
  });
  if (!achado || !achado.conversa.contato) return null;
  const a = comContatoIndividual(achado);
  const pedag = a.finalidade === "PEDAGOGICO";
  const comercial = a.finalidade === "COMERCIAL";
  const financeiro = a.finalidade === "FINANCEIRO" && temPapel(usuario, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
  const c = a.conversa;
  const agora = Date.now();
  const { nome, fonte } = nomeEFonteDoAtendimento(a);
  const linhaComercial = comercial && ehLinhaComercial(c.numero);
  const verLead = comercial && !!a.leadId && await podeVerLeadNaThread(usuario, a.id, a.leadId, agora);
  const politica = financeiro ? await carregarPoliticaRegua() : null;
  return {
    contatoId: c.contato.id, contatoNome: nome,
    nomeSalvo: pedag ? null : c.contato.nomeExibicao, nomePerfil: pedag ? null : c.contato.nomePerfil, fonteNome: fonte,
    alunoId: a.alunoId, leadId: verLead ? a.leadId : null,
    ...regrasCadastroDoAtendimento(usuario, a, linhaComercial),
    podeEditarNome: !pedag && await contatoSoNoAlcance(usuario, c.contato.id),
    cobranca: financeiro ? {
      silencio: silencioPosInbound(a, politica?.silencioPosInboundHoras ?? null, agora),
      ativa: a.alunoId && a.matriculaId ? await cobrancaAtivaDoAtendimento(a.matriculaId, a.alunoId, c.contato.id) : null,
    } : null,
  };
}

/**
 * Quem já via o lead antes da SPEC-ERP-005 continua vendo: administração, carteira/equipe/cobertura
 * atual e participante vigente do atendimento. Só o acesso "pela linha" não mostra o painel.
 */
export async function podeVerLeadNaThread(usuario: UsuarioSessao, atendimentoId: string, leadId: string, agora: number): Promise<boolean> {
  if (temPapel(usuario, Papel.ADMINISTRADOR)) return true;
  if (temPapel(usuario, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL)
    && await prisma.oportunidade.count({ where: { AND: [{ id: leadId }, await escopoComercialAtual(usuario)] } })) return true;
  const instante = new Date(agora);
  return !!await prisma.participanteAtendimentoWhatsApp.count({ where: {
    atendimentoId, usuarioId: usuario.id, inicio: { lte: instante }, fim: { gt: instante }, revogadoEm: null,
  } });
}

/** Linhas comerciais de que o usuário é dono — estado da sessão em leitura (LC §5.5, doc 37). */
export interface LinhaDoUsuario { id: string; rotulo: string; telefoneE164: string; driver: string; sessao: string }

export async function listarLinhasDoUsuario(usuario: UsuarioSessao): Promise<LinhaDoUsuario[]> {
  if (!temPapel(usuario, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL)) return [];
  return prisma.numeroWhatsApp.findMany({
    where: { donoId: usuario.id, finalidade: "VENDAS", ativo: true },
    orderBy: { criadoEm: "asc" },
    select: { id: true, rotulo: true, telefoneE164: true, driver: true, sessao: true },
  });
}

/** Notas internas do lead (Evento NotaInterna), mais recentes primeiro. */
export async function notasDoLead(leadId: string): Promise<NotaInternaThread[]> {
  const notas = await prisma.evento.findMany({ where: { agregadoTipo: "Lead", agregadoId: leadId, tipo: "NotaInterna" },
    orderBy: { criadoEm: "desc" }, take: 20, include: { autor: { select: { nome: true } } } });
  return notas.map((e) => ({ id: e.id, nota: typeof (e.payload as { nota?: unknown })?.nota === "string" ? (e.payload as { nota: string }).nota : "",
    autorNome: e.autor?.nome ?? null, criadoEm: e.criadoEm.toISOString() }));
}

async function leadNaThread(lead: { id: string; nome: string; etapa: EtapaLead; temperatura: string; dataExperimental: Date | null }): Promise<LeadNaThread> {
  return { ...lead, dataExperimental: lead.dataExperimental?.toISOString() ?? null,
    etapasPermitidas: ETAPAS_MANUAIS.filter((d) => d !== lead.etapa && transicaoManualPermitida(lead.etapa, d)),
    notas: await notasDoLead(lead.id) };
}

export async function cobrancaAtivaDoAtendimento(matriculaId: string, alunoId: string, contatoId: string): Promise<CobrancaAtivaThread | null> {
  const contato = await prisma.contatoWhatsApp.findUnique({ where: { id: contatoId } });
  if (!contato) return null;
  const matricula = await prisma.matricula.findFirst({ where: { id: matriculaId, alunoId }, include: INCLUDE_MATRICULA_DESTINO });
  const destino = matricula && resolverDestinoFinanceiroDaMatricula(matricula);
  if (!destino || !contatoCorrespondeDestinoFinanceiro(contato, destino)) return null;
  const c = await prisma.cobranca.findFirst({ where: { matriculaId, status: { in: ["PENDENTE", "ATRASADO"] }, matricula: { alunoId } },
    orderBy: [{ vencimento: "asc" }, { id: "asc" }], include: { ...incluirFonteVencimentoCivil, matricula: { include: { aluno: true } } } });
  if (!c) return null;
  const trilhas = await carregarTrilhasVencimentoCivil(prisma, [c.id], [c.matriculaId]);
  return { id: c.id, matriculaId: c.matriculaId, alunoId, alunoNome: nomeCompleto(c.matricula.aluno), moeda: c.moeda,
    vencimento: referenciaVencimentoCivil({ ...c, aplicacoesAditivoVencimento: trilhas.vencimentosPorCobranca.get(c.id), aplicacoesM01: trilhas.m01PorCobranca.get(c.id), retomadasReprogramadas: trilhas.retomadasReprogramadas }), valorNegociado: Number(c.valorNegociado), valorRecebido: Number(c.valorRecebido ?? 0),
    saldo: Number(c.saldo ?? c.valorNegociado.minus(c.valorRecebido ?? 0)), status: c.status };
}

/** O contexto é obrigatório: busca comercial não vira diretório de alunos/responsáveis. */
export async function buscarPessoasVinculo(usuario: UsuarioSessao, q: string, atendimentoId?: string): Promise<PessoasVinculo> {
  const vazio: PessoasVinculo = { alunos: [], responsaveis: [], leads: [] };
  const a = atendimentoId ? await atendimentoVisivel(usuario, atendimentoId, true) : null;
  if (!a || q.trim().length < 2 || a.finalidade === "PEDAGOGICO") return vazio;
  const contem = { contains: q.trim(), mode: "insensitive" as const };
  if (a.finalidade === "COMERCIAL" && temPapel(usuario, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL)) {
    vazio.leads = await prisma.oportunidade.findMany({ where: { AND: [await escopoComercialAtual(usuario), { nome: contem }] }, take: 5, select: { id: true, nome: true, codigo: true } });
  }
  if (temPapel(usuario, Papel.SECRETARIA_ACADEMICA) && (a.finalidade === "SECRETARIA" || a.finalidade === "FINANCEIRO")) {
    const alunos = await prisma.aluno.findMany({ where: { OR: [{ primeiroNome: contem }, { sobrenome: contem }] }, take: 5, select: { id: true, primeiroNome: true, sobrenome: true } });
    vazio.alunos = alunos.map((x) => ({ id: x.id, nome: nomeCompleto(x) }));
    // Não lista responsáveis de irmãos sem o aluno específico do atendimento.
    if (a.alunoId) vazio.responsaveis = await prisma.responsavel.findMany({ where: { nome: contem, alunos: { some: { alunoId: a.alunoId,
      ...(a.finalidade === "FINANCEIRO" ? { papel: "FINANCEIRO" as const } : {}) } } }, take: 5, select: { id: true, nome: true } });
  }
  return vazio;
}

export const conversaVisivel = atendimentoVisivel;

/**
 * O contato é compartilhado entre linhas e finalidades: alterá-lo (ex.: o nome salvo) só cabe a quem
 * enxerga TODOS os atendimentos dele — senão a mudança apareceria na área de outra equipe.
 */
export async function contatoSoNoAlcance(usuario: UsuarioSessao, contatoId: string): Promise<boolean> {
  if (temPapel(usuario, Papel.ADMINISTRADOR)) return true;
  const fora = await prisma.atendimentoWhatsApp.count({ where: { conversa: { contatoId }, NOT: await escopoAtendimentos(usuario) } });
  return fora === 0;
}
