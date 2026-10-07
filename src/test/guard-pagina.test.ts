import { describe, expect, it } from "vitest";
import { papeisDoGuardFonte } from "./guard-pagina";

// Autoteste da leitura de guard usada pelas travas "aba = guard" de /academico e /diario
// (R1 da #143, B1/B2; R2, B3–B6): os ramos de falha fechada precisam lançar, comentário e texto de
// JSX não são guard, e o guard contado é o que segura a página — e o único que recusa.

const IMPORTS = `import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
`;

/** Página com o JSX de retorno de verdade: `jsx` entra DENTRO do `return (<div>…</div>)`. */
const pagina = (corpo: string, { jsx = "ok", imports = IMPORTS, depois = "" }: { jsx?: string; imports?: string; depois?: string } = {}) => `${imports}
export default async function Pagina() {
${corpo}
  return (
    <div>
      ${jsx}
    </div>
  );
}
${depois}`;

const GUARD_SEC_GP = "  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);";
const ler = (fonte: string) => papeisDoGuardFonte(fonte, "pagina.tsx");

describe("papeisDoGuardFonte — leitura", () => {
  it("lê o guard de uma linha e devolve os papéis ordenados", () => {
    expect(ler(pagina(GUARD_SEC_GP))).toEqual(["GERENTE_PEDAGOGICO", "SECRETARIA_ACADEMICA"]);
  });

  it("lê o guard em várias linhas (vírgula final), atribuído a uma variável ou desestruturado", () => {
    const variavel = pagina("  const usuario = await exigirSessaoPagina(\n    Papel.SECRETARIA_ACADEMICA,\n    Papel.GERENTE_PEDAGOGICO,\n    Papel.ADMINISTRADOR,\n  );\n  void usuario;");
    expect(ler(variavel)).toEqual(["ADMINISTRADOR", "GERENTE_PEDAGOGICO", "SECRETARIA_ACADEMICA"]);
    expect(ler(pagina("  const { papeis } = await exigirSessaoPagina(Papel.PROFESSOR);\n  void papeis;"))).toEqual(["PROFESSOR"]);
  });

  it("a mensagem de erro nomeia o arquivo", () => {
    expect(() => papeisDoGuardFonte(pagina("  const x = 1; void x;"), "sem-guard.tsx")).toThrow("sem-guard.tsx:");
  });
});

describe("papeisDoGuardFonte — falha fechada (B1)", () => {
  it("sem chamada ao guard: lança (não devolve vazio)", () => {
    expect(() => ler(pagina("  const x = 1; void x;"))).toThrow("sem exigirSessaoPagina");
  });

  it("guard sem papéis: lança", () => {
    expect(() => ler(pagina("  await exigirSessaoPagina();"))).toThrow("sem papéis");
  });

  it("papéis não literais: lança — sozinhos ou misturados a literais (nunca uma lista parcial)", () => {
    expect(() => ler(pagina("  await exigirSessaoPagina(...PAPEIS);"))).toThrow("não literais");
    expect(() => ler(pagina("  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, ...OUTROS);"))).toThrow("não literais");
    expect(() => ler(pagina("  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, PAPEL_EXTRA);"))).toThrow("não literais");
    expect(() => ler(pagina("  await exigirSessaoPagina(Outro.GERENTE_PEDAGOGICO);"))).toThrow("não literais");
    expect(() => ler(pagina('  await exigirSessaoPagina(Papel["GERENTE_PEDAGOGICO"]);'))).toThrow("não literais");
  });
});

