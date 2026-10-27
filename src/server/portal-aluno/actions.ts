"use server";

import * as identidade from "./identidade";

export async function prepararConvitePortalAluno(input: { alunoId: string; chaveIdempotencia?: string }) {
  return identidade.prepararConvitePortalAluno(input);
}

export async function prepararTrocaEmailPortalAluno(input: { alunoId: string; novoEmail: string; motivo: string; evidencia: string; chaveIdempotencia?: string }) {
  return identidade.prepararTrocaEmailPortalAluno(input);
}

export async function decidirTrocaEmailPortalAluno(input: { solicitacaoId: string; aprovar: boolean; motivo: string }) {
  return identidade.decidirTrocaEmailPortalAluno(input);
}
