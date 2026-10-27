"use server";

import { solicitarCorrecaoEntregaReposicao as solicitar } from "./reposicao-gravacao";

export async function solicitarCorrecaoEntregaReposicao(input: { reposicaoId: string; entregaId: string; comentario: string }) {
  return solicitar(input);
}
