import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { Papel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { abasParaPapeis } from "@/lib/nav";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";
import { SECOES_ACADEMICO } from "./secoes";

const pastaDaRota = (href: string) => join("src", "app", "(app)", ...href.split("/").filter(Boolean));
const rotulos = (papeis: Papel[]) => abasParaPapeis(SECOES_ACADEMICO, papeis).map((a) => a.label);

describe("seções de /academico", () => {
  it.each(SECOES_ACADEMICO.map((s) => [s.href, s] as const))("%s: a página existe e a aba tem os mesmos papéis do guard dela", (href, secao) => {
    const pagina = join(pastaDaRota(href), "page.tsx");
    expect(existsSync(pagina)).toBe(true);
    expect([...secao.papeis].sort()).toEqual(papeisDoGuardArquivo(pagina));
  });

  it("cada papel vê só as abas que abre; administrador vê todas; quem não é da área, nenhuma", () => {
    expect(rotulos([Papel.PROFESSOR])).toEqual([
      "Mudanças acadêmicas", "Avaliações", "Recuperações", "Minhas recuperações", "Minhas segundas chamadas", "Indisponibilidades docentes",
    ]);
    expect(rotulos([Papel.SECRETARIA_ACADEMICA])).toEqual([
      "Mudanças acadêmicas", "Segundas chamadas pendentes", "Agendas de segunda chamada", "Aproveitamentos", "Reposições",
      "Indisponibilidades docentes", "Grades", "Quantidade de aulas", "Calendário", "Admissões",
    ]);
    expect(rotulos([Papel.GERENTE_PEDAGOGICO])).toEqual([
      "Mudanças acadêmicas", "Avaliações", "Recuperações", "Segundas chamadas pendentes", "Agendas de segunda chamada",
      "Regras de avaliação", "Correções", "Aproveitamentos", "Reposições", "Indisponibilidades docentes", "Grades",
      "Quantidade de aulas", "Calendário", "Admissões",
    ]);
    expect(rotulos([Papel.ADMINISTRADOR])).toHaveLength(SECOES_ACADEMICO.length);
    expect(rotulos([Papel.FINANCEIRO])).toEqual([]);
  });

  it("as áreas que a raiz omitia (Aproveitamentos, Recuperações) agora têm aba", () => {
    const hrefs = SECOES_ACADEMICO.map((s) => s.href);
    expect(hrefs).toContain("/academico/equivalencias");
    expect(hrefs).toContain("/academico/recuperacoes");
  });

  it("só a raiz é exata, e todo prefixo próprio é uma pasta real que contém a página da aba", () => {
    expect(SECOES_ACADEMICO.filter((s) => s.exato).map((s) => s.href)).toEqual(["/academico"]);
    for (const s of SECOES_ACADEMICO.filter((x) => x.prefixo)) {
      expect(statSync(pastaDaRota(s.prefixo!)).isDirectory()).toBe(true);
      expect(s.href.startsWith(s.prefixo + "/")).toBe(true);
    }
  });

  it("hrefs sem repetição", () => {
    const hrefs = SECOES_ACADEMICO.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
