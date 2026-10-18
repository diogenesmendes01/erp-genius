import { MetricaMeta, Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { numero } from "@/server/_shared/decimal";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento, type Resultado } from "@/server/_shared";
import type { EscopoRelatorio } from "@/server/relatorios/escopo";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { instanteUtc } from "@/server/relatorios/pipeline";
import { periodoDoFiltro } from "@/server/relatorios/periodo";

// Metas comerciais mensais (Q9). `usuarioId = null` é a meta geral/de equipe: compara com a soma de todos
// os vendedores dentro do escopo de quem consulta. Meses sempre no fuso institucional.

const COMPETENCIA = /^(\d{4})-(0[1-9]|1[0-2])$/;
const METRICAS = Object.values(MetricaMeta) as string[];

export interface EntradaMeta {
  competencia: string;
  usuarioId: string | null;
  metrica: MetricaMeta;
  valor: number;
  moeda?: string;
}

export interface ProgressoMeta {
  usuarioId: string | null;
  metrica: MetricaMeta;
  meta: number;
  realizado: number;
  pct: number | null;
  moeda: string | null;
}

/** Define (ou regrava) a meta do mês. Administrador: qualquer um; gerente: ele mesmo e a equipe; vendedor: nunca. */
export async function salvarMeta(i: EntradaMeta): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
    if (typeof i.competencia !== "string" || !COMPETENCIA.test(i.competencia)) throw new ErroRegra("Competência inválida: use AAAA-MM.");
    if (!METRICAS.includes(i.metrica)) throw new ErroRegra("Métrica inválida.");
    if (typeof i.valor !== "number" || !Number.isFinite(i.valor) || i.valor < 0 || i.valor > 9_999_999_999) throw new ErroRegra("Valor da meta inválido.");
    const valor = Math.round(i.valor * 100) / 100;
    let moeda: string | null = null;
    if (i.metrica === MetricaMeta.VALOR_GANHO) {
      moeda = (i.moeda ?? "").trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(moeda)) throw new ErroRegra("Informe a moeda da meta de valor ganho.");
    }
    const ehAdmin = autor.papeis.includes(Papel.ADMINISTRADOR);
    if (i.usuarioId === null) {
      if (!ehAdmin) throw new ErroRegra("Só o administrador define a meta geral.");
    } else {
      const alvo = await prisma.usuario.findUnique({ where: { id: i.usuarioId }, select: { id: true, ativo: true, gerenteComercialId: true } });
      if (!alvo?.ativo) throw new ErroRegra("Vendedor não encontrado.");
      if (!ehAdmin && alvo.id !== autor.id && alvo.gerenteComercialId !== autor.id) throw new ErroRegra("Você só define metas da sua equipe.");
    }
    const chave = { competencia: i.competencia, usuarioId: i.usuarioId, metrica: i.metrica, moeda };
    await prisma.$transaction(async (tx) => {
      const atual = await tx.metaComercial.findFirst({ where: chave });
      const meta = atual
        ? await tx.metaComercial.update({ where: { id: atual.id }, data: { valor } })
        : await tx.metaComercial.create({ data: { ...chave, valor, criadaPorId: autor.id } });
      await registrarEvento(tx, {
        tipo: "MetaDefinida",
        agregadoTipo: "MetaComercial",
        agregadoId: meta.id,
        autorId: autor.id,
        payload: { ...chave, de: atual ? numero(atual.valor) : null, para: valor },
      });
    }).catch((e: unknown) => {
      // Corrida no índice único parcial: outra pessoa criou a mesma meta entre o findFirst e o create.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ErroRegra("Esta meta acabou de ser salva por outra pessoa. Confira a tabela e salve de novo se quiser mudar o valor.");
      throw e;
    });
  });
}

/** Etapa cuja primeira entrada (evento `EtapaAlterada`) conta como realizado de cada métrica. */
const ETAPA_REALIZADO: Record<MetricaMeta, string> = {
  MATRICULAS: "MATRICULADO",
  VALOR_GANHO: "MATRICULADO",
  EXPERIMENTAIS_REALIZADAS: "EXPERIMENTAL_REALIZADA",
};

function intervalosDosMeses(competencias: string[], fuso: string): { inicio: Date; fim: Date }[] {
  return competencias.map((c) => {
    const [a, mes] = c.split("-").map(Number);
    const ultimo = new Date(Date.UTC(a, mes, 0)).getUTCDate();
    const dd = (d: number) => `${c}-${String(d).padStart(2, "0")}`;
    return periodoDoFiltro({ tipo: "PERSONALIZADO", de: dd(1), ate: dd(ultimo) }, fuso);
  });
}

