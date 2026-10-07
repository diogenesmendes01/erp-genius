import { readFileSync } from "node:fs";

/**
 * Papéis passados ao exigirSessaoPagina(...) de uma página, para as travas "a aba tem os mesmos
 * papéis do guard" (abas de /academico e /diario; mesmo critério de matriculas/[id]/secoes.test.ts).
 * Falha alto — em vez de devolver vazio e deixar a trava cega — quando a página não chama o guard ou
 * quando os papéis não vêm como `Papel.X` literais (ex.: `...PAPEIS`), que a trava não consegue ler.
 * `[^)]*` atravessa quebras de linha: a chamada pode estar em várias linhas.
 */
export function papeisDoGuardFonte(fonte: string, origem: string): string[] {
  const chamada = fonte.match(/exigirSessaoPagina\(([^)]*)\)/);
  if (!chamada) throw new Error(`${origem}: sem exigirSessaoPagina(...)`);
  const papeis = [...chamada[1].matchAll(/Papel\.(\w+)/g)].map((m) => m[1]);
  const resto = chamada[1].replace(/Papel\.\w+/g, "").replace(/[\s,]/g, "");
  if (papeis.length === 0 || resto !== "") throw new Error(`${origem}: exigirSessaoPagina com papéis não literais (${chamada[1].trim()}) — use Papel.X`);
  return papeis.sort();
}

export const papeisDoGuardArquivo = (arquivo: string) => papeisDoGuardFonte(readFileSync(arquivo, "utf-8"), arquivo);
