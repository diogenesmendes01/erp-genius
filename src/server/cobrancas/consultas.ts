import { StatusCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { somarPorMoeda, type ValorMoeda } from "@/lib/dinheiro";
import { proximaAcao, type PassoRegua, type EstadoCobranca, type TipoAcao } from "./regua";

// Read path da régua de cobrança (doc 24). Monta a EntradaRegua de cada cobrança aberta a partir
// dos eventos já gravados (passo cumprido + promessa) e roda o cérebro `proximaAcao`. Tudo
// on-the-fly (Fase 0, sem cron). Devolve linhas serializáveis + contadores dos mini-dashs.

export interface FilaCobrancaItem {
  id: string;
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

const PASSOS_VALIDOS = new Set<PassoRegua>(["D-7", "D-3", "D0", "D+3", "D+7", "D+15"]);

/**
 * CÉREBRO COMPARTILHADO (doc 24 §só leitura): calcula o estado da régua por cobrança a partir
 * dos eventos já gravados (passo cumprido + promessa) e roda `proximaAcao`. Fonte ÚNICA usada
 * tanto pela FILA (/financeiro, todas as cobranças) quanto pela FICHA financeira do aluno (as
 * dele) — as duas telas passam a contar a mesma história, sem duplicar lógica. Espera cobranças
 * ABERTAS (status quitado não tem régua).
 */
export async function montarReguaPorCobranca(
  cobrancas: { id: string; vencimento: Date; acessoBloqueado: boolean }[],
  hoje: Date,
): Promise<Map<string, ReguaCalculada>> {
  const ids = cobrancas.map((c) => c.id);
  const eventos = ids.length
    ? await prisma.evento.findMany({
        where: {
          agregadoTipo: "Cobranca",
          agregadoId: { in: ids },
          tipo: { in: ["CobrancaEnviadaWhatsApp", "PromessaPagamento"] },
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
    if (e.tipo === "CobrancaEnviadaWhatsApp") {
      const t = tentativasPorId.get(e.agregadoId) ?? { count: 0, ultima: e.criadoEm };
      t.count += 1;
      t.ultima = e.criadoEm; // ordenado asc → fica o mais recente
      tentativasPorId.set(e.agregadoId, t);
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
  for (const c of cobrancas) {
    const passos = [...(passosPorId.get(c.id) ?? [])];
    const promessaAte = promessaPorId.get(c.id) ?? null;
    const acao = proximaAcao(
      { vencimento: c.vencimento, quitada: false, passosFeitos: passos, promessaAte },
      hoje,
    );
    const tent = tentativasPorId.get(c.id);
    mapa.set(c.id, {
      estado: acao.estado,
      passo: acao.degrau?.passo ?? null,
      tipoAcao: acao.degrau?.tipo ?? null,
      template: acao.degrau?.template ?? null,
      rotuloAcao: acao.degrau?.rotulo ?? null,
      atrasadaNaAcao: acao.atrasadaNaAcao,
      diasAtraso: acao.diasAtraso,
      prioridade: acao.prioridade,
      promessaAte: acao.promessaAte ? acao.promessaAte.toISOString() : null,
      precisaBloqueio: !c.acessoBloqueado && acao.diasAtraso >= 15 && acao.estado !== "promessa",
      tentativas: tent?.count ?? 0,
      ultimaCobrancaEm: tent ? tent.ultima.toISOString() : null,
      passosFeitos: passos,
    });
  }
  return mapa;
}

export async function listarFilaCobranca(): Promise<{ itens: FilaCobrancaItem[]; dashs: DashsCobranca }> {
  const hoje = new Date();

  const cobrancas = await prisma.cobranca.findMany({
    where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } },
    orderBy: { vencimento: "asc" },
    include: {
      matricula: {
        include: {
          pais: { select: { nome: true } },
          aluno: {
            include: {
              alocacoes: {
                where: { ativa: true },
                take: 1,
                include: { turma: { include: { modalidade: true, nivel: true } } },
              },
            },
          },
        },
      },
    },
  });

  // Régua de cada cobrança via o cérebro compartilhado (mesma fonte da ficha do aluno).
  const regua = await montarReguaPorCobranca(
    cobrancas.map((c) => ({ id: c.id, vencimento: c.vencimento, acessoBloqueado: c.matricula.acessoBloqueado })),
    hoje,
  );

  const itens: FilaCobrancaItem[] = cobrancas.map((c) => {
    const r = regua.get(c.id)!;
    const aluno = c.matricula.aluno;
    const turma = aluno.alocacoes[0]?.turma ?? null;
    return {
      id: c.id,
      codigo: c.codigo,
      tipo: c.tipo,
      valorNegociado: c.valorNegociado,
      valorRecebido: c.valorRecebido ?? 0,
      saldo: c.saldo ?? c.valorNegociado - (c.valorRecebido ?? 0),
      moeda: c.moeda,
      vencimento: c.vencimento.toISOString(),
      competencia: c.competencia,
      ...r,
      matriculaId: c.matriculaId,
      acessoBloqueado: c.matricula.acessoBloqueado,
      aluno: { id: aluno.id, nome: nomeCompleto(aluno), telefone: aluno.telefoneE164 },
      pais: c.matricula.pais.nome,
      turma: turma ? `${turma.modalidade.nome} ${turma.nivel.codigo}` : null,
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

  return { itens, dashs: { aVencer, emAtraso, bloquear, promessas, recebidoHoje } };
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
