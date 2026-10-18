import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscopoRelatorio } from "./escopo";
import { atendimentosComerciais, fusoDaEscola } from "./atendimento";
import { instanteUtc, type FiltrosRelatorio, type ValorPorMoeda } from "./pipeline";
import { progressoMetas } from "@/server/metas/metas";

export interface DesempenhoUsuario {
  usuarioId: string;
  nome: string;
  oportunidades: number;
  ganhas: number;
  conversao: number | null;
  valorGanho: ValorPorMoeda[];
  primeiraRespostaMediaMin: number | null;
  tarefasConcluidas: number;
  comissao: ValorPorMoeda[];
  /**
   * Realização da meta do vendedor (matrículas, ou valor ganho se só houver essa); null sem meta. Metas são
   * mensais: com o período tocando mais de um mês, soma as metas e o realizado dos meses INTEIROS tocados (não
   * recorta pelos dias do filtro). VALOR_GANHO compara com a soma de `valorPrevisto` das oportunidades que
   * entraram em Matriculado (ver metas.ts).
   */
  meta: { pct: number | null };
}

const arred = (n: number) => Math.round(n * 100) / 100;

/** Competências (AAAA-MM, fuso da escola) tocadas pelo período. */
function competenciasDoPeriodo(ini: Date, fim: Date, fuso: string): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit" });
  const mes = (d: Date) => {
    const p = fmt.formatToParts(d);
    return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
  };
  const out = new Set<string>();
  const ultimo = mes(new Date(fim.getTime() - 1));
  for (let t = ini.getTime(); t < fim.getTime(); t += 86_400_000) out.add(mes(new Date(t)));
  out.add(ultimo);
  return [...out].sort();
}

/**
 * Desempenho por vendedor/gerente ativo dentro do escopo (vendedor vê só a própria linha).
 * - oportunidades: criadas no período com o usuário como dono; ganhas: entraram em MATRICULADO no período
 *   (evento de etapa) com o usuário como dono; conversão = das criadas no período, as hoje MATRICULADO.
 * - comissão: `aprovadaEm` no período, status diferente de ESTORNADA (a comissão não tem CANCELADA), por moeda.
 * - primeira resposta: média dos atendimentos comerciais do período em que o usuário é o responsável.
 */
