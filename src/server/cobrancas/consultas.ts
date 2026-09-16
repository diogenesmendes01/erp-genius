import { StatusCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { numero, numeroOuNull } from "@/server/_shared/decimal";
import { somarPorMoeda, type ValorMoeda } from "@/lib/dinheiro";
import { proximaAcao, type DegrauRegua, type PassoRegua, type EstadoCobranca, type TipoAcao } from "./regua";
import { carregarPoliticaRegua } from "./politica";
import { TEXTOS_FABRICA } from "./fabrica";
import type { ModeloWhatsapp } from "@/server/financeiro/schema";
import { renderizarTemplate } from "@/server/whatsapp/render";
import { resolverDestinoCobranca, INCLUDE_MATRICULA_DESTINO } from "@/server/whatsapp/identidade";
import { contatoCorrespondeDestinoFinanceiro } from "@/server/whatsapp/destinatario-atual";
import { suspensoesPorConferencia } from "./conferencia";
import { cicloDoEventoCobranca } from "./eventos";

// Read path da régua de cobrança (doc 24). Monta a EntradaRegua de cada cobrança aberta a partir
// dos eventos já gravados (passo cumprido + promessa) e roda o cérebro `proximaAcao`. Tudo
// on-the-fly (Fase 0, sem cron). Devolve linhas serializáveis + contadores dos mini-dashs.

export interface FilaCobrancaItem {
  conferenciaAte?: string | null;
  id: string;
  cicloRegua: number;
  codigo: string | null;
  tipo: string;
  valorNegociado: number;
  valorRecebido: number;
  saldo: number;
  moeda: string;
  vencimento: string;
  competencia: string | null;
  // Régua (cérebro), achatada para serializar Server → Client:
  estado: EstadoCobranca;
  passo: PassoRegua | null;
  tipoAcao: TipoAcao | null;
  template: string | null;
  rotuloAcao: string | null;
  atrasadaNaAcao: boolean;
  diasAtraso: number;
  prioridade: number;
  promessaAte: string | null;
  // Contexto:
  matriculaId: string;
  acessoBloqueado: boolean;
  /** Bloqueio PENDENTE de aprovação: atraso ≥ 15d e ainda não bloqueado. Desacoplado do passo
   *  da régua — mandar a mensagem D+15 NÃO equivale a bloquear (doc 24, review §1). */
  precisaBloqueio: boolean;
  tentativas: number;
  ultimaCobrancaEm: string | null;
  passosFeitos: PassoRegua[];
  aluno: { id: string; nome: string; telefone: string | null };
  pais: string;
  turma: string | null;
  // Canal WhatsApp (doc 30 E2):
  /** Destino resolvido (S2): responsável financeiro > aluno; null = sem destino (manual). */
  destino: { telefone: string; nome: string; viaResponsavel: boolean } | null;
  /** Inbound do destino POSTERIOR à última cobrança enviada — o selo "respondeu". */
  respondeuEm: string | null;
  /** Última intenção na fila de envio (estado do braço API) — null = nunca enfileirada. */
  envio: { passo: string | null; status: string; motivo: string | null; em: string | null } | null;
  /** Texto do degrau atual renderizado NO SERVIDOR (fonte única — doc 29 regra 4). */
  mensagemSugerida: string | null;
}

export interface DashsCobranca {
  aVencer: number;
  emAtraso: number;
  bloquear: number;
  promessas: number;
  recebidoHoje: ValorMoeda[];
}

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface ReguaCalculada {
  conferenciaAte?: string | null;
  estado: EstadoCobranca;
  passo: PassoRegua | null;
  tipoAcao: TipoAcao | null;
  template: string | null;
  rotuloAcao: string | null;
  atrasadaNaAcao: boolean;
  diasAtraso: number;
  prioridade: number;
  promessaAte: string | null;
  precisaBloqueio: boolean;
  tentativas: number;
  ultimaCobrancaEm: string | null;
  passosFeitos: PassoRegua[];
}

// Universo de passos VÁLIDOS por tipo (não por política): eventos `{ passo }` são fatos
// históricos e continuam contando como "feitos" mesmo se o admin desativar/alterar o degrau
// depois — senão a régua re-enviaria passos já cumpridos (doc 30 S6/anti-duplicação).
const PASSOS_VALIDOS = new Set<PassoRegua>(["D-7", "D-3", "D0", "D+3", "D+7", "D+15"]);

/**
 * CÉREBRO COMPARTILHADO (doc 24 §só leitura): calcula o estado da régua por cobrança a partir
 * dos eventos já gravados (passo cumprido + promessa) e roda `proximaAcao`. Fonte ÚNICA usada
 * tanto pela FILA (/financeiro, todas as cobranças) quanto pela FICHA financeira do aluno (as
 * dele) — as duas telas passam a contar a mesma história, sem duplicar lógica. Espera cobranças
 * ABERTAS (status quitado não tem régua).
 */
export async function montarReguaPorCobranca(
  cobrancas: { id: string; vencimento: Date; cicloRegua: number; acessoBloqueado: boolean }[],
  hoje: Date,
  politica?: readonly DegrauRegua[],
): Promise<Map<string, ReguaCalculada>> {
  // Política como dado (doc 26/30): sem parâmetro, carrega a do banco (fallback = fábrica).
  const degraus = politica ?? (await carregarPoliticaRegua()).degraus;
  const ids = cobrancas.map((c) => c.id);
  const ciclos = new Map(cobrancas.map((c) => [c.id, c.cicloRegua]));
  const eventos = ids.length
    ? await prisma.evento.findMany({
        where: {
          agregadoTipo: "Cobranca",
          agregadoId: { in: ids },
          tipo: { in: ["CobrancaEnviadaWhatsApp", "PromessaPagamento", "CobrancaRenegociada"] },
        },
        select: { agregadoId: true, tipo: true, payload: true, criadoEm: true },
        orderBy: { criadoEm: "asc" },
      })
    : [];

  const passosPorId = new Map<string, Set<PassoRegua>>();
  const tentativasPorId = new Map<string, { count: number; ultima: Date }>();
  const promessaPorId = new Map<string, Date>();
  for (const e of eventos) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    // S6 (doc 30): renegociação que MUDOU o vencimento zera os passos cumpridos até ali —
    // a régua recomeça da data nova. Eventos vêm em ordem asc, então basta limpar o
    // acumulado. Tentativas (sinal de reincidência) seguem contando o histórico inteiro.
    if (e.tipo === "CobrancaRenegociada") {
      // Reprogramações com ciclo explícito já estão isoladas pelo filtro dos envios.
      // O reset cronológico permanece para as renegociações anteriores a esse contrato.
      if (typeof p.novoVencimento === "string" && p.cicloRegua === undefined) passosPorId.delete(e.agregadoId);
      continue;
    }
    if (e.tipo === "CobrancaEnviadaWhatsApp") {
      const t = tentativasPorId.get(e.agregadoId) ?? { count: 0, ultima: e.criadoEm };
      t.count += 1;
      t.ultima = e.criadoEm; // ordenado asc → fica o mais recente
      tentativasPorId.set(e.agregadoId, t);
      // Um envio do ciclo anterior pode terminar depois de uma reprogramação.
      // Preserva o histórico de tentativas sem cumprir um passo do calendário novo.
      if (cicloDoEventoCobranca(e.payload) !== ciclos.get(e.agregadoId)) continue;
      const passo = p.passo as PassoRegua | undefined;
      if (passo && PASSOS_VALIDOS.has(passo)) {
        const s = passosPorId.get(e.agregadoId) ?? new Set<PassoRegua>();
        s.add(passo);
        passosPorId.set(e.agregadoId, s);
      }
    } else if (e.tipo === "PromessaPagamento") {
      const ate = typeof p.ate === "string" ? new Date(p.ate) : null;
      if (ate && !isNaN(ate.getTime())) promessaPorId.set(e.agregadoId, ate); // último vence
    }
  }

  const mapa = new Map<string, ReguaCalculada>();
  const conferencias = await suspensoesPorConferencia(ids, hoje);
  for (const c of cobrancas) {
    const conferencia = conferencias.get(c.id);
    const passos = [...(passosPorId.get(c.id) ?? [])];
    const promessaAte = promessaPorId.get(c.id) ?? null;
    const acao = proximaAcao(
      { vencimento: c.vencimento, quitada: false, passosFeitos: passos, promessaAte },
      hoje,
      degraus,
    );
    const tent = tentativasPorId.get(c.id);
    mapa.set(c.id, {
      conferenciaAte: conferencia?.toISOString() ?? null,
      estado: conferencia ? "em_conferencia" : acao.estado,
      passo: conferencia ? null : acao.degrau?.passo ?? null,
      tipoAcao: conferencia ? null : acao.degrau?.tipo ?? null,
      template: conferencia ? null : acao.degrau?.template ?? null,
      rotuloAcao: conferencia ? "Comprovante a conferir" : acao.degrau?.rotulo ?? null,
      atrasadaNaAcao: acao.atrasadaNaAcao,
      diasAtraso: acao.diasAtraso,
      prioridade: acao.prioridade,
      promessaAte: acao.promessaAte ? acao.promessaAte.toISOString() : null,
      precisaBloqueio: !c.acessoBloqueado && acao.diasAtraso >= 30,
      tentativas: tent?.count ?? 0,
      ultimaCobrancaEm: tent ? tent.ultima.toISOString() : null,
      passosFeitos: passos,
    });
  }
  return mapa;
}

