import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Papel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { SECOES_MATRICULA, secoesParaPapeis } from "./secoes";

const RAIZ = join("src", "app", "(app)", "matriculas", "[id]");

/** Papéis passados ao exigirSessaoPagina(...) da página da seção. */
function papeisDoGuard(caminho: string): string[] {
  const fonte = readFileSync(join(RAIZ, caminho, "page.tsx"), "utf-8");
  const chamada = fonte.match(/exigirSessaoPagina\(([^)]*)\)/);
  if (!chamada) throw new Error(`${caminho}: page.tsx sem exigirSessaoPagina`);
  return [...chamada[1].matchAll(/Papel\.(\w+)/g)].map((m) => m[1]).sort();
}

describe("seções da matrícula", () => {
  it.each(SECOES_MATRICULA.map((s) => [s.caminho, s] as const))("%s: a aba existe e tem os mesmos papéis do guard da página", (caminho, secao) => {
    expect(existsSync(join(RAIZ, caminho, "page.tsx"))).toBe(true);
    expect([...secao.papeis].sort()).toEqual(papeisDoGuard(caminho));
  });

  it("cada papel vê só as abas que abre; administrador vê todas", () => {
    const rotulos = (papeis: Papel[]) => secoesParaPapeis(papeis, "m1").map((s) => s.label);
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
});

describe("guard do layout de /matriculas/[id]", () => {
  it("nenhuma página abaixo de /matriculas/[id] libera um papel que o layout bloquearia", async () => {
    const { readdirSync } = await import("node:fs");
    const { PAPEIS_MATRICULA } = await import("./secoes");
    const permitidos = new Set<string>([...PAPEIS_MATRICULA, Papel.ADMINISTRADOR]);
    const paginas = (readdirSync(RAIZ, { recursive: true }) as string[]).filter((f) => f.endsWith("page.tsx") && f !== "page.tsx");
    expect(paginas.length).toBeGreaterThan(30);
    const fora = paginas.flatMap((f) => {
      const chamada = readFileSync(join(RAIZ, f), "utf-8").match(/exigirSessaoPagina\(([^)]*)\)/);
      return chamada ? [...chamada[1].matchAll(/Papel\.(\w+)/g)].map((m) => m[1]).filter((p) => !permitidos.has(p)).map((p) => `${f}: ${p}`) : [];
    });
    expect(fora).toEqual([]);
  });
});