export async function desempenhoEquipe(f: FiltrosRelatorio, e: EscopoRelatorio): Promise<DesempenhoUsuario[]> {
  const ini = instanteUtc(f.periodo.inicio);
  const fim = instanteUtc(f.periodo.fim);
  const iniTz = Prisma.sql`${f.periodo.inicio}::timestamptz`;
  const fimTz = Prisma.sql`${f.periodo.fim}::timestamptz`;

  const permitidos = e.tipo === "USUARIOS" ? e.ids : null;
  const unico = f.responsavelId ? [f.responsavelId] : null;
  const filtroId = unico ? (permitidos ? unico.filter((x) => permitidos.includes(x)) : unico) : permitidos;
  const usuarios = await prisma.usuario.findMany({
    where: {
      ativo: true,
      papeis: { hasSome: [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] },
      ...(filtroId ? { id: { in: filtroId } } : {}),
    },
    select: { id: true, nome: true },
    orderBy: [{ nome: "asc" }, { id: "asc" }],
  });
  if (!usuarios.length) return [];
  const ids = usuarios.map((u) => u.id);
  const idsSql = Prisma.join(ids);

  const filtrosLead: Prisma.Sql[] = [];
  if (f.origem) filtrosLead.push(Prisma.sql`l."origemCanal"::text = ${f.origem}`);
  if (f.temperatura) filtrosLead.push(Prisma.sql`l."temperatura"::text = ${f.temperatura}`);
  const extraLead = filtrosLead.length ? Prisma.sql` AND ${Prisma.join(filtrosLead, " AND ")}` : Prisma.empty;

  const criadas = await prisma.$queryRaw<{ dono: string; criadas: bigint; viraram: bigint }[]>(Prisma.sql`
    SELECT l."vendedorDonoId" AS dono, COUNT(*) AS criadas, COUNT(*) FILTER (WHERE l.etapa::text = 'MATRICULADO') AS viraram
    FROM "Lead" l
    WHERE l."vendedorDonoId" IN (${idsSql}) AND l."criadoEm" >= ${ini} AND l."criadoEm" < ${fim}${extraLead}
    GROUP BY 1`);

  const ganhas = await prisma.$queryRaw<{ dono: string; moeda: string | null; n: bigint; valor: number | null }[]>(Prisma.sql`
    SELECT l."vendedorDonoId" AS dono, p."moedaLocal" AS moeda, COUNT(*) AS n, SUM(l."valorPrevisto")::float8 AS valor
    FROM "Lead" l
    JOIN (
      SELECT ev."agregadoId" AS lid, MIN(ev."criadoEm") AS em
      FROM "Evento" ev
      WHERE ev."agregadoTipo" = 'Lead' AND ev.tipo = 'EtapaAlterada' AND ev.payload ->> 'para' = 'MATRICULADO'
      GROUP BY ev."agregadoId"
    ) g ON g.lid = l.id
    LEFT JOIN "Pais" p ON p.id = l."paisId"
    WHERE l."vendedorDonoId" IN (${idsSql}) AND g.em >= ${ini} AND g.em < ${fim}${extraLead}
    GROUP BY 1, 2`);

  const resp = await prisma.$queryRaw<{ dono: string; media: number | null }[]>(Prisma.sql`
    SELECT a."responsavelId" AS dono,
           AVG(EXTRACT(EPOCH FROM (a."primeiraRespostaEm" - a."primeiroInboundEm")) / 60.0)
             FILTER (WHERE a."primeiroInboundEm" IS NOT NULL AND a."primeiraRespostaEm" >= a."primeiroInboundEm")::float8 AS media
    FROM "AtendimentoWhatsApp" a LEFT JOIN "Lead" l ON l.id = a."leadId"
    WHERE ${atendimentosComerciais(f, e)} AND a."responsavelId" IN (${idsSql})
    GROUP BY 1`);

  const tarefas = await prisma.$queryRaw<{ dono: string; n: bigint }[]>(Prisma.sql`
    SELECT t."concluidaPorId" AS dono, COUNT(*) AS n
    FROM "Tarefa" t
    WHERE t.status::text = 'CONCLUIDA' AND t."concluidaPorId" IN (${idsSql}) AND t."concluidaEm" >= ${iniTz} AND t."concluidaEm" < ${fimTz}
    GROUP BY 1`);

  const comissoes = await prisma.$queryRaw<{ dono: string; moeda: string; valor: number }[]>(Prisma.sql`
    SELECT c."vendedorId" AS dono, c.moeda, SUM(c.valor)::float8 AS valor
    FROM "Comissao" c
    WHERE c."vendedorId" IN (${idsSql}) AND c."aprovadaEm" >= ${ini} AND c."aprovadaEm" < ${fim} AND c.status::text <> 'ESTORNADA'
    GROUP BY 1, 2 ORDER BY 2`);

  const fuso = await fusoDaEscola();
  const metas = await progressoMetas({ competencias: competenciasDoPeriodo(f.periodo.inicio, f.periodo.fim, fuso), escopo: { tipo: "USUARIOS", ids } });

  return usuarios.map((u) => {
    const c = criadas.find((x) => x.dono === u.id);
    const gs = ganhas.filter((x) => x.dono === u.id);
    const oportunidades = c ? Number(c.criadas) : 0;
    const porMoeda = gs.filter((g) => g.moeda != null && g.valor != null).sort((a, b) => a.moeda!.localeCompare(b.moeda!));
    const minhas = metas.filter((m) => m.usuarioId === u.id);
    const meta = minhas.find((m) => m.metrica === "MATRICULAS") ?? minhas.find((m) => m.metrica === "VALOR_GANHO");
    const media = resp.find((x) => x.dono === u.id)?.media;
    return {
      usuarioId: u.id,
      nome: u.nome,
      oportunidades,
      ganhas: gs.reduce((s, g) => s + Number(g.n), 0),
      conversao: oportunidades > 0 ? Number(c!.viraram) / oportunidades : null,
      valorGanho: porMoeda.map((g) => ({ moeda: g.moeda!, valor: arred(Number(g.valor)) })),
      primeiraRespostaMediaMin: media == null ? null : arred(Number(media)),
      tarefasConcluidas: Number(tarefas.find((x) => x.dono === u.id)?.n ?? 0),
      comissao: comissoes.filter((x) => x.dono === u.id).map((x) => ({ moeda: x.moeda, valor: arred(Number(x.valor)) })),
      meta: { pct: meta?.pct ?? null },
    };
  });
}
