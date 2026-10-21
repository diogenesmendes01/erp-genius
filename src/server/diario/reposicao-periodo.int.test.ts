import { expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { periodoBeneficioReposicao, type RegraBeneficio } from "./reposicao-agenda-tx";

it("SQL e aplicação usam a mesma âncora mensal inclusive após fevereiro", async () => {
  const regra: RegraBeneficio = { id: "calculo", referencia: "CICLO_MATRICULA", unidade: "MESES", duracaoPeriodo: 1,
    quantidadePorPeriodo: 2, antecedenciaCancelamentoMinutos: 60, referenciaCiclo: new Date("2026-01-31T00:00:00Z"),
    vigenteAPartirDe: new Date("2026-01-31T00:00:00Z") };
  const valor = JSON.stringify({ ...regra, referenciaCiclo: "2026-01-31", vigenteAPartirDe: "2026-01-31" });
  for (const data of ["2026-02-27", "2026-02-28", "2026-03-30", "2026-03-31", "2026-04-30"]) {
    const [sql] = await prisma.$queryRaw<{ inicio: string; fimExclusivo: string }[]>(Prisma.sql`
      SELECT inicio::text AS inicio, fim::text AS "fimExclusivo"
      FROM periodo_beneficio_reposicao(${data}::date,
        json_populate_record(NULL::"BeneficioReposicaoParticularMatricula", ${valor}::json))
    `);
    expect(sql).toEqual(periodoBeneficioReposicao(regra, data));
  }
});
