import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EscopoRelatorio } from "./escopo";
import { fusoDaEscola } from "./atendimento";
import { instanteUtc, type FiltrosRelatorio } from "./pipeline";

export interface MetricasAtividades {
  tarefasCriadas: number;
  /** Concluídas / criadas no período (cancelada conta como não concluída); null sem tarefas. */
  tarefasConcluidasPct: number | null;
  mensagensAgendadas: number;
  porDia: { dia: string; criadas: number; concluidas: number }[];
  porOrigem: { origem: "ARIA" | "EQUIPE"; tarefas: number; mensagens: number }[];
}

const ORIGENS_ARIA = ["IA", "IA_SUGERIDA"];

/**
 * Condição SQL sobre `"Tarefa" t` e `"Lead" l` (LEFT JOIN): escopo do papel (responsável da tarefa OU dono da
 * oportunidade ligada) + filtros. `autor` separa o que a Aria criou do que a equipe criou.
 */
function condicoesTarefa(f: FiltrosRelatorio, e: EscopoRelatorio): Prisma.Sql {
  const partes: Prisma.Sql[] = [];
  if (e.tipo === "USUARIOS") {
    partes.push(
      e.ids.length
        ? Prisma.sql`(t."responsavelId" IN (${Prisma.join(e.ids)}) OR l."vendedorDonoId" IN (${Prisma.join(e.ids)}))`
        : Prisma.sql`FALSE`,
    );
  }
  if (f.responsavelId) partes.push(Prisma.sql`(t."responsavelId" = ${f.responsavelId} OR l."vendedorDonoId" = ${f.responsavelId})`);
  if (f.origem) partes.push(Prisma.sql`l."origemCanal"::text = ${f.origem}`);
  if (f.temperatura) partes.push(Prisma.sql`l."temperatura"::text = ${f.temperatura}`);
  if (f.autor) {
    const aria = Prisma.sql`t.origem::text IN (${Prisma.join(ORIGENS_ARIA)})`;
    partes.push(f.autor === "ARIA" ? aria : Prisma.sql`NOT (${aria})`);
  }
  return partes.length ? Prisma.join(partes, " AND ") : Prisma.sql`TRUE`;
}

/**
 * Atividades do período (fuso da escola nos dias): tarefas criadas, % concluída (coorte das criadas no
 * período), mensagens agendadas (`IntencaoMensagem.agendadaPara`) e a divisão Aria × equipe. Origem de
 * tarefa `IA`/`IA_SUGERIDA` = Aria; `HUMANO`/`AUTOMACAO` = equipe. Mensagem agendada de origem `IA` = Aria.
 */
