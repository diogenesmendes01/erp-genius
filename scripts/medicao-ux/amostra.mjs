// Amostra reproduzível dos achados Média/Baixa da seção 6, por área.
// Uso: node scripts/medicao-ux/amostra.mjs [media=6] [baixa=3] [semente=42]
// Sorteio com gerador linear congruente de semente fixa: a mesma semente
// sempre devolve os mesmos achados, para que a medição possa ser repetida.
import { achados } from "./achados.mjs";

const [qMedia = 6, qBaixa = 3, semente = 42] = process.argv.slice(2).map(Number);
let s = semente >>> 0;
const aleatorio = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);

function sortear(lista, q) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, q).sort((a, b) => a.linha - b.linha);
}

const areas = [...new Set(achados.map((a) => a.area))];
const amostra = [];
for (const area of areas) {
  const daArea = achados.filter((a) => a.area === area);
  amostra.push(...sortear(daArea.filter((a) => a.sev === "Media"), qMedia));
  amostra.push(...sortear(daArea.filter((a) => a.sev === "Baixa"), qBaixa));
}
console.log(JSON.stringify(amostra, null, 1));
