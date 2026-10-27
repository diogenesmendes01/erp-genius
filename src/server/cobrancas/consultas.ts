import { StatusCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { numero, numeroOuNull } from "@/server/_shared/decimal";
import { somarPorMoeda, type ValorMoeda } from "@/lib/dinheiro";
import { inicioDoDiaInstitucional } from "@/server/operacao/fuso";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { proximaAcao, type DegrauRegua, type PassoRegua, type EstadoCobranca, type TipoAcao } from "./regua";
import { carregarPoliticaRegua } from "./politica";
import { TEXTOS_FABRICA } from "./fabrica";
import type { ModeloWhatsapp } from "@/server/financeiro/schema";
import { renderizarTemplate } from "@/server/whatsapp/render";
import { resolverDestinoCobranca, INCLUDE_MATRICULA_DESTINO } from "@/server/whatsapp/identidade";
import { contatoCorrespondeDestinoFinanceiro } from "@/server/whatsapp/destinatario-atual";
import { suspensoesPorConferencia } from "./conferencia";
import {
  FILA_COBRANCA_POR_TRECHO,
  contarIndicadoresFila,
  cursorDoItemFila,
  filtrarFila,
  lerFiltrosFila,
  opcoesDaFila,
  trechoDaFila,
  type FiltrosFila,
} from "./filtros-fila";
import { lerPaginaDaFila, type NavegacaoDaPagina, type NavegacaoFila } from "@/lib/cursor-fila";
import { cicloDoEventoCobranca } from "./eventos";
import { carregarTrilhasVencimentoCivil, incluirFonteVencimentoCivil, referenciaVencimentoCivil, type ReferenciaVencimentoCivil } from "@/server/financeiro/vencimento-civil";
import { ONDE_MODELO_REGUA } from "@/server/whatsapp/modelos-regua";

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
  vencimento: ReferenciaVencimentoCivil;
  competencia: string | null;
  estado: EstadoCobranca;
  passo: PassoRegua | null;
  tipoAcao: TipoAcao | null;
  template: string | null;
  rotuloAcao: string | null;
  atrasadaNaAcao: boolean;
  diasAtraso: number;
  prioridade: number;
  promessaAte: string | null;
  matriculaId: string;
  acessoBloqueado: boolean;
  precisaBloqueio: boolean;
  tentativas: number;
  ultimaCobrancaEm: string | null;
  passosFeitos: PassoRegua[];
  aluno: { id: string; nome: string; telefone: string | null };
  pais: string;
  turma: string | null;
  destino: { telefone: string; nome: string; viaResponsavel: boolean } | null;
  respondeuEm: string | null;
  envio: { passo: string | null; status: string; motivo: string | null; em: string | null } | null;
  mensagemSugerida: string | null;
}

export interface DashsCobranca {
  aVencer: number;
  emAtraso: number;
  bloquear: number;
  promessas: number;
  recebidoHoje: ValorMoeda[];
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

const PASSOS_VALIDOS = new Set<PassoRegua>(["D-7", "D-3", "D0", "D+3", "D+7", "D+15"]);

export async function montarReguaPorCobranca(
  cobrancas: { id: string; vencimento: Date; cicloRegua: number; acessoBloqueado: boolean }[],
  hoje: Date,
  politica?: readonly DegrauRegua[],
  fusoEscola?: string,
): Promise<Map<string, ReguaCalculada>> {
  const degraus = politica ?? (await carregarPoliticaRegua()).degraus;
  const fuso = fusoEscola ?? (cobrancas.length ? await fusoDaEscola() : "");
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
    if (e.tipo === "CobrancaRenegociada") {
      if (typeof p.novoVencimento === "string" && p.cicloRegua === undefined) passosPorId.delete(e.agregadoId);
      continue;
    }
    if (e.tipo === "CobrancaEnviadaWhatsApp") {
      const t = tentativasPorId.get(e.agregadoId) ?? { count: 0, ultima: e.criadoEm };
      t.count += 1;
      t.ultima = e.criadoEm;
      tentativasPorId.set(e.agregadoId, t);
      if (cicloDoEventoCobranca(e.payload) !== ciclos.get(e.agregadoId)) continue;
      const passo = p.passo as PassoRegua | undefined;
      if (passo && PASSOS_VALIDOS.has(passo)) {
        const s = passosPorId.get(e.agregadoId) ?? new Set<PassoRegua>();
        s.add(passo);
        passosPorId.set(e.agregadoId, s);
      }
    } else if (e.tipo === "PromessaPagamento") {
      const ate = typeof p.ate === "string" ? new Date(p.ate) : null;
      if (ate && !isNaN(ate.getTime())) promessaPorId.set(e.agregadoId, ate);
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
      fuso,
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

function turmaDaFila(alocacoes: readonly { turma: { modalidade: { nome: string }; nivel: { codigo: string } } }[]): string | null {
  return alocacoes.length === 1 ? `${alocacoes[0].turma.modalidade.nome} ${alocacoes[0].turma.nivel.codigo}` : null;
}

export interface EntradaFilaCobranca {
  filtros?: FiltrosFila;
  navegacao?: NavegacaoFila;
}

export interface FilaCobrancaConsulta extends NavegacaoDaPagina {
  itens: FilaCobrancaItem[];
  dashs: DashsCobranca;
  regua: DegrauFila[];
  totalFila: number;
  totalVisao: number;
  opcoes: { paises: string[]; turmas: string[] };
}

export async function listarFilaCobranca(entrada: EntradaFilaCobranca = {}): Promise<FilaCobrancaConsulta> {
  const filtros = entrada.filtros ?? lerFiltrosFila({});
  const hoje = new Date();
  const fuso = await fusoDaEscola();
  const politica = await carregarPoliticaRegua();

  const abertas = await prisma.cobranca.findMany({
    where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } },
    orderBy: [{ vencimento: "asc" }, { id: "asc" }],
    select: {
      id: true,
      codigo: true,
      vencimento: true,
      cicloRegua: true,
      matricula: {
        select: {
          acessoBloqueado: true,
          aluno: { select: { primeiroNome: true, sobrenome: true } },
          pais: { select: { nome: true } },
          alocacoes: { where: { ativa: true }, select: { turma: { select: { modalidade: { select: { nome: true } }, nivel: { select: { codigo: true } } } } } },
        },
      },
    },
  });

  const regua = await montarReguaPorCobranca(
    abertas.map((c) => ({ id: c.id, vencimento: c.vencimento, cicloRegua: c.cicloRegua, acessoBloqueado: c.matricula.acessoBloqueado })),
    hoje,
    politica.degraus,
    fuso,
  );

  const resumo = abertas.map((c) => {
    const r = regua.get(c.id)!;
    return {
      id: c.id,
      codigo: c.codigo,
      estado: r.estado,
      diasAtraso: r.diasAtraso,
      precisaBloqueio: r.precisaBloqueio,
      prioridade: r.prioridade,
      pais: c.matricula.pais.nome,
      turma: turmaDaFila(c.matricula.alocacoes),
      aluno: { nome: nomeCompleto(c.matricula.aluno) },
    };
  });
  const visao = filtrarFila(resumo, filtros);

  const { registros: trecho, ...navegacaoDoTrecho } = await lerPaginaDaFila(
    entrada.navegacao ?? {},
    FILA_COBRANCA_POR_TRECHO,
    async (leitura, take) => trechoDaFila(visao, leitura, take),
    cursorDoItemFila,
  );

  const idsDoTrecho = trecho.map((t) => t.id);
  const detalhes = idsDoTrecho.length
    ? await prisma.cobranca.findMany({
        where: { id: { in: idsDoTrecho }, status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } },
        take: FILA_COBRANCA_POR_TRECHO,
        include: {
          ...incluirFonteVencimentoCivil,
          matricula: {
            include: {
              ...INCLUDE_MATRICULA_DESTINO,
              alocacoes: { where: { ativa: true }, include: { turma: { include: { modalidade: true, nivel: true } } } },
            },
          },
        },
      })
    : [];
  const detalhePorId = new Map(detalhes.map((c) => [c.id, c]));
  const cobrancas = idsDoTrecho.flatMap((id) => {
    const c = detalhePorId.get(id);
    return c ? [c] : [];
  });