export async function metricasAtividades(f: FiltrosRelatorio, e: EscopoRelatorio): Promise<MetricasAtividades> {
  const fuso = await fusoDaEscola();
  const cond = condicoesTarefa(f, e);
  const ini = instanteUtc(f.periodo.inicio);
  const fim = instanteUtc(f.periodo.fim);
  const iniTz = Prisma.sql`${f.periodo.inicio}::timestamptz`;
  const fimTz = Prisma.sql`${f.periodo.fim}::timestamptz`;
  const aria = Prisma.sql`t.origem::text IN (${Prisma.join(ORIGENS_ARIA)})`;

  const [tot] = await prisma.$queryRaw<{ criadas: bigint; concluidas: bigint; aria: bigint; equipe: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS criadas,
           COUNT(*) FILTER (WHERE t.status::text = 'CONCLUIDA') AS concluidas,
           COUNT(*) FILTER (WHERE ${aria}) AS aria,
           COUNT(*) FILTER (WHERE NOT (${aria})) AS equipe
    FROM "Tarefa" t LEFT JOIN "Lead" l ON l.id = t."leadId"
    WHERE ${cond} AND t."criadoEm" >= ${ini} AND t."criadoEm" < ${fim}`);

  const criadasDia = await prisma.$queryRaw<{ dia: string; n: bigint }[]>(Prisma.sql`
    SELECT to_char((t."criadoEm" AT TIME ZONE 'UTC') AT TIME ZONE ${fuso}, 'YYYY-MM-DD') AS dia, COUNT(*) AS n
    FROM "Tarefa" t LEFT JOIN "Lead" l ON l.id = t."leadId"
    WHERE ${cond} AND t."criadoEm" >= ${ini} AND t."criadoEm" < ${fim}
    GROUP BY 1`);
  const concluidasDia = await prisma.$queryRaw<{ dia: string; n: bigint }[]>(Prisma.sql`
    SELECT to_char(t."concluidaEm" AT TIME ZONE ${fuso}, 'YYYY-MM-DD') AS dia, COUNT(*) AS n
    FROM "Tarefa" t LEFT JOIN "Lead" l ON l.id = t."leadId"
    WHERE ${cond} AND t.status::text = 'CONCLUIDA' AND t."concluidaEm" >= ${iniTz} AND t."concluidaEm" < ${fimTz}
    GROUP BY 1`);
  const dias = new Map<string, { criadas: number; concluidas: number }>();
  for (const r of criadasDia) dias.set(r.dia, { criadas: Number(r.n), concluidas: 0 });
  for (const r of concluidasDia) {
    const d = dias.get(r.dia) ?? { criadas: 0, concluidas: 0 };
    d.concluidas = Number(r.n);
    dias.set(r.dia, d);
  }

  // Mensagens agendadas no período, no mesmo escopo (autor, responsável/dono da tarefa ou dono da oportunidade).
  const condMsg: Prisma.Sql[] = [Prisma.sql`i."agendadaPara" IS NOT NULL`, Prisma.sql`i."criadaEm" >= ${ini}`, Prisma.sql`i."criadaEm" < ${fim}`];
  if (e.tipo === "USUARIOS") {
    condMsg.push(
      e.ids.length
        ? Prisma.sql`(i."autorId" IN (${Prisma.join(e.ids)}) OR t."responsavelId" IN (${Prisma.join(e.ids)}) OR l."vendedorDonoId" IN (${Prisma.join(e.ids)}))`
        : Prisma.sql`FALSE`,
    );
  }
  if (f.responsavelId) condMsg.push(Prisma.sql`(i."autorId" = ${f.responsavelId} OR t."responsavelId" = ${f.responsavelId} OR l."vendedorDonoId" = ${f.responsavelId})`);
  if (f.origem) condMsg.push(Prisma.sql`l."origemCanal"::text = ${f.origem}`);
  if (f.temperatura) condMsg.push(Prisma.sql`l."temperatura"::text = ${f.temperatura}`);
  if (f.autor) condMsg.push(f.autor === "ARIA" ? Prisma.sql`i.origem::text = 'IA'` : Prisma.sql`i.origem::text <> 'IA'`);
  const [msg] = await prisma.$queryRaw<{ aria: bigint; equipe: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) FILTER (WHERE i.origem::text = 'IA') AS aria, COUNT(*) FILTER (WHERE i.origem::text <> 'IA') AS equipe
    FROM "IntencaoMensagem" i
    LEFT JOIN "Tarefa" t ON t.id = i."tarefaId"
    LEFT JOIN "Lead" l ON l.id = COALESCE(i."leadId", t."leadId")
    WHERE ${Prisma.join(condMsg, " AND ")}`);

  const criadas = Number(tot.criadas);
  const mAria = Number(msg.aria);
  const mEquipe = Number(msg.equipe);
  return {
    tarefasCriadas: criadas,
    tarefasConcluidasPct: criadas > 0 ? Number(tot.concluidas) / criadas : null,
    mensagensAgendadas: mAria + mEquipe,
    porDia: [...dias.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, v]) => ({ dia, ...v })),
    porOrigem: [
      { origem: "ARIA", tarefas: Number(tot.aria), mensagens: mAria },
      { origem: "EQUIPE", tarefas: Number(tot.equipe), mensagens: mEquipe },
    ],
  };
}
