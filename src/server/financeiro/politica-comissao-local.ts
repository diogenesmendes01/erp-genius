"use server";

import { executarAcao } from "@/server/_shared";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { publicarPoliticaComissao } from "./acoes";
import type { PoliticaComissaoInput } from "./schema";

/**
 * Publicação da política com a vigência DIGITADA (lote 3 do fuso pessoal nas telas): `vigenciaLocal` é o texto do
 * `datetime-local`, lido no `fuso` que a tela escreveu ao lado do campo e convertido aqui (antes, `new Date(valor)`
 * no navegador). Vazio = "a partir de agora", no relógio do servidor.
 */
export async function publicarPoliticaComissaoLocal(input: Omit<PoliticaComissaoInput, "vigenteEm"> & { vigenciaLocal: string; fuso: string }) {
  const r = await executarAcao(async () => {
    const { vigenciaLocal, fuso, ...resto } = input;
    return { ...resto, vigenteEm: vigenciaLocal.trim() ? exigirInstanteDoCampoLocal(vigenciaLocal, fuso) : new Date() };
  });
  if (!r.ok) return r;
  return publicarPoliticaComissao(r.dado!);
}
