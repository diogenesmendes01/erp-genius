import { Papel, StatusCobranca, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { temPapel, type UsuarioSessao } from "@/server/_shared";
import { numero as decimalParaNumero, numeroOuNull } from "@/server/_shared/decimal";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";
import { MODOS_FABRICA, POLITICA_COBRANCA_NOME } from "@/server/cobrancas/fabrica";
import { REGUA } from "@/server/cobrancas/regua";
import { escopoLeads } from "@/server/comercial/consultas";
import { escopoConversas, escopoNumeros } from "./escopo";

// Leituras da inbox (doc 26 §Camada 3) e das telas de config do canal (doc 30 E3/E4).
// Padrão docs/13: consultas sem "use server", chamadas por Server Components; datas saem
// como ISO string (fronteira server→client). Row-level: escopo do NÚMERO (escopo.ts).

const JANELA_24H_MS = 24 * 3600_000;

// ---------------------------------------------------------------------------
// Inbox — lista de conversas
// ---------------------------------------------------------------------------

export interface ConversaResumo {
  id: string;
  numeroId: string;
  numeroRotulo: string;
  finalidade: string;
  driver: string;
  contatoId: string;
  contatoNome: string;
  contatoTelefone: string;
  optOut: boolean;
  vinculo: string | null; // "aluno · Maria" — resumo do vínculo mais forte
  naoLidas: number;
  ultimaMensagemEm: string | null;
  preview: string | null;
}

const PREVIEW_POR_TIPO: Record<string, string> = {
  IMAGEM: "[imagem]",
  AUDIO: "[áudio]",
  VIDEO: "[vídeo]",
  DOCUMENTO: "[documento]",
  OUTRO: "[mensagem]",
};

function resumoVinculo(contato: {
  aluno: { primeiroNome: string; sobrenome: string | null } | null;
  responsavel: { nome: string } | null;
  lead: { nome: string } | null;
}): string | null {
  if (contato.aluno) return `aluno · ${nomeCompleto(contato.aluno)}`;
  if (contato.responsavel) return `responsável · ${contato.responsavel.nome}`;
  if (contato.lead) return `lead · ${contato.lead.nome}`;
  return null;
}

export async function listarConversas(usuario: UsuarioSessao): Promise<ConversaResumo[]> {
  const conversas = await prisma.conversaWhatsApp.findMany({
    where: { ...escopoConversas(usuario), ultimaMensagemEm: { not: null } },
    orderBy: { ultimaMensagemEm: "desc" },
    take: 200,
    include: {
      numero: { select: { id: true, rotulo: true, finalidade: true, driver: true } },
      contato: {
        include: {
          aluno: { select: { primeiroNome: true, sobrenome: true } },
          responsavel: { select: { nome: true } },
          lead: { select: { nome: true } },
        },
      },
      mensagens: { orderBy: { criadoEm: "desc" }, take: 1, select: { corpo: true, tipo: true } },
    },
  });

  const itens = conversas.map((c) => {
    const ultima = c.mensagens[0] ?? null;
    const preview = ultima
      ? ultima.tipo === "TEXTO"
        ? (ultima.corpo ?? "").slice(0, 90)
        : `${PREVIEW_POR_TIPO[ultima.tipo] ?? "[mensagem]"}${ultima.corpo ? ` ${ultima.corpo.slice(0, 70)}` : ""}`
      : null;
    return {
      id: c.id,
      numeroId: c.numero.id,
      numeroRotulo: c.numero.rotulo,
      finalidade: c.numero.finalidade,
      driver: c.numero.driver,
      contatoId: c.contato.id,
      contatoNome: c.contato.nomeExibicao ?? resumoVinculo(c.contato)?.split(" · ")[1] ?? c.contato.telefoneE164,
      contatoTelefone: c.contato.telefoneE164,
      optOut: !!c.contato.optOutEm,
      vinculo: resumoVinculo(c.contato),
      naoLidas: c.naoLidas,
      ultimaMensagemEm: c.ultimaMensagemEm?.toISOString() ?? null,
      preview,
    };
  });

  // Não-lidas primeiro (doc 26 §Camada 3), depois recência.
  return itens.sort((a, b) => {
    const na = a.naoLidas > 0 ? 0 : 1;
    const nb = b.naoLidas > 0 ? 0 : 1;
    if (na !== nb) return na - nb;
    return (b.ultimaMensagemEm ?? "").localeCompare(a.ultimaMensagemEm ?? "");
  });
}

/** Badge da sidebar (notificação básica da E3): soma de não-lidas no escopo do usuário. */
export async function contarNaoLidas(usuario: UsuarioSessao): Promise<number> {
  const r = await prisma.conversaWhatsApp.aggregate({
    where: { ...escopoConversas(usuario), naoLidas: { gt: 0 } },
    _sum: { naoLidas: true },
  });
  return r._sum.naoLidas ?? 0;
}

// ---------------------------------------------------------------------------
// Inbox — thread
// ---------------------------------------------------------------------------

export interface MensagemThread {
  id: string;
  direcao: "ENTRADA" | "SAIDA";
  tipo: string;
  corpo: string | null;
  midiaPath: string | null;
  status: string;
  origem: string | null; // HUMANO/CRON/LOTE; null = app do celular (fromMe, gap 16)
  autorNome: string | null;
  templateNome: string | null;
  criadoEm: string;
}

export interface CobrancaAtivaThread {
  id: string;
  matriculaId: string;
  alunoId: string;
  alunoNome: string;
  moeda: string;
  vencimento: string;
  valorNegociado: number;
  valorRecebido: number;
  saldo: number;
  status: string;
}

export interface ThreadConversa {
  conversaId: string;
  numero: { id: string; rotulo: string; driver: string; finalidade: string; sessao: string; ativo: boolean };
  contato: {
    id: string;
    nome: string;
    telefone: string;
    optOutEm: string | null;
    alunoId: string | null;
    alunoNome: string | null;
    responsavelId: string | null;
    responsavelNome: string | null;
    leadId: string | null;
    leadNome: string | null;
  };
  /** Janela de 24h da Meta — só faz sentido em número oficial (doc 26 §Camada 3). */
  janela24h: { aberta: boolean; fechaEm: string | null } | null;
  /** Silêncio pós-inbound (S4): inbound não tratado suspende a régua automática. */
  silencio: { ativo: boolean; ate: string | null };
  cobrancaAtiva: CobrancaAtivaThread | null;
  mensagens: MensagemThread[];
}

export async function carregarThread(
  usuario: UsuarioSessao,
  conversaId: string,
): Promise<ThreadConversa | null> {
  const c = await prisma.conversaWhatsApp.findFirst({
    where: { id: conversaId, ...escopoConversas(usuario) },
    include: {
      numero: true,
      contato: {
        include: {
          aluno: { select: { id: true, primeiroNome: true, sobrenome: true } },
          responsavel: { select: { id: true, nome: true } },
          lead: { select: { id: true, nome: true } },
        },
      },
      // As 300 mais RECENTES (review PR #51 P2-5): desc + take, invertidas na projeção —
      // asc + take devolveria as 300 mais ANTIGAS e esconderia justamente o fim da conversa.
      mensagens: {
        orderBy: { criadoEm: "desc" },
        take: 300,
        include: {
          autor: { select: { nome: true } },
          template: { select: { nome: true } },
        },
      },
    },
  });
  if (!c) return null;

  const agora = Date.now();

  // Janela de 24h (só oficial): abre/renova a cada inbound do contato.
  const janela24h =
    c.numero.driver === "META_CLOUD"
      ? c.ultimoInboundEm && agora - c.ultimoInboundEm.getTime() < JANELA_24H_MS
        ? { aberta: true, fechaEm: new Date(c.ultimoInboundEm.getTime() + JANELA_24H_MS).toISOString() }
        : { aberta: false, fechaEm: null }
      : null;

  // Silêncio S4: usa a config vigente da política de cobrança.
  const politica = await carregarPoliticaRegua();
  const naoTratado =
    !!c.ultimoInboundEm && (!c.inboundTratadoEm || c.inboundTratadoEm < c.ultimoInboundEm);
  const limiteSilencio = c.ultimoInboundEm
    ? new Date(c.ultimoInboundEm.getTime() + politica.silencioPosInboundHoras * 3600_000)
    : null;
  const silencioAtivo = naoTratado && !!limiteSilencio && agora < limiteSilencio.getTime();

  // Dados financeiros SÓ para quem opera cobrança (review PR #51 P1-1): o gate no server —
  // esconder botão no client não impede o payload de vazar saldo/vencimento a vendedor.
  const cobrancaAtiva = temPapel(usuario, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA)
    ? await cobrancaAtivaDoContato(c.contato)
    : null;

  return {
    conversaId: c.id,
    numero: {
      id: c.numero.id,
      rotulo: c.numero.rotulo,
      driver: c.numero.driver,
      finalidade: c.numero.finalidade,
      sessao: c.numero.sessao,
      ativo: c.numero.ativo,
    },
    contato: {
      id: c.contato.id,
      nome: c.contato.nomeExibicao ?? resumoVinculo(c.contato)?.split(" · ")[1] ?? c.contato.telefoneE164,
      telefone: c.contato.telefoneE164,
      optOutEm: c.contato.optOutEm?.toISOString() ?? null,
      alunoId: c.contato.aluno?.id ?? null,
      alunoNome: c.contato.aluno ? nomeCompleto(c.contato.aluno) : null,
      responsavelId: c.contato.responsavel?.id ?? null,
      responsavelNome: c.contato.responsavel?.nome ?? null,
      leadId: c.contato.lead?.id ?? null,
      leadNome: c.contato.lead?.nome ?? null,
    },
    janela24h,
    silencio: { ativo: silencioAtivo, ate: silencioAtivo ? limiteSilencio!.toISOString() : null },
    cobrancaAtiva,
    mensagens: [...c.mensagens].reverse().map((m) => ({
      id: m.id,
      direcao: m.direcao,
      tipo: m.tipo,
      corpo: m.corpo,
      midiaPath: m.midiaPath,
      status: m.status,
      origem: m.origem,
      autorNome: m.autor?.nome ?? null,
      templateNome: m.template?.nome ?? null,
      criadoEm: m.criadoEm.toISOString(),
    })),
  };
}

/**
 * Ação rápida contextual (doc 26 §Camada 3): a cobrança ABERTA mais urgente do contato —
 * via vínculo direto (aluno) ou via responsável FINANCEIRO (alunos sob sua alçada).
 */
async function cobrancaAtivaDoContato(contato: {
  alunoId: string | null;
  responsavelId: string | null;
}): Promise<CobrancaAtivaThread | null> {
  const alunoIds = new Set<string>();
  if (contato.alunoId) alunoIds.add(contato.alunoId);
  if (contato.responsavelId) {
    const vinculos = await prisma.alunoResponsavel.findMany({
      where: { responsavelId: contato.responsavelId },
      select: { alunoId: true },
    });
    for (const v of vinculos) alunoIds.add(v.alunoId);
  }
  if (alunoIds.size === 0) return null;

  const cobranca = await prisma.cobranca.findFirst({
    where: {
      status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] },
      matricula: { alunoId: { in: [...alunoIds] } },
    },
    orderBy: { vencimento: "asc" },
    include: { matricula: { include: { aluno: { select: { id: true, primeiroNome: true, sobrenome: true } } } } },
  });
  if (!cobranca) return null;

  const valorNegociado = decimalParaNumero(cobranca.valorNegociado);
  const valorRecebido = numeroOuNull(cobranca.valorRecebido) ?? 0;
  const saldo = numeroOuNull(cobranca.saldo) ?? valorNegociado - valorRecebido;
  return {
    id: cobranca.id,
    matriculaId: cobranca.matriculaId,
    alunoId: cobranca.matricula.aluno.id,
    alunoNome: nomeCompleto(cobranca.matricula.aluno),
    moeda: cobranca.moeda,
    vencimento: cobranca.vencimento.toISOString(),
    valorNegociado,
    valorRecebido,
    saldo,
    status: cobranca.status,
  };
}

