"use server";

// Fachada mínima para a interface da equipe. Não reexporte identidade.ts:
// login, consumo de token e despachante manipulam segredos e ficam somente
// nas rotas/API internas do servidor.
// Pelo namespace, sem alias: a decisão está na lista do ConfirmarAcao (src/app/confirmacoes-mapa.ts), e a trava
// não aceita outro nome para ela neste módulo.
import * as identidade from "./identidade";

export async function prepararConvitePortalAluno(input: { alunoId: string }) {
  return identidade.prepararConvitePortalAluno(input);
}

export async function prepararTrocaEmailPortalAluno(input: { alunoId: string; novoEmail: string; motivo: string; evidencia: string }) {
  return identidade.prepararTrocaEmailPortalAluno(input);
}

export async function decidirTrocaEmailPortalAluno(input: { solicitacaoId: string; aprovar: boolean; motivo: string }) {
  return identidade.decidirTrocaEmailPortalAluno(input);
}