describe("papeisDoGuardFonte — comentário e JSX não são guard (B2, B5)", () => {
  it("comentário de linha ou de bloco com a chamada antiga não é lido no lugar do guard real (E1)", () => {
    expect(ler(pagina("  // antes: exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO)\n  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);")))
      .toEqual(["GERENTE_PEDAGOGICO"]);
    expect(ler(pagina("  /* exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO) */\n  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);")))
      .toEqual(["GERENTE_PEDAGOGICO"]);
  });

  it("comentário JSX e texto JSX que citam o guard, dentro do return (<div>…</div>), não contam (parse TSX)", () => {
    const comentarioJsx = pagina("  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);", {
      jsx: "{/* exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO) */}",
    });
    expect(ler(comentarioJsx)).toEqual(["GERENTE_PEDAGOGICO"]);
    const textoJsx = pagina("  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);", {
      jsx: "<p>Use exigirSessaoPagina(Papel.PROFESSOR) aqui</p><code>await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA)</code>",
    });
    expect(ler(textoJsx)).toEqual(["GERENTE_PEDAGOGICO"]);
  });

  it("string que cita o guard não é chamada", () => {
    expect(() => ler(pagina('  const t = "exigirSessaoPagina(Papel.PROFESSOR)"; void t;'))).toThrow("sem exigirSessaoPagina");
  });

  it("só comentário, sem chamada real: lança", () => {
    expect(() => ler(pagina("  // await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);"))).toThrow("sem exigirSessaoPagina");
  });
});

describe("papeisDoGuardFonte — o guard contado é o que segura a página (B3)", () => {
  it("mais de uma chamada: lança", () => {
    expect(() => ler(pagina(`${GUARD_SEC_GP}\n  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);`))).toThrow("fora do guard da página");
  });

  it("guard depois de outra instrução: lança (precisa ser a primeira)", () => {
    expect(() => ler(pagina(`  const x = 1; void x;\n${GUARD_SEC_GP}`))).toThrow("sem guard de topo");
  });

  it("chamada sem await: lança", () => {
    expect(() => ler(pagina("  void exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);"))).toThrow("sem guard de topo");
  });

  it("E3: guard real por alias + isca com os papéis antigos numa função nunca chamada", () => {
    const fonte = pagina("  await exigirPagina(Papel.GERENTE_PEDAGOGICO);", {
      imports: 'import { Papel } from "@prisma/client";\nimport { exigirSessaoPagina, exigirSessaoPagina as exigirPagina } from "@/server/_shared";\n',
      depois: "export async function guardAntigo() {\n  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);\n}\n",
    });
    expect(() => ler(fonte)).toThrow("importado com alias");
    // Só a isca, sem o alias: a chamada fora da função export default também lança.
    const soIsca = pagina("  const x = 1; void x;", { depois: "export async function guardAntigo() {\n  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);\n}\n" });
    expect(() => ler(soIsca)).toThrow("sem guard de topo");
    const iscaEGuard = pagina("  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);", { depois: "async function isca() {\n  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);\n}\nvoid isca;\n" });
    expect(() => ler(iscaEGuard)).toThrow("fora do guard da página");
  });

  it("E4: guard real por namespace (`import * as`) — lança, com ou sem isca", () => {
    const fonte = pagina("  await shared.exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);", {
      imports: 'import { Papel } from "@prisma/client";\nimport * as shared from "@/server/_shared";\n',
    });
    expect(() => ler(fonte)).toThrow('"* as"');
    // Por outro caminho até o mesmo módulo, ou por import dinâmico/require, também.
    const subcaminho = pagina("  await s.exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);", {
      imports: 'import { Papel } from "@prisma/client";\nimport * as s from "@/server/_shared/sessao";\n',
    });
    expect(() => ler(subcaminho)).toThrow('"* as"');
    const dinamico = pagina('  await (await import("@/server/_shared")).exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);', {
      imports: 'import { Papel } from "@prisma/client";\n',
    });
    expect(() => ler(dinamico)).toThrow();
  });

  it("E5: await dentro de IIFE async não aguardada — a página não espera o guard", () => {
    const fonte = pagina("  void (async () => {\n    await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);\n  })();");
    expect(() => ler(fonte)).toThrow("sem guard de topo");
  });

  it("E6: guard condicional — if, ternário e &&", () => {
    expect(() => ler(pagina(`  if (process.env.GUARD_GRADES === "1") ${GUARD_SEC_GP.trim()}`))).toThrow("sem guard de topo");
    expect(() => ler(pagina("  process.env.GUARD ? await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO) : null;"))).toThrow("sem guard de topo");
    expect(() => ler(pagina("  process.env.GUARD && (await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO));"))).toThrow("sem guard de topo");
  });

  it("guard declarado localmente (não vem de @/server/_shared): lança", () => {
    const fonte = pagina(GUARD_SEC_GP, {
      imports: 'import { Papel } from "@prisma/client";\n',
      depois: "async function exigirSessaoPagina(..._papeis: unknown[]) { return null; }\n",
    });
    expect(() => ler(fonte)).toThrow("exigirSessaoPagina");
  });
});