// ---------------------------------------------------------------------------
// Inbox — busca de pessoas para vincular contato (doc 26: vincular → aluno/lead)
// ---------------------------------------------------------------------------

export interface PessoasVinculo {
  alunos: { id: string; nome: string }[];
  responsaveis: { id: string; nome: string }[];
  leads: { id: string; nome: string; codigo: string | null }[];
}

export async function buscarPessoasVinculo(usuario: UsuarioSessao, q: string): Promise<PessoasVinculo> {
  const termo = q.trim();
  if (termo.length < 2) return { alunos: [], responsaveis: [], leads: [] };
  const contem = { contains: termo, mode: "insensitive" as const };

  const [alunos, responsaveis, leads] = await Promise.all([
    prisma.aluno.findMany({
      where: { OR: [{ primeiroNome: contem }, { sobrenome: contem }] },
      take: 5,
      select: { id: true, primeiroNome: true, sobrenome: true },
    }),
    prisma.responsavel.findMany({ where: { nome: contem }, take: 5, select: { id: true, nome: true } }),
    // Vendedor só vincula aos PRÓPRIOS leads (mesmo row-level das telas — doc 07).
    prisma.lead.findMany({
      where: { ...escopoLeads(usuario), nome: contem },
      take: 5,
      select: { id: true, nome: true, codigo: true },
    }),
  ]);

  return {
    alunos: alunos.map((a) => ({ id: a.id, nome: nomeCompleto(a) })),
    responsaveis,
    leads,
  };
}

