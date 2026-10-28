import {
  EtapaLead,
  Papel,
  Prisma,
  StatusMatricula,
  type MetricaMeta,
  type StatusComissao,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { somarPorMoeda } from "@/lib/dinheiro";
import { hrefConversa } from "@/lib/href-conversa";
import { numero } from "@/server/_shared/decimal";
import { exigirPapel, ErroAutenticacao, type UsuarioSessao } from "@/server/_shared";
import { escopoMatriculaAprovacao } from "@/server/financeiro/acesso";
import { escopoRelatorio } from "@/server/relatorios/escopo";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { dataCivilInstitucional, inicioDoDiaCivil, inicioDoDiaInstitucional, inicioDoDiaSeguinteInstitucional, inicioDoMesInstitucional } from "@/server/operacao/fuso";
import { progressoMetas } from "@/server/metas/metas";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { escopoTurmasDocente } from "@/server/diario/permissoes";
import { COLUNAS_FUNIL } from "@/server/crm/etapas";
import { TIPOS_MUDAM_ETAPA } from "@/server/comercial/schema";
import { whereOportunidadeEmSql } from "@/server/crm/oportunidade-sql";

export const DIAS_SEM_MOVIMENTO = 7;
const LISTA_CURTA = 8;

const METRICAS_PESSOAIS: readonly MetricaMeta[] = ["MATRICULAS", "VALOR_GANHO", "EXPERIMENTAIS_REALIZADAS"];

function arredondar(n: number): number {
  return Math.round(n * 100) / 100;
}

function diasRestantesNoMes(civil: string): number {
  const [ano, mes, dia] = civil.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return Math.max(0, ultimo - dia);
}

function inicioDoProximoMesInstitucional(agora: Date, fuso: string): Date {
  const [ano, mes] = dataCivilInstitucional(agora, fuso).split("-").map(Number);
  const proximo = new Date(Date.UTC(ano, mes, 1));
  return inicioDoDiaCivil(proximo.toISOString().slice(0, 10), fuso);
}

function exigeDecisaoAlcada(referencias: Prisma.JsonValue): boolean {
  if (!referencias || typeof referencias !== "object" || Array.isArray(referencias)) return false;
  const componentes = (referencias as { alcada?: { componentes?: { resultado?: string }[] } }).alcada?.componentes;
  if (!Array.isArray(componentes)) return false;
  return componentes.some((c) => c?.resultado === "EXIGE_APROVACAO" || c?.resultado === "REFERENCIA_INSUFICIENTE");
}

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

function whereRetornoPendente(responsavelId: string | { in: string[] }): Prisma.AtendimentoWhatsAppWhereInput {
  return {
    encerradoEm: null,
    responsavelId,
    finalidade: "COMERCIAL",
    OR: [
      { AND: [{ primeiroInboundEm: { not: null } }, { primeiraRespostaEm: null }] },
      { naoLidas: { gt: 0 } },
    ],
  };
}

function somasDeGrupo(linhas: { moeda: string; status?: StatusComissao; _sum: { valor: Prisma.Decimal | null } }[]) {
  return linhas
    .map((l) => ({ moeda: l.moeda, valor: arredondar(numero(l._sum.valor ?? 0)), ...(l.status ? { status: l.status } : {}) }))
    .sort((a, b) => a.moeda.localeCompare(b.moeda) || (a.status ?? "").localeCompare(b.status ?? ""));
}

async function oportunidadesPrioritarias(escopo: Prisma.OportunidadeWhereInput, agora: Date, inicioHoje: Date, inicioAmanha: Date) {
  const limiteInteracao = new Date(agora.getTime() - DIAS_SEM_MOVIMENTO * 86_400_000);
  const [hoje, semProposta, aguardando, quentes] = await Promise.all([
    prisma.oportunidade.findMany({
      where: { AND: [escopo, { etapa: EtapaLead.EXPERIMENTAL_AGENDADA, dataExperimental: { gte: inicioHoje, lt: inicioAmanha } }] },
      select: { id: true, nome: true },
      orderBy: [{ dataExperimental: "asc" }, { id: "asc" }],
      take: LISTA_CURTA,
    }),
    prisma.oportunidade.findMany({
      where: { AND: [escopo, { etapa: EtapaLead.EXPERIMENTAL_REALIZADA, dataProposta: null }] },
      select: { id: true, nome: true },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
      take: LISTA_CURTA,
    }),
    prisma.oportunidade.findMany({
      where: { AND: [escopo, { etapa: EtapaLead.AGUARDANDO_MATRICULA }] },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
      take: LISTA_CURTA,
      select: {
        id: true, nome: true,
        matricula: { select: {
          contratoOk: true, pagamentoTaxaOk: true,
          preparacaoComercial: { select: { referencias: true, decisaoPreco: { select: { aprovada: true } } } },
        } },
      },
    }),
    prisma.oportunidade.findMany({
      where: { AND: [escopo, { temperatura: "QUENTE", etapa: { notIn: [EtapaLead.MATRICULADO, EtapaLead.PERDIDO] } }] },
      select: { id: true, nome: true, criadoEm: true },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
      take: 100,
    }),
  ]);
  const eventos = quentes.length
    ? await prisma.evento.groupBy({
        by: ["agregadoId"],
        where: { agregadoTipo: "Lead", agregadoId: { in: quentes.map((q) => q.id) } },
        _max: { criadoEm: true },
      })
    : [];
  const ultima = new Map(eventos.map((e) => [e.agregadoId, e._max.criadoEm]));
  const itens: { id: string; nome: string; motivo: string }[] = [];
  const vistos = new Set<string>();
  const por = (id: string, nome: string, motivo: string) => {
    if (vistos.has(id) || itens.length >= LISTA_CURTA) return;
    vistos.add(id);
    itens.push({ id, nome, motivo });
  };
  for (const o of hoje) por(o.id, o.nome, "Experimental hoje");
  for (const o of semProposta) por(o.id, o.nome, "Experimental realizada sem proposta");
  for (const o of aguardando) {
    const preparacao = o.matricula?.preparacaoComercial;
    const pendencias: string[] = [];
    if (preparacao && !preparacao.decisaoPreco && exigeDecisaoAlcada(preparacao.referencias)) pendencias.push("alçada de preço");
    if (o.matricula && !o.matricula.contratoOk) pendencias.push("assinatura do contrato");
    if (o.matricula && !o.matricula.pagamentoTaxaOk) pendencias.push("pagamento da taxa");
    por(o.id, o.nome, pendencias.length ? `Aguardando matrícula · ${pendencias.join(", ")}` : "Aguardando matrícula");
  }
  for (const o of quentes) {
    const quando = ultima.get(o.id) ?? o.criadoEm;
    if (quando && quando < limiteInteracao) por(o.id, o.nome, "Quente sem interação recente");
  }
  return itens.map((i) => ({ ...i, href: `/funil?o=${encodeURIComponent(i.id)}` }));
}

export async function dadosHomeVendedor(usuario: UsuarioSessao, agora = new Date()) {
  if (!usuario?.id) throw new ErroAutenticacao();
  exigirPapel(usuario, Papel.VENDEDOR);
  const escopo = await escopoComercialAtual(usuario);
  const fuso = await fusoDaEscola();
  const hojeCivil = dataCivilInstitucional(agora, fuso);
  const competencia = hojeCivil.slice(0, 7);
  const inicioHoje = inicioDoDiaInstitucional(agora, fuso);
  const inicioAmanha = inicioDoDiaSeguinteInstitucional(agora, fuso);
  const inicioMes = inicioDoMesInstitucional(agora, fuso);
  const inicioProximoMes = inicioDoProximoMesInstitucional(agora, fuso);
  const retorno = whereRetornoPendente(usuario.id);
  const tarefasWhere: Prisma.TarefaWhereInput = {
    status: "ABERTA",
    responsavelId: usuario.id,
    OR: [
      { dataCivil: { lte: hojeCivil } },
      { AND: [{ dataCivil: null }, { inicioEm: { not: null, lt: inicioAmanha } }] },
    ],
  };

  const [progresso, confirmadas, pendentes, pipeline, totalRetornos, retornos, totalTarefas, tarefas, prioritarias] = await Promise.all([
    progressoMetas({ competencias: [competencia], escopo: { tipo: "USUARIOS", ids: [usuario.id] } }),
    prisma.comissao.groupBy({
      by: ["moeda", "status"],
      where: { vendedorId: usuario.id, status: { in: ["APROVADA", "PAGA"] }, aprovadaEm: { gte: inicioMes, lt: inicioProximoMes } },
      _sum: { valor: true },
    }),
    prisma.comissao.groupBy({
      by: ["moeda"],
      where: { vendedorId: usuario.id, status: "PENDENTE" },
      _sum: { valor: true },
    }),
    prisma.oportunidade.findMany({
      where: { vendedorDonoId: usuario.id, etapa: { notIn: [EtapaLead.MATRICULADO, EtapaLead.PERDIDO] }, comissaoPrevista: { not: null } },
      select: { comissaoPrevista: true, pais: { select: { moedaLocal: true } } },
    }),
    prisma.atendimentoWhatsApp.count({ where: retorno }),
    prisma.atendimentoWhatsApp.findMany({
      where: retorno,
      orderBy: [{ primeiroInboundEm: { sort: "asc", nulls: "last" } }, { criadoEm: "asc" }, { id: "asc" }],
      take: 5,
      select: {
        id: true,
        lead: { select: { nome: true } },
        conversa: { select: { contato: { select: { nomeExibicao: true, telefoneE164: true } } } },
      },
    }),
    prisma.tarefa.count({ where: tarefasWhere }),
    prisma.tarefa.findMany({
      where: tarefasWhere,
      orderBy: [{ dataCivil: "asc" }, { inicioEm: "asc" }, { id: "asc" }],
      take: LISTA_CURTA,
      select: { id: true, titulo: true, dataCivil: true, inicioEm: true },
    }),
    oportunidadesPrioritarias(escopo, agora, inicioHoje, inicioAmanha),
  ]);

  const porMoeda = new Map<string, number>();
  for (const o of pipeline) {
    if (o.comissaoPrevista == null) continue;
    const moeda = o.pais?.moedaLocal ?? "";
    porMoeda.set(moeda, (porMoeda.get(moeda) ?? 0) + numero(o.comissaoPrevista));
  }

  return {
    competencia,
    diasRestantesMes: diasRestantesNoMes(hojeCivil),
    metaMes: progresso
      .filter((p) => METRICAS_PESSOAIS.includes(p.metrica))
      .map((p) => ({
        metrica: p.metrica,
        meta: p.meta,
        realizado: p.realizado,
        faltam: arredondar(Math.max(0, p.meta - p.realizado)),
        pct: p.pct,
        moeda: p.moeda,
      })),
    comissoesConfirmadas: somasDeGrupo(confirmadas),
    comissoesPendentesLiquidacao: somasDeGrupo(pendentes),
    comissoesPipelineAberto: [...porMoeda.entries()]
      .map(([moeda, valor]) => ({ moeda: moeda || null, valor: arredondar(valor) }))
      .sort((a, b) => (a.moeda ?? "").localeCompare(b.moeda ?? "")),
    retornos: {
      total: totalRetornos,
      itens: retornos.map((a) => ({
        id: a.id,
        nome: a.lead?.nome ?? a.conversa.contato?.nomeExibicao ?? a.conversa.contato?.telefoneE164 ?? "Conversa",
        href: hrefConversa(a.id),
      })),
    },
    tarefas: {
      total: totalTarefas,
      itens: tarefas.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        atrasada: t.dataCivil ? t.dataCivil < hojeCivil : !!t.inicioEm && t.inicioEm < inicioHoje,
        href: `/tarefas?t=${encodeURIComponent(t.id)}`,
      })),
    },
    oportunidadesPrioritarias: prioritarias,
  };
}

