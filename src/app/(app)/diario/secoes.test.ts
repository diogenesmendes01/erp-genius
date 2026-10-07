import { existsSync } from "node:fs";
import { join } from "node:path";
import { Papel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { abasParaPapeis } from "@/lib/nav";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";
import { SECOES_DIARIO } from "./secoes";

const paginaDaRota = (href: string) => join("src", "app", "(app)", ...href.split("/").filter(Boolean), "page.tsx");
const rotulos = (papeis: Papel[]) => abasParaPapeis(SECOES_DIARIO, papeis).map((a) => a.label);

describe("seções de /diario", () => {
  it.each(SECOES_DIARIO.map((s) => [s.href, s] as const))("%s: a página existe e a aba tem os mesmos papéis do guard dela", (href, secao) => {
    const pagina = paginaDaRota(href);
    expect(existsSync(pagina)).toBe(true);
    expect([...secao.papeis].sort()).toEqual(papeisDoGuardArquivo(pagina));
  });

  it("cada papel vê só as abas que abre; administrador vê todas", () => {
    expect(rotulos([Papel.PROFESSOR])).toEqual([
      "Aulas", "Encontros", "Pendências", "Regularizações de aula", "Reposições", "Exceções de gravação",
    ]);
    expect(rotulos([Papel.GERENTE_PEDAGOGICO])).toEqual([
      "Aulas", "Encontros", "Pendências", "Regularizações de aula", "Exceções de gravação", "Regularizações de gravação",
    ]);
    // A Secretaria só abre Encontros (chega pelo acadêmico) — o layout não mostra barra de uma aba só.
    expect(rotulos([Papel.SECRETARIA_ACADEMICA])).toEqual(["Encontros"]);
    expect(rotulos([Papel.ADMINISTRADOR])).toHaveLength(SECOES_DIARIO.length);
    expect(rotulos([Papel.VENDEDOR])).toEqual([]);
  });

  it("só a raiz é exata; hrefs sem repetição", () => {
    expect(SECOES_DIARIO.filter((s) => s.exato).map((s) => s.href)).toEqual(["/diario"]);
    const hrefs = SECOES_DIARIO.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
