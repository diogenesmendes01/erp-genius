import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Papel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hrefDaAbaAtiva } from "@/lib/nav";
import { PAPEIS_MATRICULA, SECOES_MATRICULA, secoesParaPapeis } from "./secoes";

const RAIZ = join("src", "app", "(app)", "matriculas", "[id]");

function papeisDoGuardFonte(fonte: string, origem: string): string[] {
  const chamada = fonte.match(/exigirSessaoPagina\(([^)]*)\)/);
  if (!chamada) throw new Error(`${origem}: sem exigirSessaoPagina(...)`);
  const papeis = [...chamada[1].matchAll(/Papel\.(\w+)/g)].map((m) => m[1]);
  const resto = chamada[1].replace(/Papel\.\w+/g, "").replace(/[\s,]/g, "");
  if (papeis.length === 0 || resto !== "") throw new Error(`${origem}: exigirSessaoPagina com papéis não literais (${chamada[1].trim()}) — use Papel.X`);
  return papeis.sort();
}

const papeisDoGuard = (relativo: string) => papeisDoGuardFonte(readFileSync(join(RAIZ, relativo), "utf-8"), relativo);

describe("seções da matrícula", () => {
  it.each(SECOES_MATRICULA.map((s) => [s.caminho, s] as const))("%s: a aba existe e tem os mesmos papéis do guard da página", (caminho, secao) => {
    expect(existsSync(join(RAIZ, caminho, "page.tsx"))).toBe(true);
    expect([...secao.papeis].sort()).toEqual(papeisDoGuard(join(caminho, "page.tsx")));
  });

  it("cada papel vê só as abas que abre; administrador vê todas", () => {
    const rotulos = (papeis: Papel[]) => secoesParaPapeis(papeis, "m1", "a1").map((s) => s.label);
    expect(rotulos([Papel.VENDEDOR])).toEqual(["Preparação", "Reserva"]);
    expect(rotulos([Papel.FINANCEIRO])).toEqual([
      "Pagador", "Condições de entrada", "Condições por hora", "Continuidade mensal", "Entrada particular",
      "Disponibilidade", "Indisponibilidade", "Ocorrências financeiras", "Fechamentos de horas",
    ]);
    expect(rotulos([Papel.ADMINISTRADOR])).toHaveLength(SECOES_MATRICULA.length);
    expect(rotulos([Papel.PROFESSOR])).toEqual([]);
  });

  it("os links apontam para a seção da matrícula", () => {
    expect(secoesParaPapeis([Papel.SECRETARIA_ACADEMICA], "abc")[0]).toEqual({ href: "/matriculas/abc/preparacao", label: "Preparação" });
  });

  it("\"Fechamentos de horas\" leva o aluno (?aluno=) e acende pelo caminho; sem aluno, a aba não aparece (docs/42 L905)", () => {
    const comAluno = secoesParaPapeis([Papel.FINANCEIRO], "m 1", "a/1");
    expect(comAluno.find((s) => s.label === "Fechamentos de horas")).toEqual({
      href: "/matriculas/m 1/fechamentos-horas?aluno=a%2F1", label: "Fechamentos de horas", prefixo: "/matriculas/m 1/fechamentos-horas",
    });
    expect(hrefDaAbaAtiva("/matriculas/m 1/fechamentos-horas", comAluno)).toBe("/matriculas/m 1/fechamentos-horas?aluno=a%2F1");
    expect(secoesParaPapeis([Papel.FINANCEIRO], "m1").map((s) => s.label)).not.toContain("Fechamentos de horas");
    expect(secoesParaPapeis([Papel.FINANCEIRO], "m1", null).map((s) => s.label)).not.toContain("Fechamentos de horas");
  });
});

describe("guard do layout de /matriculas/[id]", () => {
  it("nenhuma página abaixo de /matriculas/[id] libera um papel que o layout bloquearia (e toda página tem guard legível)", () => {
    const permitidos = new Set<string>([...PAPEIS_MATRICULA, Papel.ADMINISTRADOR]);
    const paginas = (readdirSync(RAIZ, { recursive: true }) as string[]).filter((f) => f.endsWith("page.tsx") && f !== "page.tsx");
    expect(paginas.length).toBeGreaterThan(30);
    const fora = paginas.flatMap((f) => papeisDoGuard(f).filter((p) => !permitidos.has(p)).map((p) => `${f}: ${p}`));
    expect(fora).toEqual([]);
  });
});
