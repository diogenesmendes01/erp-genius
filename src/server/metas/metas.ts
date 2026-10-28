import { MetricaMeta, Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { numero } from "@/server/_shared/decimal";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento, type Resultado } from "@/server/_shared";
import type { EscopoRelatorio } from "@/server/relatorios/escopo";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { instanteUtc } from "@/server/relatorios/pipeline";
import { periodoDoFiltro } from "@/server/relatorios/periodo";

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
    if (i.usuarioId === null && !ehAdmin) throw new ErroRegra("Só o administrador define a meta geral.");
    if (i.usuarioId !== null) {
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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ErroRegra("Esta meta acabou de ser salva por outra pessoa. Confira a tabela e salve de novo se quiser mudar o valor.");
      throw e;
    });
  });
}

export function competenciaAnterior(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 2, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function copiarMetasMesAnterior(competenciaDestino: string): Promise<Resultado<{ copiadas: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
    if (typeof competenciaDestino !== "string" || !COMPETENCIA.test(competenciaDestino)) throw new ErroRegra("Competência inválida: use AAAA-MM.");
    const competenciaOrigem = competenciaAnterior(competenciaDestino);
    const ehAdmin = autor.papeis.includes(Papel.ADMINISTRADOR);
    const whereOrigem: Prisma.MetaComercialWhereInput = { competencia: competenciaOrigem };
    if (ehAdmin) {
      whereOrigem.OR = [
        { usuarioId: null },
        { usuario: { ativo: true, papeis: { hasSome: [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] } } },
      ];
    } else {
      whereOrigem.usuario = { gerenteComercialId: autor.id, ativo: true };
    }
    const origem = await prisma.metaComercial.findMany({ where: whereOrigem });
    let copiadas = 0;
    await prisma.$transaction(async (tx) => {
      for (const m of origem) {
        const chave = { competencia: competenciaDestino, usuarioId: m.usuarioId, metrica: m.metrica, moeda: m.moeda };
        const atual = await tx.metaComercial.findFirst({ where: chave });
        const valor = numero(m.valor);
        const meta = atual
          ? await tx.metaComercial.update({ where: { id: atual.id }, data: { valor } })
          : await tx.metaComercial.create({ data: { ...chave, valor, criadaPorId: autor.id } });
        await registrarEvento(tx, {
          tipo: "MetaDefinida",
          agregadoTipo: "MetaComercial",
          agregadoId: meta.id,
          autorId: autor.id,
          payload: { ...chave, de: atual ? numero(atual.valor) : null, para: valor, origem: competenciaOrigem },
        });
        copiadas += 1;
      }
    }).catch((e: unknown) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ErroRegra("Esta meta acabou de ser salva por outra pessoa. Confira a tabela e salve de novo se quiser mudar o valor.");
      throw e;
    });
    return { copiadas };
  });
}

const ENTRADA_REALIZADO: Record<MetricaMeta, { chave: string; etapa: string; tipoProprio: string | null }> = {
  MATRICULAS: { chave: "MATRICULADO", etapa: "MATRICULADO", tipoProprio: null },
  VALOR_GANHO: { chave: "MATRICULADO", etapa: "MATRICULADO", tipoProprio: null },
  EXPERIMENTAIS_REALIZADAS: { chave: "EXPERIMENTAL_REALIZADA", etapa: "EXPERIMENTAL_REALIZADA", tipoProprio: "ExperimentalRealizada" },
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

async function realizadoDe(entrada: { etapa: string; tipoProprio: string | null }, intervalos: { inicio: Date; fim: Date }[], escopo: EscopoRelatorio): Promise<Realizado[]> {
  const meses = Prisma.join(intervalos.map((p) => Prisma.sql`(g.em >= ${instanteUtc(p.inicio)} AND g.em < ${instanteUtc(p.fim)})`), " OR ");
  const donos = escopo.tipo === "TUDO" ? Prisma.empty : Prisma.sql`AND l."vendedorDonoId" IN (${escopo.ids.length ? Prisma.join(escopo.ids) : Prisma.sql`NULL`})`;
  const proprio = entrada.tipoProprio ? Prisma.sql` OR ev.tipo = ${entrada.tipoProprio}` : Prisma.empty;
  const linhas = await prisma.$queryRaw<{ dono: string | null; moeda: string | null; n: bigint; valor: number }[]>(Prisma.sql`
    SELECT l."vendedorDonoId" AS dono, p."moedaLocal" AS moeda, COUNT(*) AS n, COALESCE(SUM(l."valorPrevisto"), 0)::float8 AS valor
    FROM "Lead" l
    JOIN (
      SELECT ev."agregadoId" AS lid, MIN(ev."criadoEm") AS em
      FROM "Evento" ev
      WHERE ev."agregadoTipo" = 'Lead'
        AND ((ev.tipo = 'EtapaAlterada' AND ev.payload ->> 'para' = ${entrada.etapa})${proprio})
      GROUP BY ev."agregadoId"
    ) g ON g.lid = l.id
    LEFT JOIN "Pais" p ON p.id = l."paisId"
    WHERE (${meses}) ${donos}
    GROUP BY l."vendedorDonoId", p."moedaLocal"`);
  return linhas.map((x) => ({ dono: x.dono, moeda: x.moeda, n: Number(x.n), valor: Number(x.valor) }));
}

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
  const porEtapa = new Map<string, Realizado[]>();
  for (const g of agrupadas.values()) {
    const entrada = ENTRADA_REALIZADO[g.metrica];
    if (!porEtapa.has(entrada.chave)) porEtapa.set(entrada.chave, await realizadoDe(entrada, intervalos, i.escopo));
  }

  const resultado = [...agrupadas.values()];
  for (const g of resultado) {
    const linhas = (porEtapa.get(ENTRADA_REALIZADO[g.metrica].chave) ?? []).filter((r) => g.usuarioId === null || r.dono === g.usuarioId);
    let realizado: number;
    if (g.metrica === MetricaMeta.VALOR_GANHO) realizado = linhas.filter((r) => r.moeda === g.moeda).reduce((s, r) => s + r.valor, 0);
    else realizado = linhas.reduce((s, r) => s + r.n, 0);
    g.realizado = Math.round(realizado * 100) / 100;
    g.meta = Math.round(g.meta * 100) / 100;
    g.pct = g.meta > 0 ? g.realizado / g.meta : null;
  }
  return resultado;
}
