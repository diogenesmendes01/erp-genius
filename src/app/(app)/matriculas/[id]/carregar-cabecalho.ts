import { cache } from "react";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCabecalhoMatricula } from "@/server/matricula/cabecalho";
import { PAPEIS_MATRICULA } from "./secoes";

const memo: <F extends (...args: never[]) => unknown>(f: F) => F = typeof cache === "function" ? cache : (f) => f;

export const carregarCabecalho = memo(async (matriculaId: string) => {
  const usuario = await exigirSessaoPagina(...PAPEIS_MATRICULA);
  return { usuario, cabecalho: await consultarCabecalhoMatricula(usuario, matriculaId) };
});
