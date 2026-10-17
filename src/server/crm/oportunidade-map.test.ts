import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(nome) && nome !== "oportunidade-map.test.ts") acc.push(p);
  }
  return acc;
}

function grepSrc(re: RegExp): string[] {
  const achados: string[] = [];
  for (const f of [...arquivos("src"), ...arquivos("scripts").filter(Boolean)]) {
    if (re.test(readFileSync(f, "utf-8"))) achados.push(f);
  }
  return achados;
}

describe("model Oportunidade", () => {
  it("Oportunidade mapeia a tabela Lead sem renomeá-la", () => {
    const s = readFileSync("prisma/schema.prisma", "utf-8");
    expect(s).toMatch(/model Oportunidade \{[\s\S]*?@@map\("Lead"\)[\s\S]*?\n\}/);
    expect(s).not.toMatch(/^model Lead \{/m);
  });
  // Qualquer receptor (prisma, tx, db, ctx, cliente...) chamando um método do
  // delegate. Campos de relação `lead` em include/select não casam.
  const DELEGATE_ANTIGO =
    /\b\w+\.lead\.(?:findMany|findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)\b/;
  it("a trava pega qualquer receptor e ignora include/select", () => {
    for (const uso of ["tx.lead.update(", "prisma.lead.findMany(", "cliente.lead.count(", "ctx.db.lead.groupBy("]) {
      expect(DELEGATE_ANTIGO.test(uso), uso).toBe(true);
    }
    for (const campo of ["include: { lead: true }", "select: { lead: { select: { id: true } } }", "evento.lead.nome"]) {
      expect(DELEGATE_ANTIGO.test(campo), campo).toBe(false);
    }
  });
  it("nenhum uso do delegate antigo", () => {
    expect(grepSrc(DELEGATE_ANTIGO)).toEqual([]);
  });
});
