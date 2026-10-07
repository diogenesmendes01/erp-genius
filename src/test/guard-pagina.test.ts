import { describe, expect, it } from "vitest";
import { papeisDoGuardFonte } from "./guard-pagina";

// Autoteste da leitura de guard usada pelas travas "aba = guard" de /academico e /diario
// (R1 da #143, B1 e B2): os ramos de falha fechada precisam lançar, e comentário não é guard.

const pagina = (corpo: string) => `import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";

export default async function Pagina() {
${corpo}
  return <div>ok</div>;
}
`;

describe("papeisDoGuardFonte", () => {
  it("lê a chamada de uma linha e devolve os papéis ordenados", () => {
    expect(papeisDoGuardFonte(pagina("  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);"), "x"))
      .toEqual(["GERENTE_PEDAGOGICO", "SECRETARIA_ACADEMICA"]);
  });

  it("lê a chamada em várias linhas (com vírgula final) e atribuída a uma variável", () => {
    const fonte = pagina("  const usuario = await exigirSessaoPagina(\n    Papel.SECRETARIA_ACADEMICA,\n    Papel.GERENTE_PEDAGOGICO,\n    Papel.ADMINISTRADOR,\n  );\n  void usuario;");
    expect(papeisDoGuardFonte(fonte, "x")).toEqual(["ADMINISTRADOR", "GERENTE_PEDAGOGICO", "SECRETARIA_ACADEMICA"]);
  });

  it("sem chamada ao guard: lança (não devolve vazio)", () => {
    expect(() => papeisDoGuardFonte(pagina("  const x = 1; void x;"), "sem-guard.tsx")).toThrow("sem-guard.tsx: sem exigirSessaoPagina");
    // Só o import, ou o nome num texto, não é chamada.
    expect(() => papeisDoGuardFonte(pagina('  const t = "exigirSessaoPagina(Papel.PROFESSOR)"; void t;'), "x")).toThrow("sem exigirSessaoPagina");
  });

  it("guard sem papéis: lança", () => {
    expect(() => papeisDoGuardFonte(pagina("  await exigirSessaoPagina();"), "x")).toThrow("sem papéis");
  });

  it("papéis não literais: lança — sozinhos ou misturados a literais (nunca uma lista parcial)", () => {
    expect(() => papeisDoGuardFonte(pagina("  await exigirSessaoPagina(...PAPEIS);"), "x")).toThrow("não literais");
    expect(() => papeisDoGuardFonte(pagina("  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, ...OUTROS);"), "x")).toThrow("não literais");
    expect(() => papeisDoGuardFonte(pagina("  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, PAPEL_EXTRA);"), "x")).toThrow("não literais");
    expect(() => papeisDoGuardFonte(pagina("  await exigirSessaoPagina(Outro.GERENTE_PEDAGOGICO);"), "x")).toThrow("não literais");
  });

  it("comentário com a chamada antiga não é lido no lugar do guard real (evasão E1)", () => {
    const linha = pagina("  // antes: exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO)\n  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);");
    expect(papeisDoGuardFonte(linha, "x")).toEqual(["GERENTE_PEDAGOGICO"]);
    const bloco = pagina("  /* exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO) */\n  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);");
    expect(papeisDoGuardFonte(bloco, "x")).toEqual(["GERENTE_PEDAGOGICO"]);
    const jsx = pagina("  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);\n  {/* exigirSessaoPagina(Papel.PROFESSOR) */}");
    expect(papeisDoGuardFonte(jsx, "x")).toEqual(["GERENTE_PEDAGOGICO"]);
  });

  it("só comentário, sem chamada real: lança", () => {
    expect(() => papeisDoGuardFonte(pagina("  // await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);"), "x")).toThrow("sem exigirSessaoPagina");
  });

  it("mais de uma chamada: lança (qual delas vale?)", () => {
    const duas = pagina("  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);\n  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);");
    expect(() => papeisDoGuardFonte(duas, "x")).toThrow("2 chamadas");
  });

  it("chamada sem await: lança (o redirect não seguraria a página)", () => {
    expect(() => papeisDoGuardFonte(pagina("  void exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);"), "x")).toThrow("sem await");
  });
});
