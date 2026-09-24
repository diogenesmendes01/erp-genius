import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MensagemStatus } from "@/components/MensagemStatus";

// Resultado de ação precisa chegar a quem usa leitor de tela: erro com role="alert" (anunciado mesmo
// inserido já com texto); sucesso/aviso por MensagemStatus (região polite sempre montada).

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** Tag de abertura inteira a partir de `<`, ignorando `>` dentro de `{…}` (ex.: `onChange={(e) => …}`). */
function tagEm(fonte: string, inicio: number) {
  let nivel = 0;
  for (let i = inicio; i < fonte.length; i++) {
    const c = fonte[i];
    if (c === "{") nivel++;
    else if (c === "}") nivel--;
    else if (c === ">" && nivel === 0) return fonte.slice(inicio, i + 1);
  }
  return fonte.slice(inicio);
}

function renderizacoesSemRegiao(variavel: RegExp) {
  const re = new RegExp(String.raw`\{\s*(${variavel.source})\s*&&\s*\(?\s*<(p|div|span)\b`, "g");
  return telas.flatMap(({ arquivo, conteudo }) =>
    [...conteudo.matchAll(re)]
      .filter((m) => !/\brole=|aria-live=/.test(tagEm(conteudo, m.index! + m[0].lastIndexOf("<"))))
      .map((m) => `${arquivo}:${conteudo.slice(0, m.index).split("\n").length} ${m[1]}`),
  );
}

/**
 * Região polite montada junto com o próprio texto — `{aviso && <p role="status">{aviso}</p>}` ou
 * `{ocupado && <p role="status">Processando…</p>}` — pode passar em silêncio: ela não existia antes da mudança.
 * Só em telas cliente, onde o texto aparece depois de uma ação; conteúdo composto (prévias, listas) fica de fora.
 */
function regioesPoliteMontadasComOTexto() {
  const re = /\{\s*([\w.?]+)\s*&&\s*\(?\s*<(p|div|span)\b/g;
  return telas
    .filter(({ conteudo }) => /^\s*["']use client["']/.test(conteudo))
    .flatMap(({ arquivo, conteudo }) =>
      [...conteudo.matchAll(re)]
        .filter((m) => {
          const inicio = m.index! + m[0].lastIndexOf("<");
          const tag = tagEm(conteudo, inicio);
          if (!/role="status"|aria-live="polite"/.test(tag)) return false;
          const corpo = conteudo.slice(inicio + tag.length, conteudo.indexOf(`</${m[2]}>`, inicio)).trim();
          return corpo === `{${m[1]}}` || !/[<{}]/.test(corpo);
        })
        .map((m) => `${arquivo}:${conteudo.slice(0, m.index).split("\n").length} ${m[1]}`),
    );
}

describe("anúncio do resultado de ações", () => {
  it("toda mensagem de erro renderizada condicionalmente tem role/aria-live", () => {
    expect(renderizacoesSemRegiao(/[a-zA-Z]*(?:erro|Erro|error|Error|falha|Falha)[a-zA-Z]*/)).toEqual([]);
  });

  it("mensagem de sucesso/aviso não é um <p> condicional mudo", () => {
    expect(renderizacoesSemRegiao(/nota|msg|sucesso|aviso|mensagemSucesso/)).toEqual([]);
  });

  it("região polite não é montada junto com o próprio texto — usa MensagemStatus (região sempre montada)", () => {
    expect(regioesPoliteMontadasComOTexto()).toEqual([]);
  });

  it("nenhuma região polite é escondida com display:none (hidden / empty:hidden) — isso a tira da árvore de acessibilidade", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) =>
      [...conteudo.matchAll(/<[a-z]+\b/g)]
        .map((m) => tagEm(conteudo, m.index!))
        .filter((tag) => /role="status"|aria-live="polite"/.test(tag) && /className="(?:[^"]*\s)?(?:empty:)?hidden(?:\s|")/.test(tag))
        .map((tag) => `${arquivo}: ${tag.slice(0, 80)}`),
    );
    expect(ofensores).toEqual([]);
  });
});

describe("MensagemStatus", () => {
  it("sem texto: a região polite existe (vazia) e nada visível é renderizado", () => {
    const html = renderToStaticMarkup(createElement(MensagemStatus, { texto: null, className: "caixa" }));
    expect(html).toBe('<p role="status" class="sr-only"></p>');
  });

  it("com texto: a região anuncia e a versão visível fica fora da leitura, para não repetir", () => {
    const html = renderToStaticMarkup(createElement(MensagemStatus, { texto: "Pagamento registrado.", className: "caixa" }));
    expect(html).toBe('<p role="status" class="sr-only">Pagamento registrado.</p><p aria-hidden="true" class="caixa">Pagamento registrado.</p>');
  });
});