export interface DegrauFila {
  passo: PassoRegua;
  offsetDias: number;
  tipo: TipoAcao;
  rotulo: string;
}

export async function listarFilaCobranca(): Promise<{
  itens: FilaCobrancaItem[];
  dashs: DashsCobranca;
  /** Degraus da POLÍTICA vigente — a timeline do drawer desenha isto, nunca a const REGUA
   *  do client (doc 29: a régua exibida deve ser a mesma que o cron executa). */
  regua: DegrauFila[];
}> {
  const hoje = new Date();
  const politica = await carregarPoliticaRegua();

  const cobrancas = await prisma.cobranca.findMany({
    where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } },
    orderBy: { vencimento: "asc" },
    include: {
      matricula: {
        include: {
          ...INCLUDE_MATRICULA_DESTINO,
          alocacoes: { where: { ativa: true }, include: { turma: { include: { modalidade: true, nivel: true } } } },
        },
      },
    },
  });

  // Régua de cada cobrança via o cérebro compartilhado (mesma fonte da ficha do aluno).
  const regua = await montarReguaPorCobranca(
    cobrancas.map((c) => ({ id: c.id, vencimento: c.vencimento, cicloRegua: c.cicloRegua, acessoBloqueado: c.matricula.acessoBloqueado })),
    hoje,
    politica.degraus,
  );

  // Canal WhatsApp (E2): templates p/ renderizar a mensagem sugerida no servidor,
  // última intenção por cobrança (estado do braço) e inbound por destino ("respondeu").
  const ids = cobrancas.map((c) => c.id);
  const templates = await prisma.templateWhatsApp.findMany();
  const templatePorId = new Map(templates.map((t) => [t.id, t]));
  const templatePorNome = new Map(templates.map((t) => [t.nome, t]));

  const intencoes = ids.length
    ? await prisma.intencaoMensagem.findMany({
        where: { cobrancaId: { in: ids } },
        orderBy: { criadaEm: "desc" },
        select: { cobrancaId: true, passo: true, status: true, motivoFalha: true, despachadaEm: true, criadaEm: true },
      })
    : [];
  const envioPorCobranca = new Map<string, (typeof intencoes)[number]>();
  for (const i of intencoes) {
    if (i.cobrancaId && !envioPorCobranca.has(i.cobrancaId)) envioPorCobranca.set(i.cobrancaId, i);
  }

  const destinos = cobrancas.map((c) => resolverDestinoCobranca(c));
  const destinoPorMatricula = new Map(destinos.filter((d): d is NonNullable<typeof d> => !!d).map((d) => [d.matriculaId, d]));
  // "Respondeu" pertence ao assunto financeiro daquela matrícula, não ao
  // transporte/telefone. Contextos encerrados ainda contam como histórico se
  // continuam ligados ao destinatário atual; COMERCIAL e financeiro legado sem
  // matrícula nunca contaminam o sinal de cobrança.
  const atendimentos = destinoPorMatricula.size
    ? await prisma.atendimentoWhatsApp.findMany({
        where: { finalidade: "FINANCEIRO", matriculaId: { in: [...destinoPorMatricula.keys()] }, ultimoInboundEm: { not: null } },
        select: { matriculaId: true, ultimoInboundEm: true, conversa: { select: { contato: { select: { telefoneE164: true, responsavelId: true } } } } },
      })
    : [];
  const inboundPorMatricula = new Map<string, Date>();
  for (const atendimento of atendimentos) {
    if (!atendimento.matriculaId || !atendimento.ultimoInboundEm) continue;
    const destino = destinoPorMatricula.get(atendimento.matriculaId);
    if (!destino || !contatoCorrespondeDestinoFinanceiro(atendimento.conversa.contato, destino)) continue;
    const atual = inboundPorMatricula.get(atendimento.matriculaId);
    if (!atual || atendimento.ultimoInboundEm > atual) inboundPorMatricula.set(atendimento.matriculaId, atendimento.ultimoInboundEm);
  }

  const itens: FilaCobrancaItem[] = cobrancas.map((c, idx) => {
    const r = regua.get(c.id)!;
    const aluno = c.matricula.aluno;
    const turma = c.matricula.alocacoes.length === 1 ? c.matricula.alocacoes[0].turma : null;
    const valorNegociado = numero(c.valorNegociado);
    const valorRecebido = numeroOuNull(c.valorRecebido) ?? 0;
    const saldo = numeroOuNull(c.saldo) ?? valorNegociado - valorRecebido;

    const d = destinos[idx];
    const destino = d ? { telefone: d.telefoneE164, nome: d.nome,
      viaResponsavel: d.responsavelId !== null || d.tipoPagador === "RESPONSAVEL" || d.tipoPagador === "EMPRESA" } : null;

    // "Respondeu" = inbound do destino DEPOIS da última cobrança enviada (doc 26 §Camada 3).
    const inbound = d ? inboundPorMatricula.get(d.matriculaId) : undefined;
    const respondeuEm =
      inbound && r.ultimaCobrancaEm && inbound > new Date(r.ultimaCobrancaEm) ? inbound.toISOString() : null;

    const envioRaw = envioPorCobranca.get(c.id);
    const envio = envioRaw
      ? {
          passo: envioRaw.passo,
          status: envioRaw.status,
          motivo: envioRaw.motivoFalha,
          em: (envioRaw.despachadaEm ?? envioRaw.criadaEm).toISOString(),
        }
      : null;

    // Mensagem do degrau atual renderizada no servidor (fonte única — doc 29 regra 4):
    // template da política > template pelo nome do modelo > texto de fábrica.
    let mensagemSugerida: string | null = null;
    if (r.estado === "acao_devida" && r.passo) {
      const tId = politica.templateIdPorPasso.get(r.passo) ?? null;
      const template = (tId ? templatePorId.get(tId) : undefined) ?? templatePorNome.get(r.template ?? "") ?? null;
      const corpoTemplate = template?.corpo ?? TEXTOS_FABRICA[(r.template ?? "dados") as ModeloWhatsapp];
      mensagemSugerida = renderizarTemplate(corpoTemplate, {
        nome: destino?.nome ?? nomeCompleto(aluno),
        valor: saldo > 0 ? saldo : valorNegociado,
        moeda: c.moeda,
        vencimento: c.vencimento,
        idioma: template?.idioma ?? aluno.pais?.idioma ?? "es",
      }).corpo;
    }

    return {
      id: c.id,
      cicloRegua: c.cicloRegua,
      codigo: c.codigo,
      tipo: c.tipo,
      valorNegociado,
      valorRecebido,
      saldo,
      moeda: c.moeda,
      vencimento: c.vencimento.toISOString(),
      competencia: c.competencia,
      ...r,
      matriculaId: c.matriculaId,
      acessoBloqueado: c.matricula.acessoBloqueado,
      aluno: { id: aluno.id, nome: nomeCompleto(aluno), telefone: aluno.telefoneE164 },
      pais: c.matricula.pais.nome,
      turma: turma ? `${turma.modalidade.nome} ${turma.nivel.codigo}` : null,
      destino,
      respondeuEm,
      envio,
      mensagemSugerida,
    };
  });

  // Contadores dos mini-dashs (filtros). "Bloquear" ⊂ "Em atraso" — é o subconjunto urgente.
  // "Bloquear" usa `precisaBloqueio` (atraso ≥ 15 e não bloqueado), NÃO o passo da régua: o
  // bloqueio pendente não pode sumir só porque a mensagem D+15 foi enviada (review §1).
  const aVencer = itens.filter((i) => i.estado !== "promessa" && i.diasAtraso <= 0).length;
  const emAtraso = itens.filter((i) => i.estado !== "promessa" && i.diasAtraso > 0).length;
  const bloquear = itens.filter((i) => i.precisaBloqueio).length;
  const promessas = itens.filter((i) => i.estado === "promessa").length;

  // Recebido hoje = soma das BAIXAS de hoje (eventos PagamentoRegistrado), não o status PAGO:
  // captura parciais (que ficam PENDENTE) e usa o valor DESTA baixa, não o acumulado (review §2).
  const pagamentosHoje = await prisma.evento.findMany({
    where: { tipo: "PagamentoRegistrado", agregadoTipo: "Cobranca", criadoEm: { gte: inicioDoDia(hoje) } },
    select: { agregadoId: true, payload: true },
  });
  const moedaPorCobranca = new Map<string, string>();
  if (pagamentosHoje.length) {
    const cobrancaIds = [...new Set(pagamentosHoje.map((e) => e.agregadoId))];
    const cobs = await prisma.cobranca.findMany({
      where: { id: { in: cobrancaIds } },
      select: { id: true, moeda: true },
    });
    for (const c of cobs) moedaPorCobranca.set(c.id, c.moeda);
  }
  const recebidoHoje = somarPorMoeda(
    pagamentosHoje
      .map((e) => {
        const p = (e.payload ?? {}) as Record<string, unknown>;
        const valor = typeof p.valorRecebido === "number" ? p.valorRecebido : 0;
        return { moeda: moedaPorCobranca.get(e.agregadoId) ?? "USD", valor };
      })
      .filter((x) => x.valor > 0),
  );

  return {
    itens,
    dashs: { aVencer, emAtraso, bloquear, promessas, recebidoHoje },
    regua: politica.degraus.map((d) => ({ passo: d.passo, offsetDias: d.offsetDias, tipo: d.tipo, rotulo: d.rotulo })),
  };
}

