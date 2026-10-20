import { EtapaLead, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { palavrasDaBuscaLeads } from "@/server/comercial/filtros";
import { TIPOS_MUDAM_ETAPA } from "@/server/comercial/schema";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { COLUNAS_FUNIL } from "@/server/crm/etapas";
import { CARTOES_POR_COLUNA, type CartaoFunil, type ColunaFunil, type FiltrosFunil } from "@/server/crm/funil";
import { EVENTOS_DE_CONTATO_SEM_INTERACAO, MAX_LINHAS_CARTEIRA, type FiltrosCarteira, type LinhaCarteira } from "@/server/crm/carteira";

// Implementação ANTERIOR (em memória) do funil e da carteira, copiada do main antes do B19 (#196 C3, #198 C2).
// Só serve de referência para os testes de equivalência: a versão nova ordena, filtra e corta no banco e
// tem de devolver exatamente o mesmo resultado, na mesma ordem. Não usar fora de teste.

function whereDosFiltros(f: FiltrosFunil): Prisma.OportunidadeWhereInput {
  const palavras = palavrasDaBuscaLeads(f.busca);
  return {
    ...(f.tipo ? { b2b: f.tipo === "b2b" } : {}),
    ...(f.donoId ? { vendedorDonoId: f.donoId } : {}),
    ...(f.temperatura ? { temperatura: f.temperatura } : {}),
    ...(f.origem ? { origemCanal: f.origem } : {}),
    ...(f.tagId ? { pessoa: { is: { tags: { some: { tagId: f.tagId } } } } } : {}),
    ...(palavras.length
      ? {
          AND: palavras.map((palavra) => {
            const contem = { contains: palavra, mode: "insensitive" as const };
            return { OR: [{ nome: contem }, { codigo: contem }] };
          }),
        }
      : {}),
  };
}

// "tempo": a coluna não guarda desde quando a oportunidade está na etapa (isso vem de Evento);
// carregarFunil resolve essa ordem em memória por etapaDesde; aqui só o desempate estável.
function ordenacao(ordem: FiltrosFunil["ordem"]): Prisma.OportunidadeOrderByWithRelationInput[] {
  switch (ordem) {
    case "valor":
      return [{ valorPrevisto: { sort: "desc", nulls: "last" } }, { id: "desc" }];
    case "proxima":
      return [{ proximoFollowUp: { sort: "asc", nulls: "last" } }, { id: "desc" }];
    case "tempo":
      return [{ criadoEm: "asc" }, { id: "asc" }];
    default:
      return [{ criadoEm: "desc" }, { id: "desc" }];
  }
}

const ordemMoeda = (m: string) => (m === "USD" ? 0 : 1);
export async function carregarFunilLegado(usuario: UsuarioSessao, f: FiltrosFunil): Promise<ColunaFunil[]> {
  const base: Prisma.OportunidadeWhereInput = { AND: [await escopoComercialAtual(usuario), whereDosFiltros(f)] };

  // Perdidos: o período vale pela última ação (Evento), não pela criação.
  let wherePerdido: Prisma.OportunidadeWhereInput = { AND: [base, { etapa: EtapaLead.PERDIDO }] };
  if (f.perdidosDias !== "todos") {
    const corte = new Date(Date.now() - Number(f.perdidosDias) * 86_400_000);
    const perdidos = await prisma.oportunidade.findMany({ where: wherePerdido, select: { id: true, criadoEm: true } });
    const ultimas = perdidos.length
      ? await prisma.evento.groupBy({
          by: ["agregadoId"],
          where: { agregadoTipo: "Lead", agregadoId: { in: perdidos.map((p) => p.id) } },
          _max: { criadoEm: true },
        })
      : [];
    const mapa = new Map(ultimas.map((u) => [u.agregadoId, u._max.criadoEm]));
    const ids = perdidos.filter((p) => (mapa.get(p.id) ?? p.criadoEm) >= corte).map((p) => p.id);
    wherePerdido = { AND: [wherePerdido, { id: { in: ids } }] };
  }
  const whereDa = (etapa: EtapaLead): Prisma.OportunidadeWhereInput =>
    etapa === EtapaLead.PERDIDO ? wherePerdido : { AND: [base, { etapa }] };

  return Promise.all(
    COLUNAS_FUNIL.map(async (etapa): Promise<ColunaFunil> => {
      const where = whereDa(etapa);
      // "tempo": ordena pela data do último evento de mudança de etapa (etapaDesde), a mais antiga primeiro.
      let idsTempo: string[] | null = null;
      if (f.ordem === "tempo") {
        const todas = await prisma.oportunidade.findMany({ where, select: { id: true, criadoEm: true } });
        const mud = todas.length
          ? await prisma.evento.groupBy({
              by: ["agregadoId"],
              where: { agregadoTipo: "Lead", tipo: { in: TIPOS_MUDAM_ETAPA }, agregadoId: { in: todas.map((t) => t.id) } },
              _max: { criadoEm: true },
            })
          : [];
        const desde = new Map(mud.map((m) => [m.agregadoId, m._max.criadoEm]));
        idsTempo = todas
          .map((t) => ({ id: t.id, em: (desde.get(t.id) ?? t.criadoEm).getTime() }))
          .sort((a, b) => a.em - b.em || (a.id < b.id ? -1 : 1))
          .slice(0, CARTOES_POR_COLUNA)
          .map((t) => t.id);
      }
      const [grupos, linhasBrutas] = await Promise.all([
        prisma.oportunidade.groupBy({
          by: ["paisId"],
          where,
          _count: { _all: true },
          _sum: { valorPrevisto: true },
        }),
        prisma.oportunidade.findMany({
          where: idsTempo ? { AND: [where, { id: { in: idsTempo } }] } : where,
          orderBy: ordenacao(f.ordem),
          take: CARTOES_POR_COLUNA,
          include: {
            pais: { select: { nome: true, moedaLocal: true } },
            vendedor: { select: { id: true, nome: true } },
            pessoa: { select: { tags: { select: { tag: { select: { id: true, nome: true, cor: true } } } } } },
          },
        }),
      ]);

      const linhas = idsTempo
        ? [...linhasBrutas].sort((a, b) => idsTempo!.indexOf(a.id) - idsTempo!.indexOf(b.id))
        : linhasBrutas;
      const total = grupos.reduce((s, g) => s + g._count._all, 0);
      const paisesIds = grupos.map((g) => g.paisId).filter((x): x is string => !!x);
      const paises = paisesIds.length
        ? await prisma.pais.findMany({ where: { id: { in: paisesIds } }, select: { id: true, moedaLocal: true } })
        : [];
      const moedaDoPais = new Map(paises.map((p) => [p.id, p.moedaLocal]));
      const somas = new Map<string, Prisma.Decimal>();
      for (const g of grupos) {
        const moeda = g.paisId ? moedaDoPais.get(g.paisId) : undefined;
        if (!moeda || !g._sum.valorPrevisto) continue;
        somas.set(moeda, (somas.get(moeda) ?? new Prisma.Decimal(0)).plus(g._sum.valorPrevisto));
      }
      const somaPorMoeda = [...somas.entries()]
        .map(([moeda, valor]) => ({ moeda, valor: valor.toFixed(2) }))
        .sort((a, b) => ordemMoeda(a.moeda) - ordemMoeda(b.moeda) || a.moeda.localeCompare(b.moeda));

      const ids = linhas.map((l) => l.id);
      const [ultimas, mudancas] = ids.length
        ? await Promise.all([
            prisma.evento.groupBy({
              by: ["agregadoId"],
              where: { agregadoTipo: "Lead", agregadoId: { in: ids } },
              _max: { criadoEm: true },
            }),
            prisma.evento.groupBy({
              by: ["agregadoId"],
              where: { agregadoTipo: "Lead", tipo: { in: TIPOS_MUDAM_ETAPA }, agregadoId: { in: ids } },
              _max: { criadoEm: true },
            }),
          ])
        : [[], []];
      const mapUltima = new Map(ultimas.map((u) => [u.agregadoId, u._max.criadoEm]));
      const mapEtapa = new Map(mudancas.map((u) => [u.agregadoId, u._max.criadoEm]));

      const cartoes: CartaoFunil[] = linhas.map((l) => ({
        id: l.id,
        codigo: l.codigo,
        nome: l.nome,
        b2b: l.b2b,
        etapa: l.etapa,
        temperatura: l.temperatura,
        valorPrevisto: l.valorPrevisto ? l.valorPrevisto.toFixed(2) : null,
        moeda: l.pais?.moedaLocal ?? null,
        pais: l.pais?.nome ?? null,
        dono: l.vendedor ? { id: l.vendedor.id, nome: l.vendedor.nome } : null,
        proximaAcao: l.proximaAcao,
        proximoFollowUp: l.proximoFollowUp,
        dataExperimental: l.dataExperimental,
        etapaDesde: mapEtapa.get(l.id) ?? l.criadoEm,
        ultimaAcaoEm: mapUltima.get(l.id) ?? l.criadoEm,
        tags: (l.pessoa?.tags ?? []).map((t) => t.tag).sort((a, b) => a.nome.localeCompare(b.nome)),
        pessoaId: l.pessoaId,
      }));

      return { etapa, total, somaPorMoeda, cartoes, possuiMais: total > cartoes.length };
    }),
  );
}

async function ultimaMensagemPorLeadLegado(ids: string[]): Promise<{ leadId: string; ultima: Date | null }[]> {
  return prisma.$queryRaw<{ leadId: string; ultima: Date | null }[]>`
    SELECT a."leadId" AS "leadId", MAX(m."criadoEm") AS "ultima"
    FROM "MensagemWhatsApp" m
    JOIN "AtendimentoWhatsApp" a ON a.id = m."atendimentoId"
    WHERE a."leadId" IN (${Prisma.join(ids)})
      AND (m.direcao = 'ENTRADA' OR (m.status IN ('ENVIADA', 'ENTREGUE', 'LIDA') AND m.origem IN ('HUMANO', 'CELULAR')))
    GROUP BY a."leadId"`;
}

const maisRecente = (a: Date | null | undefined, b: Date | null | undefined): Date | null =>
  !a ? b ?? null : !b ? a : a > b ? a : b;

const diasCivis = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** Linhas e total de `carregarCarteira` como eram calculados antes do B19 (tudo em memória). */
export async function carregarCarteiraLegado(
  usuario: UsuarioSessao,
  f: FiltrosCarteira,
  limite = MAX_LINHAS_CARTEIRA,
): Promise<{ linhas: LinhaCarteira[]; total: number }> {
  const agora = new Date();
  const config = await prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  const fuso = config?.fusoInstitucional ?? "America/Sao_Paulo";
  const hoje = dataCivilInstitucional(agora, fuso);
  const escopoAberto: Prisma.OportunidadeWhereInput = { AND: [await escopoComercialAtual(usuario), { etapa: { not: "PERDIDO" } }] };
  const palavras = palavrasDaBuscaLeads(f.busca);
  const where: Prisma.OportunidadeWhereInput = {
    AND: [
      escopoAberto,
      ...(f.donoId ? [{ vendedorDonoId: f.donoId }] : []),
      ...(f.tipo !== "todos" ? [{ b2b: f.tipo === "pj" }] : []),
      ...(f.emTurma ? [{ matricula: { is: { alocacoes: { some: { ativa: true } } } } }] : []),
      ...palavras.map((palavra) => {
        const contem = { contains: palavra, mode: "insensitive" as const };
        return { OR: [{ nome: contem }, { codigo: contem }] };
      }),
    ],
  };
  const brutas = await prisma.oportunidade.findMany({
    where,
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: {
      id: true, nome: true, b2b: true, etapa: true, pessoaId: true, empresaId: true, criadoEm: true,
      vendedor: { select: { id: true, nome: true } },
      pessoa: { select: { tags: { select: { tag: { select: { id: true, nome: true, cor: true } } } } } },
      matricula: { select: { alocacoes: { where: { ativa: true }, take: 1, select: { turma: { select: { nome: true } } } } } },
    },
  });
  const ids = brutas.map((o) => o.id);
  const [ultimos, mensagens] = ids.length
    ? await Promise.all([
        prisma.evento.groupBy({ by: ["agregadoId"], where: { agregadoTipo: "Lead", agregadoId: { in: ids }, tipo: { in: [...EVENTOS_DE_CONTATO_SEM_INTERACAO] } }, _max: { criadoEm: true } }),
        ultimaMensagemPorLeadLegado(ids),
      ])
    : [[], []];
  const ultimoPor = new Map<string, Date | null>(ultimos.map((u) => [u.agregadoId, u._max.criadoEm]));
  for (const m of mensagens) ultimoPor.set(m.leadId, maisRecente(ultimoPor.get(m.leadId), m.ultima));
  const minimo = f.semInteracaoDias ? Number(f.semInteracaoDias) : 0;
  const todas = brutas
    .map((o): LinhaCarteira => ({
      oportunidadeId: o.id,
      pessoaId: o.pessoaId,
      empresaId: o.empresaId,
      nome: o.nome,
      tipo: o.b2b ? "pj" : "pf",
      etapa: o.etapa,
      dono: o.vendedor,
      diasSemInteracao: Math.max(0, diasCivis(dataCivilInstitucional(ultimoPor.get(o.id) ?? o.criadoEm, fuso), hoje)),
      turmaAtiva: o.matricula?.alocacoes[0]?.turma.nome ?? null,
      tags: (o.pessoa?.tags ?? []).map((t) => t.tag),
    }))
    .filter((l) => l.diasSemInteracao >= minimo);
  const linhas = todas.sort((a, b) => b.diasSemInteracao - a.diasSemInteracao || (a.oportunidadeId < b.oportunidadeId ? -1 : 1)).slice(0, limite);
  return { linhas, total: todas.length };
}
