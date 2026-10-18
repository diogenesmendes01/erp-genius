"use server";

import type { Resultado } from "@/server/_shared";
import * as fontes from "./conhecimento/fontes";
import * as estado from "./estado";
import * as historico from "./historico";
import * as pausa from "./pausa";
import * as playground from "./playground";
import * as versoes from "./versoes";

// Fronteira de Server Actions da Aria para os componentes de cliente (tela /aria e painel da inbox).
// Os módulos de domínio não são "use server" porque exportam também funções puras, tipos e helpers
// com `tx`; por isso o cliente importa daqui, nunca deles direto (senão o bundle do navegador puxa
// prisma/node:fs). Aqui só se delega: autorização e regras continuam nos módulos de origem.

// Versões (rascunho/publicação)
export async function salvarRascunho(i: Parameters<typeof versoes.salvarRascunho>[0]): ReturnType<typeof versoes.salvarRascunho> {
  return versoes.salvarRascunho(i);
}

export async function publicarRascunho(i: Parameters<typeof versoes.publicarRascunho>[0]): ReturnType<typeof versoes.publicarRascunho> {
  return versoes.publicarRascunho(i);
}

export async function descartarRascunho(aberto: Parameters<typeof versoes.descartarRascunho>[0]): Promise<Resultado> {
  return versoes.descartarRascunho(aberto);
}

// Estado da Aria
export async function definirEstadoAria(e: Parameters<typeof estado.definirEstadoAria>[0]): Promise<Resultado> {
  return estado.definirEstadoAria(e);
}

export async function pausarAria(i: Parameters<typeof estado.pausarAria>[0]): Promise<Resultado> {
  return estado.pausarAria(i);
}

export async function reativarAria(): Promise<Resultado> {
  return estado.reativarAria();
}

export async function definirSupervisao(i: Parameters<typeof estado.definirSupervisao>[0]): Promise<Resultado> {
  return estado.definirSupervisao(i);
}

// Conhecimento
export async function criarFonteTexto(i: Parameters<typeof fontes.criarFonteTexto>[0]): ReturnType<typeof fontes.criarFonteTexto> {
  return fontes.criarFonteTexto(i);
}

export async function arquivarFonte(id: string): Promise<Resultado> {
  return fontes.arquivarFonte(id);
}

// Histórico (aprovar/rejeitar/desfazer)
export async function aprovarAcaoAria(id: string): Promise<Resultado> {
  return historico.aprovarAcaoAria(id);
}

export async function rejeitarAcaoAria(id: string, motivo?: string): Promise<Resultado> {
  return historico.rejeitarAcaoAria(id, motivo);
}

export async function desfazerAcaoAria(id: string): Promise<Resultado> {
  return historico.desfazerAcaoAria(id);
}

// Atendimento
export async function devolverParaAria(atendimentoId: string): Promise<Resultado> {
  return pausa.devolverParaAria(atendimentoId);
}

// Playground
export async function testarAria(i: Parameters<typeof playground.testarAria>[0]): ReturnType<typeof playground.testarAria> {
  return playground.testarAria(i);
}
