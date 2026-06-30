import {
  EtapaLead,
  StatusComissao,
  StatusMatricula,
  StatusCobranca,
  Papel,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { somarPorMoeda } from "@/lib/dinheiro";
import type { UsuarioSessao } from "@/server/_shared";

const DIAS_PROPOSTA_PARADA = 5; // doc 09: "proposta parada há X dias" (default; tunável — P10)
const SLA_MINUTOS = 60; // SLA do 1º contato (default; tunável — P10, doc 10 §10)

function hojeIntervalo() {
  const ini = new Date();
  ini.setHours(0, 0, 0, 0);
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  return { ini, fim };
}

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export type Prioridade = "quente" | "atencao" | "agenda" | "proposta";

export interface ItemFila {
  id: string;
  nome: string;
  prioridade: Prioridade;
  motivo: string;
}

export async function dadosHomeVendedor(usuario: UsuarioSessao) {
  const { ini, fim } = hojeIntervalo();
  const agora = new Date();
  const limiteProposta = new Date(agora.getTime() - DIAS_PROPOSTA_PARADA * 86400000);

  const leads = await prisma.lead.findMany({
    where: {
      vendedorDonoId: usuario.id,
      etapa: { notIn: [EtapaLead.PERDIDO, EtapaLead.MATRICULADO] },
    },
    orderBy: { criadoEm: "desc" },
  });

  const fila: ItemFila[] = [];
  for (const l of leads) {
    if (l.etapa === EtapaLead.NOVO) {
      fila.push({ id: l.id, nome: l.nome, prioridade: "quente", motivo: "Lead novo sem 1º contato" });
    } else if (l.proximoFollowUp && l.proximoFollowUp < agora) {
      fila.push({ id: l.id, nome: l.nome, prioridade: "atencao", motivo: "Follow-up vencido" });
    } else if (l.dataExperimental && l.dataExperimental >= ini && l.dataExperimental <= fim) {
      fila.push({ id: l.id, nome: l.nome, prioridade: "agenda", motivo: "Experimental hoje" });
    } else if (l.etapa === EtapaLead.PROPOSTA && l.dataProposta && l.dataProposta < limiteProposta) {
      fila.push({ id: l.id, nome: l.nome, prioridade: "proposta", motivo: "Proposta parada" });
    }
  }
  const ordem: Record<Prioridade, number> = { quente: 0, atencao: 1, agenda: 2, proposta: 3 };
  fila.sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade]);

  const leadsNovos = leads.filter((l) => l.etapa === EtapaLead.NOVO).length;
  const followVencidos = leads.filter((l) => l.proximoFollowUp && l.proximoFollowUp < agora).length;
  const experimentaisHoje = leads.filter(
    (l) => l.dataExperimental && l.dataExperimental >= ini && l.dataExperimental <= fim,
  ).length;

  const comissoes = await prisma.comissao.findMany({
    where: { vendedorId: usuario.id, status: { in: [StatusComissao.PENDENTE, StatusComissao.APROVADA] } },
    select: { valor: true, moeda: true },
  });
  // Por moeda — antes somava CRC+USD e rotulava com a moeda da PRIMEIRA comissão (errado).
  const comissaoPrevista = somarPorMoeda(comissoes.map((c) => ({ moeda: c.moeda, valor: c.valor })));

  // kanban resumido
  const agrup = await prisma.lead.groupBy({
    by: ["etapa"],
    where: { vendedorDonoId: usuario.id },
    _count: { _all: true },
  });
  const kanban = agrup.map((g) => ({ etapa: g.etapa, total: g._count._all }));

  // meta do mês (matrículas via comissões aprovadas/pagas neste mês)
  const matriculasMes = await prisma.comissao.count({
    where: { vendedorId: usuario.id, criadoEm: { gte: inicioDoMes() } },
  });

  // agenda de hoje (experimentais)
  const agenda = leads
    .filter((l) => l.dataExperimental && l.dataExperimental >= ini && l.dataExperimental <= fim)
    .map((l) => ({ id: l.id, nome: l.nome, hora: l.dataExperimental!.toISOString() }))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  // SLA do dia (1º contato): leads que saíram de NOVO ÷ total; atrasados = NOVO além do limite
  const limiteSla = new Date(agora.getTime() - SLA_MINUTOS * 60000);
  const atrasadosSla = leads.filter((l) => l.etapa === EtapaLead.NOVO && l.criadoEm < limiteSla).length;
  const respondidos = leads.filter((l) => l.etapa !== EtapaLead.NOVO).length;
  const slaPct = leads.length > 0 ? Math.round((respondidos / leads.length) * 100) : 100;

  return {
    cards: { leadsNovos, followVencidos, experimentaisHoje, comissaoPrevista },
    sla: { pct: slaPct, atrasados: atrasadosSla },
    fila,
    agenda,
    kanban,
    metaMes: { feitas: matriculasMes, meta: 20 },
  };
}