interface Realizado {
  dono: string | null;
  moeda: string | null;
  n: number;
  valor: number;
}

async function realizadoDe(etapa: string, intervalos: { inicio: Date; fim: Date }[], escopo: EscopoRelatorio): Promise<Realizado[]> {
  const meses = Prisma.join(intervalos.map((p) => Prisma.sql`(g.em >= ${instanteUtc(p.inicio)} AND g.em < ${instanteUtc(p.fim)})`), " OR ");
  const donos = escopo.tipo === "TUDO" ? Prisma.empty : Prisma.sql`AND l."vendedorDonoId" IN (${escopo.ids.length ? Prisma.join(escopo.ids) : Prisma.sql`NULL`})`;
  const linhas = await prisma.$queryRaw<{ dono: string | null; moeda: string | null; n: bigint; valor: number }[]>(Prisma.sql`
    SELECT l."vendedorDonoId" AS dono, p."moedaLocal" AS moeda, COUNT(*) AS n, COALESCE(SUM(l."valorPrevisto"), 0)::float8 AS valor
    FROM "Lead" l
    JOIN (
      SELECT ev."agregadoId" AS lid, MIN(ev."criadoEm") AS em
      FROM "Evento" ev
      WHERE ev."agregadoTipo" = 'Lead' AND ev.tipo = 'EtapaAlterada' AND ev.payload ->> 'para' = ${etapa}
      GROUP BY ev."agregadoId"
    ) g ON g.lid = l.id
    LEFT JOIN "Pais" p ON p.id = l."paisId"
    WHERE (${meses}) ${donos}
    GROUP BY l."vendedorDonoId", p."moedaLocal"`);
  return linhas.map((x) => ({ dono: x.dono, moeda: x.moeda, n: Number(x.n), valor: Number(x.valor) }));
}

/**
 * Meta × realizado nas competências (somadas). Só entram metas do escopo: administrador vê tudo (inclusive a
 * geral); os demais, só as dos vendedores listados. Meta de equipe (sem vendedor) compara com a soma do escopo.
 */
export async function progressoMetas(i: { competencias: string[]; escopo: EscopoRelatorio }): Promise<ProgressoMeta[]> {
  const competencias = [...new Set(i.competencias)].filter((c) => COMPETENCIA.test(c));
  if (!competencias.length) return [];
  const metas = await prisma.metaComercial.findMany({
    where: {
      competencia: { in: competencias },
      ...(i.escopo.tipo === "TUDO" ? {} : { usuarioId: { in: i.escopo.ids } }),
    },
    orderBy: [{ usuarioId: "asc" }, { metrica: "asc" }, { moeda: "asc" }, { competencia: "asc" }],
  });
  if (!metas.length) return [];

  const agrupadas = new Map<string, ProgressoMeta>();
  for (const m of metas) {
    const k = `${m.usuarioId ?? ""}|${m.metrica}|${m.moeda ?? ""}`;
    const g = agrupadas.get(k) ?? { usuarioId: m.usuarioId, metrica: m.metrica, meta: 0, realizado: 0, pct: null, moeda: m.moeda };
    g.meta += numero(m.valor);
    agrupadas.set(k, g);
  }

  const intervalos = intervalosDosMeses(competencias, await fusoDaEscola());
  const etapas = [...new Set([...agrupadas.values()].map((g) => ETAPA_REALIZADO[g.metrica]))];
  const porEtapa = new Map<string, Realizado[]>();
  for (const e of etapas) porEtapa.set(e, await realizadoDe(e, intervalos, i.escopo));

  const resultado = [...agrupadas.values()];
  for (const g of resultado) {
    const linhas = (porEtapa.get(ETAPA_REALIZADO[g.metrica]) ?? []).filter((r) => g.usuarioId === null || r.dono === g.usuarioId);
    let realizado: number;
    if (g.metrica === MetricaMeta.VALOR_GANHO) realizado = linhas.filter((r) => r.moeda === g.moeda).reduce((s, r) => s + r.valor, 0);
    else realizado = linhas.reduce((s, r) => s + r.n, 0);
    g.realizado = Math.round(realizado * 100) / 100;
    g.meta = Math.round(g.meta * 100) / 100;
    g.pct = g.meta > 0 ? g.realizado / g.meta : null;
  }
  return resultado;
}
