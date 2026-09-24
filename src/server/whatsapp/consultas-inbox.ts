import { sugestoesPendentesDoLead, type SugestaoPendente } from "@/server/ia/consultas";
import { Papel, type EtapaLead, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { temPapel, transicaoManualPermitida, type UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";
import { escopoAtendimentos } from "./escopo";
import { LIMITE_CONVERSAS, LIMITE_NAO_LIDAS_FORA, mesclarPorRecencia, whereBuscaConversas } from "./busca-inbox";
import { atendimentoVisivel } from "./atendimentos";
import { INCLUDE_MATRICULA_DESTINO, resolverDestinoFinanceiroDaMatricula } from "./destinatario-financeiro";
import { contatoCorrespondeDestinoFinanceiro } from "./destinatario-atual";
import { carregarTrilhasVencimentoCivil, incluirFonteVencimentoCivil, referenciaVencimentoCivil, type ReferenciaVencimentoCivil } from "@/server/financeiro/vencimento-civil";

export interface ConversaResumo {
  /** Identificador de atendimento; o transporte e os demais assuntos não ficam expostos. */
  id: string; numeroId: string; numeroRotulo: string; finalidade: string; driver: string;
  contatoId: string; contatoNome: string; contatoTelefone: string; optOut: boolean;
  vinculo: string | null; naoLidas: number; ultimaMensagemEm: string | null; preview: string | null;
}
export interface MensagemThread {
  id: string; direcao: "ENTRADA" | "SAIDA"; tipo: string; corpo: string | null; midiaPath: string | null;
  status: string; origem: string | null; autorNome: string | null; templateNome: string | null; criadoEm: string;
}
export interface CobrancaAtivaThread {
  id: string; matriculaId: string; alunoId: string; alunoNome: string; moeda: string; vencimento: ReferenciaVencimentoCivil;
  valorNegociado: number; valorRecebido: number; saldo: number; status: string;
}
export interface NotaInternaThread { id: string; nota: string; autorNome: string | null; criadoEm: string }
export interface LeadNaThread {
  copilotoAtivo?: boolean; sugestoesIA?: SugestaoPendente[];
  id: string; nome: string; etapa: string; temperatura: string; dataExperimental: string | null;
  etapasPermitidas: string[]; notas: NotaInternaThread[];
}
export interface ThreadConversa {
  conversaId: string; finalidade: string; matricula: { id: string; codigo: string | null } | null; podeEnviar: boolean; podeVincular: boolean; podeReautorizar: boolean;
  pendenciaDestinatario: string | null;
  numero: { id: string; rotulo: string; driver: string; finalidade: string; sessao: string; ativo: boolean };
  contato: { id: string; nome: string; telefone: string; optOutEm: string | null;
    alunoId: string | null; alunoNome: string | null; responsavelId: string | null; responsavelNome: string | null;
    leadId: string | null; leadNome: string | null };
  janela24h: { aberta: boolean; fechaEm: string | null } | null;
  silencio: { ativo: boolean; ate: string | null }; cobrancaAtiva: CobrancaAtivaThread | null;
  lead: LeadNaThread | null; mensagens: MensagemThread[];
}
export interface PessoasVinculo {
  alunos: { id: string; nome: string }[];
  responsaveis: { id: string; nome: string }[];
  leads: { id: string; nome: string; codigo: string | null }[];
}

const contextoInclude = {
  matricula: { select: { id: true, codigo: true } },
  conversa: { include: { numero: true, contato: true } },
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
export async function listarConversasInbox(usuario: UsuarioSessao, { busca = "" }: { busca?: string } = {}): Promise<{ itens: ConversaResumo[]; limitada: boolean }> {
  const escopo = await escopoAtendimentos(usuario);
  const filtroBusca = whereBuscaConversas(busca);
  const where: Prisma.AtendimentoWhatsAppWhereInput = Object.keys(filtroBusca).length ? { AND: [escopo, filtroBusca] } : escopo;
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

type AtendimentoDaLista = Prisma.AtendimentoWhatsAppGetPayload<{ include: typeof contextoInclude & { mensagens: { select: { corpo: true; tipo: true } } } }>;

function resumirConversa(a: AtendimentoDaLista): ConversaResumo {
  const pedag = a.finalidade === "PEDAGOGICO";
  const nome = a.aluno ? nomeCompleto(a.aluno) : a.lead?.nome ?? (pedag ? "Atendimento pedagógico" : a.conversa.contato.nomeExibicao ?? "Contato institucional");
  const m = a.mensagens[0];
  return { id: a.id, numeroId: a.conversa.numeroId, numeroRotulo: pedag ? "Canal institucional" : a.conversa.numero.rotulo,
    finalidade: a.finalidade, driver: a.conversa.numero.driver, contatoId: a.conversa.contatoId,
    contatoNome: nome, contatoTelefone: pedag ? "" : a.conversa.contato.telefoneE164,
    optOut: !!a.conversa.contato.optOutEm, vinculo: a.finalidade === "FINANCEIRO" ? (a.matricula ? `matrícula · ${a.matricula.codigo ?? a.matricula.id}` : "Financeiro legado · matrícula não identificada")
      : pedag ? (a.matricula ? `matrícula · ${a.matricula.codigo ?? a.matricula.id}` : "Pedagógico legado · matrícula não identificada")
        : a.alunoId ? `aluno · ${nome}` : a.leadId ? `lead · ${nome}` : null,
    naoLidas: a.naoLidas, ultimaMensagemEm: a.ultimaMensagemEm?.toISOString() ?? null,
    preview: m ? m.tipo === "TEXTO" ? (m.corpo ?? "").slice(0, 90) : `[${m.tipo.toLowerCase()}]` : null };
}

export async function contarNaoLidas(usuario: UsuarioSessao): Promise<number> {
  const r = await prisma.atendimentoWhatsApp.aggregate({ where: await escopoAtendimentos(usuario), _sum: { naoLidas: true } });
  return r._sum.naoLidas ?? 0;
}

export async function carregarThread(usuario: UsuarioSessao, atendimentoId: string): Promise<ThreadConversa | null> {
  const a = await prisma.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(usuario)] },
    include: { ...contextoInclude, mensagens: { orderBy: { criadoEm: "desc" }, take: 300,
      include: { autor: { select: { nome: true } }, template: { select: { nome: true } } } } },
  });
  if (!a) return null;
  const pedag = a.finalidade === "PEDAGOGICO";
  const comercial = a.finalidade === "COMERCIAL";
  const financeiro = a.finalidade === "FINANCEIRO" && temPapel(usuario, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
  const c = a.conversa;
  const nome = a.aluno ? nomeCompleto(a.aluno) : a.lead?.nome ?? (pedag ? "Atendimento pedagógico" : c.contato.nomeExibicao ?? "Contato institucional");
  const agora = Date.now();
  const fechaEm = c.ultimoInboundEm ? new Date(c.ultimoInboundEm.getTime() + 24 * 3600_000) : null;
  const politica = financeiro ? await carregarPoliticaRegua() : null;
  const silencioAte = a.ultimoInboundEm && politica ? new Date(a.ultimoInboundEm.getTime() + politica.silencioPosInboundHoras * 3600_000) : null;
  const silencio = !!silencioAte && agora < silencioAte.getTime() && (!a.inboundTratadoEm || a.inboundTratadoEm < a.ultimoInboundEm!);
  const podeEnviar = !!await atendimentoVisivel(usuario, a.id, true);
  return { conversaId: a.id, finalidade: a.finalidade, matricula: financeiro || pedag ? a.matricula : null,
    podeEnviar,
    podeVincular: !pedag && temPapel(usuario, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR),
    podeReautorizar: temPapel(usuario, Papel.ADMINISTRADOR),
    pendenciaDestinatario: pedag && a.alunoId && !podeEnviar ? "A autorização ou o vínculo do destinatário precisa ser conferido antes de novo envio." : null,
    numero: { id: c.numeroId, rotulo: pedag ? "Canal institucional" : c.numero.rotulo, driver: c.numero.driver,
      finalidade: a.finalidade, sessao: c.numero.sessao, ativo: c.numero.ativo },
    contato: { id: c.contatoId, nome, telefone: pedag ? "" : c.contato.telefoneE164,
      optOutEm: c.contato.optOutEm?.toISOString() ?? null, alunoId: a.alunoId,
      alunoNome: a.aluno ? nomeCompleto(a.aluno) : null, responsavelId: null, responsavelNome: null,
      leadId: comercial ? a.leadId : null, leadNome: comercial ? a.lead?.nome ?? null : null },
    janela24h: c.numero.driver === "META_CLOUD" ? { aberta: !!fechaEm && agora < fechaEm.getTime(), fechaEm: fechaEm?.toISOString() ?? null } : null,
    silencio: { ativo: silencio, ate: silencio ? silencioAte!.toISOString() : null },
    cobrancaAtiva: financeiro && a.alunoId && a.matriculaId ? await cobrancaAtivaDoAtendimento(a.matriculaId, a.alunoId, c.contatoId) : null,
    lead: comercial && a.lead ? await leadNaThread(usuario, a.lead) : null,
    mensagens: [...a.mensagens].reverse().map((m) => ({ id: m.id, direcao: m.direcao, tipo: m.tipo, corpo: m.corpo,
      midiaPath: m.midiaPath, status: m.status, origem: m.origem, autorNome: m.autor?.nome ?? null,
      templateNome: m.template?.nome ?? null, criadoEm: m.criadoEm.toISOString() })) };
}

async function leadNaThread(usuario: UsuarioSessao, lead: { id: string; nome: string; etapa: EtapaLead; temperatura: string; dataExperimental: Date | null }): Promise<LeadNaThread> {
  const notas = await prisma.evento.findMany({ where: { agregadoTipo: "Lead", agregadoId: lead.id, tipo: "NotaInterna" },
    orderBy: { criadoEm: "desc" }, take: 20, include: { autor: { select: { nome: true } } } });
  const config = await prisma.configComercial.findUnique({ where: { id: "comercial" }, select: { copilotoAtivo: true } });
  const copilotoAtivo = !!config?.copilotoAtivo && temPapel(usuario, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL)
    && !!await prisma.lead.count({ where: { AND: [{ id: lead.id }, await escopoComercialAtual(usuario)] } });
  const sugestoesIA = copilotoAtivo ? await sugestoesPendentesDoLead(lead.id) : [];
  return { ...lead, copilotoAtivo, sugestoesIA, dataExperimental: lead.dataExperimental?.toISOString() ?? null,
    etapasPermitidas: ETAPAS_MANUAIS.filter((d) => d !== lead.etapa && transicaoManualPermitida(lead.etapa, d)),
    notas: notas.map((e) => ({ id: e.id, nota: typeof (e.payload as { nota?: unknown })?.nota === "string" ? (e.payload as { nota: string }).nota : "",
      autorNome: e.autor?.nome ?? null, criadoEm: e.criadoEm.toISOString() })) };
}

async function cobrancaAtivaDoAtendimento(matriculaId: string, alunoId: string, contatoId: string): Promise<CobrancaAtivaThread | null> {
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
    vazio.leads = await prisma.lead.findMany({ where: { AND: [await escopoComercialAtual(usuario), { nome: contem }] }, take: 5, select: { id: true, nome: true, codigo: true } });
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
