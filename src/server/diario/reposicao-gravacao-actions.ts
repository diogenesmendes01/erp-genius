"use server";

import { solicitarCorrecaoEntregaReposicao as solicitar } from "./reposicao-gravacao";

/** Fachada client-safe para a operação docente. */
export async function solicitarCorrecaoEntregaReposicao(input: { reposicaoId: string; entregaId: string; comentario: string }) {
  return solicitar(input);
}