// ---------------------------------------------------------------------------
// Config do canal (E3/E4) — telas de número, template e política (admin)
// ---------------------------------------------------------------------------

export interface NumeroConfig {
  id: string;
  telefoneE164: string;
  rotulo: string;
  driver: string;
  finalidade: string;
  providerRef: string | null;
  sessao: string;
  donoId: string | null;
  donoNome: string | null;
  ativo: boolean;
}

export async function listarNumerosConfig(): Promise<NumeroConfig[]> {
  const numeros = await prisma.numeroWhatsApp.findMany({
    orderBy: { criadoEm: "asc" },
    include: { dono: { select: { nome: true } } },
  });
  return numeros.map((n) => ({
    id: n.id,
    telefoneE164: n.telefoneE164,
    rotulo: n.rotulo,
    driver: n.driver,
    finalidade: n.finalidade,
    providerRef: n.providerRef,
    sessao: n.sessao,
    donoId: n.donoId,
    donoNome: n.dono?.nome ?? null,
    ativo: n.ativo,
  }));
}

export interface TemplateConfig {
  id: string;
  nome: string;
  corpo: string;
  idioma: string;
  categoria: string;
  statusMeta: string;
  metaTemplateId: string | null;
  atualizadoEm: string;
}

export async function listarTemplatesConfig(): Promise<TemplateConfig[]> {
  const templates = await prisma.templateWhatsApp.findMany({ orderBy: { nome: "asc" } });
  return templates.map((t) => ({
    id: t.id,
    nome: t.nome,
    corpo: t.corpo,
    idioma: t.idioma,
    categoria: t.categoria,
    statusMeta: t.statusMeta,
    metaTemplateId: t.metaTemplateId,
    atualizadoEm: t.atualizadoEm.toISOString(),
  }));
}