export type FilaCobranca = Awaited<ReturnType<typeof listarFilaCobranca>>;

export interface HistoricoFinanceiroItem {
  id: string;
  quando: string;
  label: string;
  autor: string | null;
}

/** Rótulo legível de um evento financeiro para a linha do tempo da ficha. */
function rotuloEvento(tipo: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (tipo) {
    case "CobrancaEnviadaWhatsApp": {
      const passo = typeof p.passo === "string" ? p.passo : null;
      const preventivo = passo ? passo.startsWith("D-") : false;
      return `${preventivo ? "Lembrete" : "Cobrança"} enviado(a) via WhatsApp${passo ? ` (${passo})` : ""}`;
    }
    case "PromessaPagamento": {
      const ate = typeof p.ate === "string" ? new Date(p.ate) : null;
      return ate && !isNaN(ate.getTime())
        ? `Promessa de pagamento até ${ate.toLocaleDateString("pt-BR")}`
        : "Promessa de pagamento";
    }
    case "PagamentoRegistrado":
      return p.quitada === true ? "Pagamento registrado (quitada)" : "Pagamento parcial registrado";
    case "AcessoBloqueado":
      return "Acesso à aula bloqueado";
    case "AcessoDesbloqueado":
      return "Acesso à aula desbloqueado";
    default:
      return tipo;
  }
}

