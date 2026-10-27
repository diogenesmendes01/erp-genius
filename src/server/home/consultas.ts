import {
  EtapaLead,
  StatusMatricula,
  Papel,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { somarPorMoeda } from "@/lib/dinheiro";
import { numero } from "@/server/_shared/decimal";
import { exigirPapel, ErroAutenticacao, type UsuarioSessao } from "@/server/_shared";
import { escopoRelatorio } from "@/server/relatorios/escopo";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { dataCivilInstitucional, inicioDoDiaInstitucional, inicioDoDiaSeguinteInstitucional, inicioDoMesInstitucional } from "@/server/operacao/fuso";
import { progressoMetas } from "@/server/metas/metas";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { escopoTurmasDocente } from "@/server/diario/permissoes";

const SLA_MINUTOS = 60;


export async function dadosHomeProfessor(usuario: UsuarioSessao, agora = new Date()) {
  if (!usuario?.id) throw new ErroAutenticacao();
  exigirPapel(usuario, Papel.PROFESSOR);
  const turmas = await prisma.turma.findMany({
    where: escopoTurmasDocente(usuario.id),
    orderBy: { criadoEm: "desc" },
    include: {
      modalidade: true,
      nivel: { include: { idioma: true } },
      _count: { select: { alocacoes: { where: { ativa: true } } } },
    },
  });

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
    proximaExperimental: proximaExperimental
      ? {
          id: proximaExperimental.id,
          nome: proximaExperimental.nome,
          data: proximaExperimental.dataExperimental!.toISOString(),
        }
      : null,
  };
}

export async function dadosHomeGerente(usuario: UsuarioSessao, agora = new Date()) {
  if (!usuario?.id) throw new ErroAutenticacao();
  exigirPapel(usuario, Papel.GERENTE_COMERCIAL);
  const escopo = await escopoComercialAtual(usuario);
  const escopoMatriculas = usuario.papeis.includes(Papel.ADMINISTRADOR) ? {} : { lead: { is: escopo } };
  const fuso = await fusoDaEscola();
  const inicioHoje = inicioDoDiaInstitucional(agora, fuso);
  const inicioAmanha = inicioDoDiaSeguinteInstitucional(agora, fuso);
  const inicioMes = inicioDoMesInstitucional(agora, fuso);

  const [leadsHoje, totalLeads, matriculados, matriculasMes] = await Promise.all([
    prisma.oportunidade.count({ where: { AND: [escopo], criadoEm: { gte: inicioHoje, lt: inicioAmanha } } }),
    prisma.oportunidade.count({ where: escopo }),
    prisma.oportunidade.count({ where: { AND: [escopo], etapa: EtapaLead.MATRICULADO } }),
    prisma.matricula.count({ where: { ...escopoMatriculas, status: StatusMatricula.ATIVA, ativadaEm: { gte: inicioMes } } }),
  ]);

  const conversao = totalLeads > 0 ? Math.round((matriculados / totalLeads) * 100) : 0;

  const limiteSla = new Date(Date.now() - SLA_MINUTOS * 60000);
  const alertasSla = await prisma.oportunidade.count({
    where: { AND: [escopo], etapa: EtapaLead.NOVO, criadoEm: { lt: limiteSla } },
  });

  const pagasMes = await prisma.recebimento.findMany({
    where: { dataPagamento: { gte: inicioMes }, cobranca: { matricula: escopoMatriculas } },
    select: { valor: true, moeda: true },
  });
  const configComercial = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  const limiteCheckIn = new Date(Date.now() - (configComercial?.checkInToleranciaMinutos ?? 30) * 60_000);
  const checkInsVencidos = await prisma.oportunidade.count({
    where: { AND: [escopo], etapa: EtapaLead.EXPERIMENTAL_AGENDADA, dataExperimental: { not: null, lt: limiteCheckIn } },
  });

  const receitaMes = somarPorMoeda(
    pagasMes.map((c) => ({ moeda: c.moeda, valor: numero(c.valor) })),
  );

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

  const competencia = dataCivilInstitucional(agora, fuso).slice(0, 7);
  const metasMes = (await progressoMetas({ competencias: [competencia], escopo: await escopoRelatorio(usuario) })).filter((p) => p.metrica === "MATRICULAS");
  const metaGeral = metasMes.find((p) => p.usuarioId === null);
  const metaMatriculasMes = metaGeral
    ? { meta: metaGeral.meta, realizado: metaGeral.realizado }
    : metasMes.length
      ? { meta: metasMes.reduce((s, p) => s + p.meta, 0), realizado: metasMes.reduce((s, p) => s + p.realizado, 0) }
      : null;

  return {
    kpis: { leadsHoje, conversao, matriculasMes, receitaMes, alertasSla, checkInsVencidos, metaMatriculasMes },
    ranking,
    equipe: vendedores.map((v) => v.nome),
    funil: funil.map((f) => ({ etapa: f.etapa, total: f._count._all })),
  };
}