describe("papeisDoGuardFonte — Papel é o enum do Prisma (B4)", () => {
  it("E7: Papel local que remapeia SECRETARIA_ACADEMICA sombreia o enum — lança", () => {
    const fonte = pagina(GUARD_SEC_GP, {
      imports: 'import { Papel as PapelPrisma } from "@prisma/client";\nimport { exigirSessaoPagina } from "@/server/_shared";\nconst Papel = { ...PapelPrisma, SECRETARIA_ACADEMICA: PapelPrisma.GERENTE_PEDAGOGICO } as const;\n',
    });
    expect(() => ler(fonte)).toThrow("Papel importado com alias");
  });

  it("Papel do Prisma sem alias, mas com outra declaração Papel no arquivo: lança", () => {
    const local = pagina(GUARD_SEC_GP, { depois: "function ajuda(Papel: unknown) { return Papel; }\nvoid ajuda;\n" });
    expect(() => ler(local)).toThrow("declaração local chamada Papel");
    const desestruturado = pagina(`${GUARD_SEC_GP}\n  const { Papel: _p } = { Papel: 1 }; void _p;`);
    expect(ler(desestruturado)).toEqual(["GERENTE_PEDAGOGICO", "SECRETARIA_ACADEMICA"]); // chave de objeto não é declaração
    const sombra = pagina(`${GUARD_SEC_GP}\n  { const Papel = 1; void Papel; }`);
    expect(() => ler(sombra)).toThrow("declaração local chamada Papel");
  });

  it("Papel de outro módulo, ou ausente: lança", () => {
    expect(() => ler(pagina(GUARD_SEC_GP, { imports: 'import { Papel } from "./papeis";\nimport { exigirSessaoPagina } from "@/server/_shared";\n' }))).toThrow("Papel precisa vir");
    expect(() => ler(pagina(GUARD_SEC_GP, { imports: 'import { exigirSessaoPagina } from "@/server/_shared";\n' }))).toThrow("Papel precisa vir");
  });
});

