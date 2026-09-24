import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROTULOS_TRILHA, SEM_PAGINA, trilhaDoCaminho } from "./trilha";

/** Rotas com page.tsx em src/app/(app), com `*` no lugar dos segmentos dinâmicos e sem grupos. */
const ROTAS = new Set(
  (readdirSync("src/app/(app)", { recursive: true }) as string[])
    .filter((f) => /(^|[\\/])page\.tsx$/.test(f))
    .map((f) => ("/" + join(f, "..").split("\\").join("/"))
      .replace(/\/\([^/]*\)/g, "")
      .replace(/\[[^\]]+\]/g, "*")
      .replace(/\/\.$/, "") || "/"),
);

const resumo = (caminho: string) => trilhaDoCaminho(caminho).map((i) => `${i.rotulo}${i.atual ? "" : ` → ${i.href}`}`);

describe("trilha de navegação", () => {
  it("toda entrada do mapa é uma página que existe (a trilha nunca leva a um 404)", () => {
    expect(Object.keys(ROTULOS_TRILHA).filter((r) => !ROTAS.has(r))).toEqual([]);
  });

  it("segmento sem página aponta para uma página que existe, e ele mesmo não tem página", () => {
    for (const [segmento, { href }] of Object.entries(SEM_PAGINA)) {
      expect(ROTAS.has(segmento), segmento).toBe(false);
      expect(ROTAS.has(href), href).toBe(true);
    }
  });

  it("ancestrais conhecidos viram links; a página atual fica marcada", () => {
    expect(resumo("/secretaria/reservas/clx9abc123")).toEqual(["Secretaria → /secretaria", "Reservas → /secretaria/reservas", "Reserva"]);
    expect(trilhaDoCaminho("/secretaria/reservas/clx9abc123").at(-1)).toMatchObject({ href: "/secretaria/reservas/clx9abc123", atual: true });
  });

  it("registro de aluno: área → ficha → seção", () => {
    expect(resumo("/alunos/clx1a2b3c/financeiro")).toEqual(["Alunos → /alunos", "Ficha do aluno → /alunos/clx1a2b3c", "Financeiro"]);
  });

  it("matrícula não tem lista própria: o primeiro elo é a Secretaria (\"Matrículas\")", () => {
    expect(resumo("/matriculas/cm0xyz9/contrato/aditivos/cp1q2w3/alcadas")).toEqual([
      "Matrículas → /secretaria",
      "Matrícula → /matriculas/cm0xyz9",
      "Contrato → /matriculas/cm0xyz9/contrato",
      "Aditivos → /matriculas/cm0xyz9/contrato/aditivos",
      "Proposta de aditivo → /matriculas/cm0xyz9/contrato/aditivos/cp1q2w3",
    ]);
  });

  it("segmento estático vence o dinâmico (\"nova\" não é uma grade chamada nova)", () => {
    expect(resumo("/academico/grades/nova")).toEqual(["Acadêmico → /academico", "Grades → /academico/grades", "Nova grade"]);
    expect(resumo("/academico/grades/cg7h8j9")).toEqual(["Acadêmico → /academico", "Grades → /academico/grades", "Grade"]);
  });

  it("segmento estático fora do mapa encerra a trilha — nunca vira um id inventado", () => {
    // /academico/recuperacoes/* é a página de UMA recuperação; "tentativas" não é uma delas.
    expect(resumo("/academico/recuperacoes/tentativas/ct1x2y3/agenda")).toEqual(["Acadêmico → /academico", "Recuperações → /academico/recuperacoes"]);
  });

  it("query string e barra final são ignoradas; área sozinha tem um item só", () => {
    expect(resumo("/leads/cl1z2x3/?aba=historico")).toEqual(["Leads → /leads", "Ficha do lead"]);
    expect(trilhaDoCaminho("/home")).toHaveLength(1);
    expect(trilhaDoCaminho("/")).toEqual([]);
  });
});
