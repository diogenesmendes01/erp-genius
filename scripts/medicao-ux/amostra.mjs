// Amostra reproduzível dos achados Média/Baixa da seção 6, por área.
// Uso: node scripts/medicao-ux/amostra.mjs [media=6] [baixa=3] [semente=42]
// Sorteio por Fisher–Yates com gerador linear congruente de semente fixa: a mesma semente sempre
// devolve os mesmos achados, para que a medição possa ser repetida. Argumento não inteiro é erro.
import { pathToFileURL } from "node:url";
import { achadosDoRepositorio } from "./achados.mjs";
import { inteiroDoArgumento } from "./nucleo.mjs";

/** Gerador LCG (Numerical Recipes) em [0, 1). */
export function gerador(semente) {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Embaralha (Fisher–Yates) e devolve os `q` primeiros, ordenados pela linha no doc. */
export function sortear(lista, q, aleatorio) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, q).sort((a, b) => a.linha - b.linha);
}

/**
 * `qMedia` Média e `qBaixa` Baixa por área, na ordem das áreas no documento, com um único
 * gerador semeado (a ordem dos sorteios faz parte da reprodutibilidade).
 */
export function amostra(achados, qMedia, qBaixa, semente) {
  const aleatorio = gerador(semente);
  const saida = [];
  for (const area of [...new Set(achados.map((a) => a.area))]) {
    const daArea = achados.filter((a) => a.area === area);
    saida.push(...sortear(daArea.filter((a) => a.sev === "Media"), qMedia, aleatorio));
    saida.push(...sortear(daArea.filter((a) => a.sev === "Baixa"), qBaixa, aleatorio));
  }
  return saida;
}

/** Lê [media, baixa, semente] da linha de comando; erro para argumento inválido. */
export function argumentosDaAmostra(args) {
  return {
    qMedia: inteiroDoArgumento(args[0], "quantidade de Média", 6),
    qBaixa: inteiroDoArgumento(args[1], "quantidade de Baixa", 3),
    semente: inteiroDoArgumento(args[2], "semente", 42),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { qMedia, qBaixa, semente } = argumentosDaAmostra(process.argv.slice(2));
    console.log(JSON.stringify(amostra(achadosDoRepositorio(), qMedia, qBaixa, semente), null, 1));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
