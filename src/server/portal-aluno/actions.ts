"use server";

// Fachada mínima para a interface da equipe. Não reexporte identidade.ts:
// login, consumo de token e despachante manipulam segredos e ficam somente
// nas rotas/API internas do servidor.
import {
  decidirTrocaEmailPortalAluno as decidir,
  prepararConvitePortalAluno as prepararConvite,
  prepararTrocaEmailPortalAluno as prepararTroca,
} from "./identidade";

export async function prepararConvitePortalAluno(input: { alunoId: string }) {
  return prepararConvite(input);
}

export async function prepararTrocaEmailPortalAluno(input: { alunoId: string; novoEmail: string; motivo: string; evidencia: string }) {
  return prepararTroca(input);
}

export async function decidirTrocaEmailPortalAluno(input: { solicitacaoId: string; aprovar: boolean; motivo: string }) {
  return decidir(input);
}
