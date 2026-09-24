import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Papel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PAPEIS_MATRICULA, SECOES_MATRICULA, secoesParaPapeis } from "./secoes";

const RAIZ = join("src", "app", "(app)", "matriculas", "[id]");

/**
 * Papéis passados ao exigirSessaoPagina(...) de uma página. Falha alto — em vez de devolver
 * vazio e deixar a trava cega — quando a página não chama o guard ou quando os papéis não vêm
 * como `Papel.X` literais (ex.: `...PAPEIS` ou uma constante), que este teste não consegue ler.
 * `[^)]*` atravessa quebras de linha: a chamada pode estar em várias linhas.
 */
function papeisDoGuardFonte(fonte: string, origem: string): string[] {
  const chamada = fonte.match(/exigirSessaoPagina\(([^)]*)\)/);
  if (!chamada) throw new Error(`${origem}: sem exigirSessaoPagina(...)`);
  const papeis = [...chamada[1].matchAll(/Papel\.(\w+)/g)].map((m) => m[1]);
  const resto = chamada[1].replace(/Papel\.\w+/g, "").replace(/[\s,]/g, "");
  if (papeis.length === 0 || resto !== "") throw new Error(`${origem}: exigirSessaoPagina com papéis não literais (${chamada[1].trim()}) — use Papel.X`);
  return papeis.sort();
}

const papeisDoGuard = (relativo: string) => papeisDoGuardFonte(readFileSync(join(RAIZ, relativo), "utf-8"), relativo);

describe("leitura do guard", () => {
  it("lê chamada em uma ou em várias linhas", () => {
    expect(papeisDoGuardFonte("await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);", "x")).toEqual(["ADMINISTRADOR", "FINANCEIRO"]);
    expect(papeisDoGuardFonte("await exigirSessaoPagina(\n  Papel.FINANCEIRO,\n  Papel.ADMINISTRADOR,\n);", "x")).toEqual(["ADMINISTRADOR", "FINANCEIRO"]);
  });

  it("falha alto sem guard ou com papéis não literais, em vez de passar calada", () => {
    expect(() => papeisDoGuardFonte("export default function P() {}", "x")).toThrow("sem exigirSessaoPagina");
    expect(() => papeisDoGuardFonte("await exigirSessaoPagina(...PAPEIS);", "x")).toThrow("não literais");
    expect(() => papeisDoGuardFonte("await exigirSessaoPagina(Papel.FINANCEIRO, ...OUTROS);", "x")).toThrow("não literais");
  });
});

describe("seções da matrícula", () => {
  it.each(SECOES_MATRICULA.map((s) => [s.caminho, s] as const))("%s: a aba existe e tem os mesmos papéis do guard da página", (caminho, secao) => {
    expect(existsSync(join(RAIZ, caminho, "page.tsx"))).toBe(true);
    expect([...secao.papeis].sort()).toEqual(papeisDoGuard(join(caminho, "page.tsx")));
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
  it("nenhuma página abaixo de /matriculas/[id] libera um papel que o layout bloquearia (e toda página tem guard legível)", () => {
    const permitidos = new Set<string>([...PAPEIS_MATRICULA, Papel.ADMINISTRADOR]);
    // O hub (page.tsx da raiz) usa o guard do próprio layout (carregarCabecalho).
    const paginas = (readdirSync(RAIZ, { recursive: true }) as string[]).filter((f) => f.endsWith("page.tsx") && f !== "page.tsx");
    expect(paginas.length).toBeGreaterThan(30);
    const fora = paginas.flatMap((f) => papeisDoGuard(f).filter((p) => !permitidos.has(p)).map((p) => `${f}: ${p}`));
    expect(fora).toEqual([]);
  });
});
