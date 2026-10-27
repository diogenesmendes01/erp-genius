const VARIANTES: ReadonlyArray<readonly [string, string]> = [
  ["a", "ÁÀÂÃÄÅĀĂĄáàâãäåāăą"],
  ["c", "ÇĆĈĊČçćĉċč"],
  ["d", "ĎĐďđ"],
  ["e", "ÉÈÊËĒĔĖĘĚéèêëēĕėęě"],
  ["g", "ĜĞĠĢĝğġģ"],
  ["h", "ĤĦĥħ"],
  ["i", "ÍÌÎÏĨĪĬĮİíìîïĩīĭįı"],
  ["j", "Ĵĵ"],
  ["k", "Ķķ"],
  ["l", "ĹĻĽĿŁĺļľŀł"],
  ["n", "ÑŃŅŇñńņň"],
  ["o", "ÓÒÔÕÖØŌŎŐóòôõöøōŏő"],
  ["r", "ŔŖŘŕŗř"],
  ["s", "ŚŜŞŠȘśŝşšș"],
  ["t", "ŢŤŦȚţťŧț"],
  ["u", "ÚÙÛÜŨŪŬŮŰŲúùûüũūŭůűų"],
  ["w", "Ŵŵ"],
  ["y", "ÝŸŶýÿŷ"],
  ["z", "ŹŻŽźżž"],
];

const MAIUSCULAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ESPACO_DURO = " ";
const COMBINANTES = Array.from({ length: 0x70 }, (_, i) => String.fromCharCode(0x300 + i)).join("");

export const ORIGEM_ORDENACAO =
  VARIANTES.map(([, v]) => v).join("") + MAIUSCULAS + ESPACO_DURO + COMBINANTES;
export const DESTINO_ORDENACAO =
  VARIANTES.map(([base, v]) => base.repeat([...v].length)).join("") + MAIUSCULAS.toLowerCase() + " ";

export function expressaoOrdenacaoSql(entradaSql: string): string {
  return `btrim(regexp_replace(translate(${entradaSql}, '${ORIGEM_ORDENACAO}', '${DESTINO_ORDENACAO}'), '[[:space:]]+', ' ', 'g'))`;
}

const MAPA = new Map<string, string>();
{
  const origem = [...ORIGEM_ORDENACAO];
  const destino = [...DESTINO_ORDENACAO];
  origem.forEach((c, i) => MAPA.set(c, destino[i] ?? ""));
}

export function normalizarParaOrdenacao(nome: string): string {
  let saida = "";
  for (const c of nome) saida += MAPA.get(c) ?? c;
  return saida.replace(/[ \t\n\v\f\r]+/g, " ").replace(/^ | $/g, "");
}