export interface DegrauConfig {
  passo: string;
  offsetDias: number;
  tipo: string;
  rotulo: string;
  modo: string;
  ativo: boolean;
  templateId: string | null;
}

export interface PoliticaConfig {
  /** null = ainda não existe registro (valores de fábrica; o salvar cria). */
  id: string | null;
  nome: string;
  estado: string;
  janelaInicio: number;
  janelaFim: number;
  diasSemana: number[];
  tetoPorContatoDia: number;
  silencioPosInboundHoras: number;
  killSwitch: boolean;
  numeroRemetenteId: string | null;
  degraus: DegrauConfig[];
}

export async function carregarPoliticaConfig(): Promise<PoliticaConfig> {
  const p = await prisma.politicaRegua.findFirst({
    where: { escopo: "COBRANCA" },
    include: { degraus: { orderBy: { offsetDias: "asc" } } },
    orderBy: { criadoEm: "asc" },
  });
  if (!p) {
    // Fábrica (doc 26 §defaults): a tela mostra e o salvar materializa o registro.
    return {
      id: null,
      nome: POLITICA_COBRANCA_NOME,
      estado: "DESLIGADA",
      janelaInicio: 9,
      janelaFim: 20,
      diasSemana: [1, 2, 3, 4, 5],
      tetoPorContatoDia: 2,
      silencioPosInboundHoras: 72,
      killSwitch: false,
      numeroRemetenteId: null,
      degraus: REGUA.map((d) => ({
        passo: d.passo,
        offsetDias: d.offsetDias,
        tipo: d.tipo,
        rotulo: d.rotulo,
        modo: MODOS_FABRICA[d.passo],
        ativo: true,
        templateId: null,
      })),
    };
  }
  return {
    id: p.id,
    nome: p.nome,
    estado: p.estado,
    janelaInicio: p.janelaInicio,
    janelaFim: p.janelaFim,
    diasSemana: p.diasSemana,
    tetoPorContatoDia: p.tetoPorContatoDia,
    silencioPosInboundHoras: p.silencioPosInboundHoras,
    killSwitch: p.killSwitch,
    numeroRemetenteId: p.numeroRemetenteId,
    degraus: p.degraus.map((d) => ({
      passo: d.passo,
      offsetDias: d.offsetDias,
      tipo: d.tipo,
      rotulo: d.rotulo,
      modo: d.modo,
      ativo: d.ativo,
      templateId: d.templateId,
    })),
  };
}

/** Conversa visível no escopo? Usada pelas AÇÕES da inbox (guard server-side). */
export async function conversaVisivel(
  usuario: UsuarioSessao,
  conversaId: string,
): Promise<Prisma.ConversaWhatsAppGetPayload<{ include: { numero: true; contato: true } }> | null> {
  return prisma.conversaWhatsApp.findFirst({
    where: { id: conversaId, ...escopoConversas(usuario) },
    include: { numero: true, contato: true },
  });
}

export { escopoNumeros };
