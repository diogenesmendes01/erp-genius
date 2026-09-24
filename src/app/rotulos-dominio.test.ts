import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E5 (docs/42-auditoria-frontend-ux.md): fonte única de rótulos e de moeda na UI.
// - Dinheiro sai por formatarMoeda/formatarValores (src/lib/dinheiro.ts) — nunca "1250.00 CRC" nem
//   um toLocaleString ao lado do código da moeda ("₡ 1.250" é o correto; CRC/CLP não têm centavos).
// - Rótulo que falta não vira frase de negócio (`?? "… em conferência …"` inventava um estado).
// A lista PENDENTES é o passivo que ainda não foi migrado: só pode diminuir.

const PENDENTES_MOEDA = new Set<string>([]);

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

const VALOR = String.raw`[\w.?\[\]()]*\b(?:valor|saldo|total|preco|montante|diferenca|delta|credito|debito|estorno)\w*[\w.?()]*`;
const MOEDA = String.raw`[\w.?]*\bmoeda\b[\w.?]*`;
/** Valor e código da moeda lado a lado, em JSX ({v} {m}) ou em template (${v} ${m}), nas duas ordens. */
const DINHEIRO_CRU = new RegExp(
  [
    String.raw`\{\s*${VALOR}\s*\}\s*\{\s*${MOEDA}\s*\}`,
    String.raw`\{\s*${MOEDA}\s*\}\s*\{\s*${VALOR}\s*\}`,
    String.raw`\$\{\s*${VALOR}\s*\}\s*\$\{\s*${MOEDA}\s*\}`,
    String.raw`\$\{\s*${MOEDA}\s*\}\s*\$\{\s*${VALOR}\s*\}`,
    String.raw`\{\s*${MOEDA}\s*\}\s*\{[^{}\n]*toLocaleString\(`,
    String.raw`\$\{\s*${MOEDA}\s*\}\s*\$\{[^{}\n]*toLocaleString\(`,
  ].join("|"),
);
const INVENTA_ESTADO = /\?\?\s*"[^"\n]*em conferência[^"\n]*"/i;

const linhasCom = (conteudo: string, re: RegExp) =>
  conteudo.split("\n").map((l, i) => (re.test(l) ? i + 1 : 0)).filter(Boolean);

describe("rótulos e moeda de domínio", () => {
  it("dinheiro passa por formatarMoeda — nenhum arquivo novo imprime valor cru ao lado da moeda", () => {
    const novos = telas
      .filter(({ arquivo, conteudo }) => !PENDENTES_MOEDA.has(arquivo) && linhasCom(conteudo, DINHEIRO_CRU).length)
      .map(({ arquivo, conteudo }) => `${arquivo}:${linhasCom(conteudo, DINHEIRO_CRU).join(",")}`);
    expect(novos).toEqual([]);
  });

  it("a lista de pendentes de moeda só diminui: arquivo migrado sai dela", () => {
    const migrados = [...PENDENTES_MOEDA].filter((p) => !telas.some((t) => t.arquivo === p && linhasCom(t.conteudo, DINHEIRO_CRU).length));
    expect(migrados).toEqual([]);
  });

  it("rótulo ausente não vira estado inventado (`?? \"… em conferência …\"`)", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => linhasCom(conteudo, INVENTA_ESTADO).map((l) => `${arquivo}:${l}`));
    expect(ofensores).toEqual([]);
  });

  it("o detector reconhece as formas conhecidas (e não acusa formatarMoeda)", () => {
    for (const cru of ["<td>{c.valor} {c.moeda}</td>", "`${p.saldo} ${p.moeda}`", "{moeda} {valorTotal.toLocaleString(\"pt-BR\")}", "<p>{f.moeda} {f.valorTotal}</p>"]) {
      expect(DINHEIRO_CRU.test(cru), cru).toBe(true);
    }
    for (const certo of ["{formatarMoeda(c.valor, c.moeda)}", "`${formatarMoeda(p.saldo, p.moeda)}`", "<span>{c.moeda}</span>"]) {
      expect(DINHEIRO_CRU.test(certo), certo).toBe(false);
    }
    expect(INVENTA_ESTADO.test('rotulo ?? "Habilidade em conferência"')).toBe(true);
  });
});