async function funilComParadas(escopo: Prisma.OportunidadeWhereInput, agora: Date) {
  const limite = new Date(agora.getTime() - DIAS_SEM_MOVIMENTO * 86_400_000);
  const linhas = await prisma.$queryRaw<{ etapa: EtapaLead; total: number; paradas: number }[]>`
    SELECT o."etapa" AS etapa,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE o."etapa"::text NOT IN ('MATRICULADO', 'PERDIDO')
          AND (
            (o."proximoFollowUp" IS NOT NULL AND o."proximoFollowUp" < ${agora})
            OR COALESCE(ev.em, o."criadoEm") < ${limite}
          )
      )::int AS paradas
    FROM "Lead" o
    LEFT JOIN LATERAL (
      SELECT MAX(e."criadoEm") AS em
      FROM "Evento" e
      WHERE e."agregadoTipo" = 'Lead'
        AND e."agregadoId" = o."id"
        AND e."tipo" IN (${Prisma.join(TIPOS_MUDAM_ETAPA)})
    ) ev ON TRUE
    WHERE ${whereOportunidadeEmSql(escopo)}
    GROUP BY o."etapa"`;
  const ordem = new Map(COLUNAS_FUNIL.map((etapa, i) => [etapa, i]));
  return linhas
    .map((l) => ({ etapa: l.etapa, total: Number(l.total), paradas: Number(l.paradas) }))
    .sort((a, b) => (ordem.get(a.etapa) ?? 99) - (ordem.get(b.etapa) ?? 99));
}

