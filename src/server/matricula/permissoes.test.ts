import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import {
  PAPEIS_CRIAR,
  PAPEIS_ATIVAR,
  podeCriarMatricula,
  podeAtivarMatricula,
  podeCriarEAtivarMatricula,
} from "@/server/matricula/permissoes";

// Regras de permissão do fluxo de matrícula (issue #8).
// criarMatricula → VENDEDOR/GERENTE_COMERCIAL; ativar → FINANCEIRO/SECRETARIA.
// O fluxo atômico "criar + ativar" exige AMBOS os conjuntos de papéis.
const vendedor: Papel[] = [Papel.VENDEDOR];
const financeiro: Papel[] = [Papel.FINANCEIRO];
const vendedorEFinanceiro: Papel[] = [Papel.VENDEDOR, Papel.FINANCEIRO];
const admin: Papel[] = [Papel.ADMINISTRADOR];
const semPapel: Papel[] = [];

describe("permissões do fluxo de matrícula (#8)", () => {
  it("conjuntos de papéis condizem com o esperado", () => {
    expect(PAPEIS_CRIAR).toEqual([Papel.VENDEDOR, Papel.GERENTE_COMERCIAL]);
    expect(PAPEIS_ATIVAR).toEqual([Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA]);
  });

  it("quem só pode criar NÃO pode ativar (causa raiz da matrícula parcial)", () => {
    expect(podeCriarMatricula(vendedor)).toBe(true);
    expect(podeAtivarMatricula(vendedor)).toBe(false);
    expect(podeCriarEAtivarMatricula(vendedor)).toBe(false);
  });

  it("quem só pode ativar não tem papel de criar isoladamente", () => {
    expect(podeCriarMatricula(financeiro)).toBe(false);
    expect(podeAtivarMatricula(financeiro)).toBe(true);
    expect(podeCriarEAtivarMatricula(financeiro)).toBe(false);
  });

  it("quem tem os dois papéis pode usar o fluxo atômico criar+ativar", () => {
    expect(podeCriarMatricula(vendedorEFinanceiro)).toBe(true);
    expect(podeAtivarMatricula(vendedorEFinanceiro)).toBe(true);
    expect(podeCriarEAtivarMatricula(vendedorEFinanceiro)).toBe(true);
  });

  it("Administrador pode tudo", () => {
    expect(podeCriarMatricula(admin)).toBe(true);
    expect(podeAtivarMatricula(admin)).toBe(true);
    expect(podeCriarEAtivarMatricula(admin)).toBe(true);
  });

  it("sem papéis não pode nada", () => {
    expect(podeCriarMatricula(semPapel)).toBe(false);
    expect(podeAtivarMatricula(semPapel)).toBe(false);
    expect(podeCriarEAtivarMatricula(semPapel)).toBe(false);
  });
});
