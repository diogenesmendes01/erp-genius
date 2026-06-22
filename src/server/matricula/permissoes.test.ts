import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import { temPapel, type UsuarioSessao } from "@/server/_shared";

// Regras de permissão do fluxo de matrícula (issue #8).
// criarMatricula → VENDEDOR/GERENTE_COMERCIAL; ativar → FINANCEIRO/SECRETARIA.
// O fluxo atômico "criar + ativar" exige AMBOS os conjuntos de papéis.
const PAPEIS_CRIAR: Papel[] = [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];
const PAPEIS_ATIVAR: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

const vendedor: UsuarioSessao = { id: "u1", nome: "V", papeis: [Papel.VENDEDOR] };
const financeiro: UsuarioSessao = { id: "u2", nome: "F", papeis: [Papel.FINANCEIRO] };
const vendedorEFinanceiro: UsuarioSessao = {
  id: "u3",
  nome: "VF",
  papeis: [Papel.VENDEDOR, Papel.FINANCEIRO],
};
const admin: UsuarioSessao = { id: "u4", nome: "A", papeis: [Papel.ADMINISTRADOR] };

const podeAtivar = (u: UsuarioSessao) => temPapel(u, ...PAPEIS_ATIVAR);
const podeCriarEAtivar = (u: UsuarioSessao) =>
  temPapel(u, ...PAPEIS_CRIAR) && temPapel(u, ...PAPEIS_ATIVAR);

describe("permissões do fluxo de matrícula (#8)", () => {
  it("quem só pode criar NÃO pode ativar (causa raiz da matrícula parcial)", () => {
    expect(temPapel(vendedor, ...PAPEIS_CRIAR)).toBe(true);
    expect(podeAtivar(vendedor)).toBe(false);
    expect(podeCriarEAtivar(vendedor)).toBe(false);
  });

  it("quem só pode ativar não tem papel de criar isoladamente", () => {
    expect(temPapel(financeiro, ...PAPEIS_CRIAR)).toBe(false);
    expect(podeAtivar(financeiro)).toBe(true);
    expect(podeCriarEAtivar(financeiro)).toBe(false);
  });

  it("quem tem os dois papéis pode usar o fluxo atômico criar+ativar", () => {
    expect(podeCriarEAtivar(vendedorEFinanceiro)).toBe(true);
  });

  it("Administrador pode tudo", () => {
    expect(podeAtivar(admin)).toBe(true);
    expect(podeCriarEAtivar(admin)).toBe(true);
  });
});
