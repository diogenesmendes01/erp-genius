import {
  EtapaLead,
  StatusMatricula,
  Papel,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { somarPorMoeda } from "@/lib/dinheiro";
import { numero } from "@/server/_shared/decimal";
import { exigirPapel, ErroAutenticacao, type UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { escopoTurmasDocente } from "@/server/diario/permissoes";

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

/**
 * A mesma referência temporal governa o card de próxima aula e a lista de
 * check-ins pendentes. Ela é capturada no servidor para que uma aba aberta em
 * outro fuso, ou um relógio local incorreto, não escolha outra aula.
 */
export async function dadosHomeProfessor(usuario: UsuarioSessao, agora = new Date()) {
  if (!usuario?.id) throw new ErroAutenticacao();
  exigirPapel(usuario, Papel.PROFESSOR);
  const turmas = await prisma.turma.findMany({
    where: escopoTurmasDocente(usuario.id),
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
  const experimentais = await prisma.oportunidade.findMany({
    where: {
      professorExperimentalId: usuario.id,
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      dataExperimental: { not: null },
    },
    orderBy: { dataExperimental: "asc" },
    select: { id: true, nome: true, dataExperimental: true },
  });

  const proximaExperimental = experimentais.find((e) => e.dataExperimental! >= agora);
  // B9 (doc 32): check-in VENCIDO — aula já passou (além da tolerância) sem Compareceu/
  // Faltou. Sem o check-in a recuperação de no-show (C2) nunca dispara; o professor é o
  // responsável e a Home é o canal do alerta.
  const config = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  const toleranciaMs = (config?.checkInToleranciaMinutos ?? 30) * 60_000;
  const limiteCheckIn = new Date(Date.now() - toleranciaMs);

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
      vencida: e.dataExperimental! < limiteCheckIn,
    })),
    // Check-in atrasado permanece disponível na lista. Somente o destaque
    // "Próxima" exige uma ocorrência ainda futura (o instante igual a agora
    // ainda é atendível nesta referência capturada).
    proximaExperimental: proximaExperimental
      ? {
          id: proximaExperimental.id,
          nome: proximaExperimental.nome,
          data: proximaExperimental.dataExperimental!.toISOString(),
        }
      : null,
  };
}

export async function dadosHomeGerente(usuario: UsuarioSessao) {
  if (!usuario?.id) throw new ErroAutenticacao();
  exigirPapel(usuario, Papel.GERENTE_COMERCIAL);
  const escopo = await escopoComercialAtual(usuario);
  const escopoMatriculas = usuario.papeis.includes(Papel.ADMINISTRADOR) ? {} : { lead: { is: escopo } };
  const { ini, fim } = hojeIntervalo();

  const [leadsHoje, totalLeads, matriculados, matriculasMes] = await Promise.all([
    prisma.oportunidade.count({ where: { AND: [escopo], criadoEm: { gte: ini, lte: fim } } }),
    prisma.oportunidade.count({ where: escopo }),
    prisma.oportunidade.count({ where: { AND: [escopo], etapa: EtapaLead.MATRICULADO } }),
    prisma.matricula.count({ where: { ...escopoMatriculas, status: StatusMatricula.ATIVA, ativadaEm: { gte: inicioDoMes() } } }),
  ]);

  const conversao = totalLeads > 0 ? Math.round((matriculados / totalLeads) * 100) : 0;

  const limiteSla = new Date(Date.now() - SLA_MINUTOS * 60000);
  const alertasSla = await prisma.oportunidade.count({
    where: { AND: [escopo], etapa: EtapaLead.NOVO, criadoEm: { lt: limiteSla } },
  });

  // Cada recebimento entra no mês em que ocorreu, inclusive baixa parcial.
  const pagasMes = await prisma.recebimento.findMany({
    where: { dataPagamento: { gte: inicioDoMes() }, cobranca: { matricula: escopoMatriculas } },
    select: { valor: true, moeda: true },
  });
  // B9 (doc 32): experimentais já ocorridas (além da tolerância) sem check-in do professor
  // — o gerente cobra; sem o check-in a recuperação de no-show (C2) não dispara.
  const configComercial = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  const limiteCheckIn = new Date(Date.now() - (configComercial?.checkInToleranciaMinutos ?? 30) * 60_000);
  const checkInsVencidos = await prisma.oportunidade.count({
    where: { AND: [escopo], etapa: EtapaLead.EXPERIMENTAL_AGENDADA, dataExperimental: { not: null, lt: limiteCheckIn } },
  });

  const receitaMes = somarPorMoeda(
    pagasMes.map((c) => ({ moeda: c.moeda, valor: numero(c.valor) })),
  );

  // ranking simples por matrículas (leads matriculados por dono)
  const vendedores = await prisma.usuario.findMany({
    where: { papeis: { has: Papel.VENDEDOR }, ativo: true, ...(usuario.papeis.includes(Papel.ADMINISTRADOR) ? {} : { gerenteComercialId: usuario.id }) },
    select: { id: true, nome: true },
  });
  const ranking = await Promise.all(
    vendedores.map(async (v) => ({
      nome: v.nome,
      matriculados: await prisma.oportunidade.count({
        where: { vendedorDonoId: v.id, etapa: EtapaLead.MATRICULADO },
      }),
    })),
  );
  ranking.sort((a, b) => b.matriculados - a.matriculados);

  const funil = await prisma.oportunidade.groupBy({ by: ["etapa"], where: escopo, _count: { _all: true } });

  return {
    kpis: { leadsHoje, conversao, matriculasMes, receitaMes, alertasSla, checkInsVencidos },
    ranking,
    equipe: vendedores.map((v) => v.nome),
    funil: funil.map((f) => ({ etapa: f.etapa, total: f._count._all })),
  };
}
