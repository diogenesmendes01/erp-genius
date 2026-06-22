import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import {
  PAPEIS_CRIAR,
  PAPEIS_ATIVAR,
  PAPEIS_ATIVAR_MATRICULA,
  podeCriarMatricula,
  podeAtivarMatricula,
  podeCriarEAtivarMatricula,
} from "@/server/matricula/permissoes";

// Regras de permissão do fluxo de matrícula (issue #8).
// criarMatricula → VENDEDOR/GERENTE_COMERCIAL; ativar → FINANCEIRO/SECRETARIA.
// O fluxo atômico "criar + ativar" exige AMBOS os conjuntos de papéis.
const vendedor: Papel[] = [Papel.VENDEDOR];
const gerente: Papel[] = [Papel.GERENTE_COMERCIAL];
const financeiro: Papel[] = [Papel.FINANCEIRO];
const secretaria: Papel[] = [Papel.SECRETARIA_ACADEMICA];
const vendedorEFinanceiro: Papel[] = [Papel.VENDEDOR, Papel.FINANCEIRO];
const admin: Papel[] = [Papel.ADMINISTRADOR];
const semPapel: Papel[] = [];

describe("permissões do fluxo de matrícula (#8)", () => {
  it("conjuntos de papéis condizem com o esperado", () => {
    expect(PAPEIS_CRIAR).toEqual([Papel.VENDEDOR, Papel.GERENTE_COMERCIAL]);
    expect(PAPEIS_ATIVAR).toEqual([Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA]);
    expect(PAPEIS_ATIVAR_MATRICULA).toEqual(PAPEIS_ATIVAR);
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

describe("podeAtivarMatricula (regra de ativação)", () => {
  it("permite Financeiro e Secretaria Acadêmica", () => {
    expect(podeAtivarMatricula(financeiro)).toBe(true);
    expect(podeAtivarMatricula(secretaria)).toBe(true);
  });

  it("permite Administrador (passa em qualquer verificação)", () => {
    expect(podeAtivarMatricula(admin)).toBe(true);
  });

  it("nega Vendedor e Gerente Comercial", () => {
    expect(podeAtivarMatricula(vendedor)).toBe(false);
    expect(podeAtivarMatricula(gerente)).toBe(false);
  });

  it("nega usuário sem papéis", () => {
    expect(podeAtivarMatricula(semPapel)).toBe(false);
  });
});