async function indicadoresDaEquipe(vendedores: { id: string; nome: string }[], agora: Date, fuso: string) {
  if (!vendedores.length) return [];
  const ids = vendedores.map((v) => v.id);
  const inicioMes = inicioDoMesInstitucional(agora, fuso);
  const inicioProximoMes = inicioDoProximoMesInstitucional(agora, fuso);
  const limite = new Date(agora.getTime() - DIAS_SEM_MOVIMENTO * 86_400_000);
  const [sla, retornos, conversao, paradas] = await Promise.all([
    prisma.atendimentoWhatsApp.groupBy({
      by: ["responsavelId"],
      where: {
        finalidade: "COMERCIAL", encerradoEm: null, primeiraRespostaEm: null,
        prazoRespostaEm: { not: null, lt: agora }, responsavelId: { in: ids },
      },
      _count: { _all: true },
    }),
    prisma.atendimentoWhatsApp.groupBy({
      by: ["responsavelId"],
      where: whereRetornoPendente({ in: ids }),
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ id: string; experimentais: number; matriculas: number }[]>`
      SELECT l."vendedorDonoId" AS id,
        COUNT(DISTINCT l.id) FILTER (
          WHERE e.tipo = 'ExperimentalRealizada'
            OR (e.tipo = 'EtapaAlterada' AND e.payload ->> 'para' = 'EXPERIMENTAL_REALIZADA')
        )::int AS experimentais,
        COUNT(DISTINCT l.id) FILTER (
          WHERE e.tipo = 'EtapaAlterada' AND e.payload ->> 'para' = 'MATRICULADO'
        )::int AS matriculas
      FROM "Lead" l
      JOIN "Evento" e ON e."agregadoTipo" = 'Lead' AND e."agregadoId" = l.id
      WHERE l."vendedorDonoId" IN (${Prisma.join(ids)})
        AND e."criadoEm" >= ${inicioMes}
        AND e."criadoEm" < ${inicioProximoMes}
      GROUP BY l."vendedorDonoId"`,
    prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT o."vendedorDonoId" AS id, COUNT(*)::int AS n
      FROM "Lead" o
      LEFT JOIN LATERAL (
        SELECT MAX(e."criadoEm") AS em
        FROM "Evento" e
        WHERE e."agregadoTipo" = 'Lead' AND e."agregadoId" = o."id"
          AND e."tipo" IN (${Prisma.join(TIPOS_MUDAM_ETAPA)})
      ) ev ON TRUE
      WHERE o."vendedorDonoId" IN (${Prisma.join(ids)})
        AND o."etapa"::text NOT IN ('MATRICULADO', 'PERDIDO')
        AND (
          (o."proximoFollowUp" IS NOT NULL AND o."proximoFollowUp" < ${agora})
          OR COALESCE(ev.em, o."criadoEm") < ${limite}
        )
      GROUP BY o."vendedorDonoId"`,
  ]);
  const contagem = (linhas: { responsavelId: string | null; _count: { _all: number } }[]) =>
    new Map(linhas.flatMap((l) => (l.responsavelId ? [[l.responsavelId, l._count._all] as const] : [])));
  const slaMap = contagem(sla);
  const retornoMap = contagem(retornos);
  const conversaoMap = new Map(conversao.map((c) => [c.id, { experimentais: Number(c.experimentais), matriculas: Number(c.matriculas) }]));
  const paradasMap = new Map(paradas.map((p) => [p.id, Number(p.n)]));
  return vendedores.map((v) => {
    const c = conversaoMap.get(v.id) ?? { experimentais: 0, matriculas: 0 };
    return {
      id: v.id,
      nome: v.nome,
      atendimentosSlaEstourado: slaMap.get(v.id) ?? 0,
      retornosPendentes: retornoMap.get(v.id) ?? 0,
      experimentaisRealizadasMes: c.experimentais,
      matriculadosMes: c.matriculas,
      taxaConversao: c.experimentais > 0 ? Math.round((c.matriculas / c.experimentais) * 100) : null,
      oportunidadesParadas: paradasMap.get(v.id) ?? 0,
    };
  });
}

async function contarAprovacoesPendentes(usuario: UsuarioSessao): Promise<number> {
  const adm = usuario.papeis.includes(Papel.ADMINISTRADOR);
  const whereMatricula = await escopoMatriculaAprovacao(usuario);
  const matriculas = adm ? [] : await prisma.matricula.findMany({
    where: whereMatricula,
    select: { id: true, cobrancas: { select: { id: true } } },
  });
  const objetos: Prisma.AprovacaoWhereInput = adm ? {} : {
    OR: [
      { alvoTipo: "Matricula", alvoId: { in: matriculas.map((m) => m.id) } },
      { alvoTipo: "Cobranca", alvoId: { in: matriculas.flatMap((m) => m.cobrancas.map((c) => c.id)) } },
    ],
    payload: { path: ["exigeDirecao"], equals: false },
  };
  const [cobranca, preparacoes] = await Promise.all([
    prisma.aprovacao.count({
      where: {
        status: "PENDENTE",
        solicitanteId: { not: usuario.id },
        tipo: { in: adm ? ["DESCONTO", "BOLSA", "ALTERACAO_VALOR", "PERDAO_DIVIDA"] : ["DESCONTO", "ALTERACAO_VALOR"] },
        AND: [{ alvoTipo: { in: ["Matricula", "Cobranca"] } }, objetos],
      },
    }),
    prisma.preparacaoComercialMatricula.findMany({
      where: {
        decisaoPreco: { is: null },
        matricula: { is: { AND: [whereMatricula, { status: { in: ["RASCUNHO", "AGUARDANDO"] } }] } },
      },
      select: { referencias: true },
    }),
  ]);
  return cobranca + preparacoes.filter((p) => exigeDecisaoAlcada(p.referencias)).length;
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
  const escopoVendedores = usuario.papeis.includes(Papel.ADMINISTRADOR)
    ? {}
    : { OR: [{ responsavelId: usuario.id }, { responsavel: { gerenteComercialId: usuario.id } }, { responsavelId: null }] };

  const [leadsHoje, totalLeads, matriculados, matriculasMes, alertasSla] = await Promise.all([
    prisma.oportunidade.count({ where: { AND: [escopo], criadoEm: { gte: inicioHoje, lt: inicioAmanha } } }),
    prisma.oportunidade.count({ where: escopo }),
    prisma.oportunidade.count({ where: { AND: [escopo], etapa: EtapaLead.MATRICULADO } }),
    prisma.matricula.count({ where: { ...escopoMatriculas, status: StatusMatricula.ATIVA, ativadaEm: { gte: inicioMes } } }),
    prisma.atendimentoWhatsApp.count({
      where: {
        finalidade: "COMERCIAL",
        encerradoEm: null,
        primeiraRespostaEm: null,
        prazoRespostaEm: { not: null, lt: agora },
        ...escopoVendedores,
      },
    }),
  ]);

  const conversao = totalLeads > 0 ? Math.round((matriculados / totalLeads) * 100) : 0;

  const pagasMes = await prisma.recebimento.findMany({
    where: { dataPagamento: { gte: inicioMes }, cobranca: { matricula: escopoMatriculas } },
    select: { valor: true, moeda: true },
  });
  const configComercial = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  const limiteCheckIn = new Date(agora.getTime() - (configComercial?.checkInToleranciaMinutos ?? 30) * 60_000);
  const checkInsVencidos = await prisma.oportunidade.count({
    where: { AND: [escopo], etapa: EtapaLead.EXPERIMENTAL_AGENDADA, dataExperimental: { not: null, lt: limiteCheckIn } },
  });

  const receitaMes = somarPorMoeda(
    pagasMes.map((c) => ({ moeda: c.moeda, valor: numero(c.valor) })),
  );

  const vendedores = await prisma.usuario.findMany({
    where: { papeis: { has: Papel.VENDEDOR }, ativo: true, ...(usuario.papeis.includes(Papel.ADMINISTRADOR) ? {} : { gerenteComercialId: usuario.id }) },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  const competencia = dataCivilInstitucional(agora, fuso).slice(0, 7);
  const [funil, indicadores, aprovacoesPendentes, metasMes] = await Promise.all([
    funilComParadas(escopo, agora),
    indicadoresDaEquipe(vendedores, agora, fuso),
    contarAprovacoesPendentes(usuario),
    progressoMetas({ competencias: [competencia], escopo: await escopoRelatorio(usuario) }),
  ]);
  const metasMatriculas = metasMes.filter((p) => p.metrica === "MATRICULAS");
  const metaGeral = metasMatriculas.find((p) => p.usuarioId === null);
  const metaMatriculasMes = metaGeral
    ? { meta: metaGeral.meta, realizado: metaGeral.realizado }
    : metasMatriculas.length
      ? { meta: metasMatriculas.reduce((s, p) => s + p.meta, 0), realizado: metasMatriculas.reduce((s, p) => s + p.realizado, 0) }
      : null;

  return {
    kpis: { leadsHoje, conversao, matriculasMes, receitaMes, alertasSla, checkInsVencidos, metaMatriculasMes, aprovacoesPendentes },
    indicadores,
    funil,
  };
}
