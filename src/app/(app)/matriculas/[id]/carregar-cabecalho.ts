import { cache } from "react";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCabecalhoMatricula } from "@/server/matricula/cabecalho";
import { PAPEIS_MATRICULA } from "./secoes";

// Sessão + cabeçalho da matrícula, uma vez por requisição: o layout, o generateMetadata e o hub
// pedem o mesmo dado. `cache` vem do React embutido no Next (App Router); no Vitest (React 18.3
// do node_modules) ele não existe e a função roda sem memo — o comportamento é o mesmo.
const memo: <F extends (...args: never[]) => unknown>(f: F) => F = typeof cache === "function" ? cache : (f) => f;

export const carregarCabecalho = memo(async (matriculaId: string) => {
  const usuario = await exigirSessaoPagina(...PAPEIS_MATRICULA);
  return { usuario, cabecalho: await consultarCabecalhoMatricula(usuario, matriculaId) };
});