/**
 * Histórico financeiro do aluno (régua/cobrança) para EXIBIÇÃO na ficha (doc 24 §só leitura):
 * lembretes, cobranças, promessas, pagamentos (incl. parciais) e bloqueios/desbloqueios. Lê o
 * log de eventos (já persistido) — não grava nada. Mais recente primeiro, teto de 100.
 */
export async function historicoFinanceiroDoAluno(
  cobrancaIds: string[],
  matriculaIds: string[],
): Promise<HistoricoFinanceiroItem[]> {
  if (cobrancaIds.length === 0 && matriculaIds.length === 0) return [];
  const or: import("@prisma/client").Prisma.EventoWhereInput[] = [];
  if (cobrancaIds.length) {
    or.push({
      agregadoTipo: "Cobranca",
      agregadoId: { in: cobrancaIds },
      tipo: { in: ["CobrancaEnviadaWhatsApp", "PromessaPagamento", "PagamentoRegistrado"] },
    });
  }
  if (matriculaIds.length) {
    or.push({
      agregadoTipo: "Matricula",
      agregadoId: { in: matriculaIds },
      tipo: { in: ["AcessoBloqueado", "AcessoDesbloqueado"] },
    });
  }
  const eventos = await prisma.evento.findMany({
    where: { OR: or },
    orderBy: { criadoEm: "desc" },
    include: { autor: { select: { nome: true } } },
    take: 100,
  });
  return eventos.map((e) => ({
    id: e.id,
    quando: e.criadoEm.toISOString(),
    label: rotuloEvento(e.tipo, e.payload),
    autor: e.autor?.nome ?? null,
  }));
}