describe("papeisDoGuardFonte — o guard é a única recusa (B6)", () => {
  it("E8: guard intacto e recusa extra à Secretaria depois dele (throw) — lança", () => {
    const comResultado = pagina("  const sessao = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);\n  if (!sessao.papeis.includes(Papel.GERENTE_PEDAGOGICO)) throw new Error(\"sem acesso\");");
    expect(() => ler(comResultado)).toThrow("throw");
    const segundaChamada = pagina(`${GUARD_SEC_GP}\n  const sessao = await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);\n  if (!sessao.papeis.includes(Papel.GERENTE_PEDAGOGICO)) throw new Error("x");`);
    expect(() => ler(segundaChamada)).toThrow();
  });

  it("recusa dura por redirect/notFound, AcessoNegado, exigirPapel ou Promise.reject — lança", () => {
    const sessao = "  const sessao = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);\n";
    expect(() => ler(pagina(`${sessao}  if (!sessao.papeis.includes(Papel.GERENTE_PEDAGOGICO)) redirect("/acesso-negado");`))).toThrow("redirect(...)");
    expect(() => ler(pagina(`${sessao}  if (!sessao.papeis.includes(Papel.GERENTE_PEDAGOGICO)) notFound();`))).toThrow("notFound(...)");
    expect(() => ler(pagina(sessao, { jsx: "{!sessao.papeis.includes(Papel.GERENTE_PEDAGOGICO) && <AcessoNegado recurso=\"grades\" />}" }))).toThrow("AcessoNegado");
    expect(() => ler(pagina(`${sessao}  exigirPapel(sessao, Papel.GERENTE_PEDAGOGICO);`))).toThrow("exigirPapel");
    expect(() => ler(pagina(`${sessao}  if (!sessao.papeis.includes(Papel.GERENTE_PEDAGOGICO)) await Promise.reject(new Error("x"));`))).toThrow("Promise.reject");
  });

  it("import de next/navigation (mesmo com alias) ou de outra ferramenta de @/server/_shared: lança", () => {
    const comNav = 'import { Papel } from "@prisma/client";\nimport { exigirSessaoPagina } from "@/server/_shared";\nimport { redirect as ir } from "next/navigation";\n';
    expect(() => ler(pagina(`${GUARD_SEC_GP}\n  void ir;`, { imports: comNav }))).toThrow("next/navigation");
    const comFerramenta = 'import { Papel } from "@prisma/client";\nimport { exigirSessaoPagina, exigirPapel as checar } from "@/server/_shared";\n';
    expect(() => ler(pagina(`${GUARD_SEC_GP}\n  void checar;`, { imports: comFerramenta }))).toThrow("importado de @/server/_shared");
  });

  it("recusa branda: return sob condição de papel, direto ou por variável derivada — lança", () => {
    const sessao = "  const sessao = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);\n";
    expect(() => ler(pagina(`${sessao}  if (!sessao.papeis.includes(Papel.GERENTE_PEDAGOGICO)) return <p>Sem acesso</p>;`))).toThrow("return sob condição de papel");
    expect(() => ler(pagina(`${sessao}  const gestao = sessao.papeis.includes(Papel.GERENTE_PEDAGOGICO);\n  const pode = gestao;\n  if (!pode) { return null; }`))).toThrow("return sob condição de papel");
    expect(() => ler(pagina(`${sessao}  const gestao = temPapel(sessao, Papel.GERENTE_PEDAGOGICO);\n  return gestao ? <div>ok</div> : null;`))).toThrow("return condicionado a papel");
    // Num componente de topo para onde a página delega, com o papel chegando por prop: também.
    const delegado = pagina(sessao, {
      jsx: "<Conteudo podeVer={sessao.papeis.includes(Papel.GERENTE_PEDAGOGICO)} />",
      depois: "async function Conteudo({ podeVer }: { podeVer: boolean }) {\n  if (!podeVer) return null;\n  return <p>ok</p>;\n}\n",
    });
    expect(() => ler(delegado)).toThrow("return sob condição de papel");
    // Componente de topo declarado como const arrow.
    const arrow = pagina(`${sessao}  void sessao;`, { depois: "const Outro = async (p: { papeis: string[] }) => { if (!p.papeis.length) return null; return <p>ok</p>; };\nvoid Outro;\n" });
    expect(() => ler(arrow)).toThrow("return sob condição de papel");
  });

  it("ajuste de tela por papel continua permitido (o padrão das páginas reais)", () => {
    const sessao = "  const usuario = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);\n";
    // JSX condicional, variável usada só em texto, return por dado (não por papel), filtro do Prisma
    // com chave `papeis`, e return condicionado dentro de um .map(...).
    const fonte = pagina(
      `${sessao}  const secretaria = temPapel(usuario, Papel.SECRETARIA_ACADEMICA);\n  const filtro = { papeis: { has: "PROFESSOR" } };\n  const itens = [1, 2].map((i) => { if (secretaria) return null; return i; });\n  if (!filtro) return <p>Selecione uma matrícula.</p>;\n  void itens;`,
      {
        imports: 'import { Papel } from "@prisma/client";\nimport { exigirSessaoPagina, temPapel } from "@/server/_shared";\n',
        jsx: "{usuario.papeis.includes(Papel.PROFESSOR) && <a href=\"/x\">x</a>}<p>{secretaria ? \"Fila\" : \"Histórico\"}</p>",
      },
    );
    expect(ler(fonte)).toEqual(["GERENTE_PEDAGOGICO", "SECRETARIA_ACADEMICA"]);
  });
});
