import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import { papeisTem } from "./guards";

// Guards de LEITURA por papel para Server Components (issue #1).
// `papeisTem` é a regra pura por trás de `exigirPapelLeitura` (que só adiciona o auth()).

describe("papeisTem (guard de leitura de página)", () => {
  it("Administrador passa em qualquer leitura", () => {
    expect(papeisTem([Papel.ADMINISTRADOR], Papel.FINANCEIRO)).toBe(true);
    expect(papeisTem([Papel.ADMINISTRADOR])).toBe(true); // ex.: gestão de usuários (só admin)
  });

  it("autoriza só quando tem um dos papéis alvo", () => {
    expect(papeisTem([Papel.FINANCEIRO], Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL)).toBe(true);
    expect(papeisTem([Papel.PROFESSOR], Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL)).toBe(false);
  });

  it("nega leitura quando não há papel adequado (sem dados vazios acidentais)", () => {
    expect(papeisTem([], Papel.FINANCEIRO)).toBe(false);
    expect(papeisTem([Papel.VENDEDOR], Papel.ADMINISTRADOR)).toBe(false); // usuários: só admin
  });

  it("financeiro: Financeiro e Gerente Comercial leem; Vendedor/Professor não", () => {
    const alvo = [Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL];
    expect(papeisTem([Papel.FINANCEIRO], ...alvo)).toBe(true);
    expect(papeisTem([Papel.GERENTE_COMERCIAL], ...alvo)).toBe(true);
    expect(papeisTem([Papel.VENDEDOR], ...alvo)).toBe(false);
    expect(papeisTem([Papel.PROFESSOR], ...alvo)).toBe(false);
  });

  it("alunos: Secretaria/Pedagógico/Financeiro/Professor leem; Vendedor não", () => {
    const alvo = [
      Papel.SECRETARIA_ACADEMICA,
      Papel.GERENTE_PEDAGOGICO,
      Papel.FINANCEIRO,
      Papel.PROFESSOR,
    ];
    expect(papeisTem([Papel.SECRETARIA_ACADEMICA], ...alvo)).toBe(true);
    expect(papeisTem([Papel.PROFESSOR], ...alvo)).toBe(true);
    expect(papeisTem([Papel.VENDEDOR], ...alvo)).toBe(false);
  });
});