export async function dadosHomeProfessor(usuario: UsuarioSessao) {
  const turmas = await prisma.turma.findMany({
    where: { professorId: usuario.id },
    orderBy: { criadoEm: "desc" },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      // Conta SOMENTE alocações ativas (issues #1/#19) — alunos atuais (não conta transferidos/removidos).
      _count: { select: { alocacoes: { where: { ativa: true } } } },
    },
  });

  // Experimentais para check-in (agendadas) — só as ATRIBUÍDAS a este professor
  // (escopo, Issue #13). O vínculo é a FK `professorExperimentalId` (fonte de
  // verdade). Sem atribuição = nada aparece, e o check-in também é bloqueado.
  const experimentais = await prisma.lead.findMany({
    where: {
      professorExperimentalId: usuario.id,
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      dataExperimental: { not: null },
    },
    orderBy: { dataExperimental: "asc" },
    select: { id: true, nome: true, dataExperimental: true },
  });

  return {
    turmas: turmas.map((t) => ({
      id: t.id,
      label: `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo}`,
      diasHorario: t.diasHorario,
      alunos: t._count.alocacoes,
    })),
    experimentais: experimentais.map((e) => ({
      id: e.id,
      nome: e.nome,
      data: e.dataExperimental!.toISOString(),
    })),
  };
}

export async function dadosHomeGerente() {
  const { ini, fim } = hojeIntervalo();

  const [leadsHoje, totalLeads, matriculados, matriculasMes] = await Promise.all([
    prisma.lead.count({ where: { criadoEm: { gte: ini, lte: fim } } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { etapa: EtapaLead.MATRICULADO } }),
    prisma.matricula.count({ where: { status: StatusMatricula.ATIVA, ativadaEm: { gte: inicioDoMes() } } }),
  ]);

  const conversao = totalLeads > 0 ? Math.round((matriculados / totalLeads) * 100) : 0;

  const limiteSla = new Date(Date.now() - SLA_MINUTOS * 60000);
  const alertasSla = await prisma.lead.count({
    where: { etapa: EtapaLead.NOVO, criadoEm: { lt: limiteSla } },
  });

  // receita: cobranças pagas no mês, agrupada por moeda (nunca soma CRC+USD num total só).
  const pagasMes = await prisma.cobranca.findMany({
    where: { status: StatusCobranca.PAGO, pagoEm: { gte: inicioDoMes() } },
    select: { valorRecebido: true, valorNegociado: true, moeda: true },
  });
  const receitaMes = somarPorMoeda(pagasMes.map((c) => ({ moeda: c.moeda, valor: c.valorRecebido ?? c.valorNegociado })));

  // ranking simples por matrículas (leads matriculados por dono)
  const vendedores = await prisma.usuario.findMany({
    where: { papeis: { has: Papel.VENDEDOR }, ativo: true },
    select: { id: true, nome: true },
  });
  const ranking = await Promise.all(
    vendedores.map(async (v) => ({
      nome: v.nome,
      matriculados: await prisma.lead.count({
        where: { vendedorDonoId: v.id, etapa: EtapaLead.MATRICULADO },
      }),
    })),
  );
  ranking.sort((a, b) => b.matriculados - a.matriculados);

  const funil = await prisma.lead.groupBy({ by: ["etapa"], _count: { _all: true } });

  return {
    kpis: { leadsHoje, conversao, matriculasMes, receitaMes, alertasSla },
    ranking,
    equipe: vendedores.map((v) => v.nome),
    funil: funil.map((f) => ({ etapa: f.etapa, total: f._count._all })),
  };
}