  const trilhasVencimento = await carregarTrilhasVencimentoCivil(prisma, cobrancas.map((c) => c.id), [...new Set(cobrancas.map((c) => c.matriculaId))]);

  const ids = cobrancas.map((c) => c.id);
  const templates = await prisma.templateWhatsApp.findMany({ where: ONDE_MODELO_REGUA });
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
    if (!destino || !atendimento.conversa.contato || !contatoCorrespondeDestinoFinanceiro(atendimento.conversa.contato, destino)) continue;
    const atual = inboundPorMatricula.get(atendimento.matriculaId);
    if (!atual || atendimento.ultimoInboundEm > atual) inboundPorMatricula.set(atendimento.matriculaId, atendimento.ultimoInboundEm);
  }

  const itens: FilaCobrancaItem[] = cobrancas.map((c, idx) => {
    const r = regua.get(c.id)!;
    const aluno = c.matricula.aluno;
    const valorNegociado = numero(c.valorNegociado);
    const valorRecebido = numeroOuNull(c.valorRecebido) ?? 0;
    const saldo = numeroOuNull(c.saldo) ?? valorNegociado - valorRecebido;

    const d = destinos[idx];
    const destino = d ? { telefone: d.telefoneE164, nome: d.nome,
      viaResponsavel: d.responsavelId !== null || d.tipoPagador === "RESPONSAVEL" || d.tipoPagador === "EMPRESA" } : null;

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
      vencimento: referenciaVencimentoCivil({
        ...c,
        aplicacoesAditivoVencimento: trilhasVencimento.vencimentosPorCobranca.get(c.id),
        aplicacoesM01: trilhasVencimento.m01PorCobranca.get(c.id),
        retomadasReprogramadas: trilhasVencimento.retomadasReprogramadas,
      }),
      competencia: c.competencia,
      ...r,
      matriculaId: c.matriculaId,
      acessoBloqueado: c.matricula.acessoBloqueado,
      aluno: { id: aluno.id, nome: nomeCompleto(aluno), telefone: aluno.telefoneE164 },
      pais: c.matricula.pais.nome,
      turma: turmaDaFila(c.matricula.alocacoes),
      destino,
      respondeuEm,
      envio,
      mensagemSugerida,
    };
  });

  const { aVencer, emAtraso, bloquear, promessas } = contarIndicadoresFila(resumo);

  const pagamentosHoje = await prisma.evento.findMany({
    where: { tipo: "PagamentoRegistrado", agregadoTipo: "Cobranca", criadoEm: { gte: inicioDoDiaInstitucional(hoje, fuso) } },
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
    totalFila: abertas.length,
    totalVisao: visao.length,
    opcoes: opcoesDaFila(resumo, filtros),
    ...navegacaoDoTrecho,
  };
}

export type FilaCobranca = Awaited<ReturnType<typeof listarFilaCobranca>>;

export interface HistoricoFinanceiroItem {
  id: string;
  quando: string;
  label: string;
  autor: string | null;
}

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
