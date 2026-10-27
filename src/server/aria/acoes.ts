"use server";

import type { Resultado } from "@/server/_shared";
import { arquivarFonte as arquivarFonteDominio, criarFonteTexto as criarFonteTextoDominio } from "./conhecimento/fontes";
import { definirEstadoAria as definirEstadoAriaDominio, definirSupervisao as definirSupervisaoDominio, pausarAria as pausarAriaDominio, reativarAria as reativarAriaDominio } from "./estado";
import { aprovarAcaoAria as aprovarAcaoAriaDominio, desfazerAcaoAria as desfazerAcaoAriaDominio, rejeitarAcaoAria as rejeitarAcaoAriaDominio } from "./historico";
import { aprovarSugestaoEditadaNoInbox as aprovarSugestaoEditadaNoInboxDominio, aprovarSugestaoNoInbox as aprovarSugestaoNoInboxDominio, rejeitarSugestaoNoInbox as rejeitarSugestaoNoInboxDominio, desfazerSugestaoNoInbox as desfazerSugestaoNoInboxDominio } from "./decisao-inbox";
import { devolverParaAria as devolverParaAriaDominio } from "./pausa";
import { testarAria as testarAriaDominio } from "./playground";
import { descartarRascunho as descartarRascunhoDominio, publicarRascunho as publicarRascunhoDominio, salvarRascunho as salvarRascunhoDominio } from "./versoes";

export async function salvarRascunho(i: Parameters<typeof salvarRascunhoDominio>[0]): ReturnType<typeof salvarRascunhoDominio> {
  return salvarRascunhoDominio(i);
}

export async function publicarRascunho(i: Parameters<typeof publicarRascunhoDominio>[0]): ReturnType<typeof publicarRascunhoDominio> {
  return publicarRascunhoDominio(i);
}

export async function descartarRascunho(aberto: Parameters<typeof descartarRascunhoDominio>[0]): Promise<Resultado> {
  return descartarRascunhoDominio(aberto);
}

export async function definirEstadoAria(e: Parameters<typeof definirEstadoAriaDominio>[0]): Promise<Resultado> {
  return definirEstadoAriaDominio(e);
}

export async function pausarAria(i: Parameters<typeof pausarAriaDominio>[0]): Promise<Resultado> {
  return pausarAriaDominio(i);
}

export async function reativarAria(): Promise<Resultado> {
  return reativarAriaDominio();
}

export async function definirSupervisao(i: Parameters<typeof definirSupervisaoDominio>[0]): Promise<Resultado> {
  return definirSupervisaoDominio(i);
}

export async function criarFonteTexto(i: Parameters<typeof criarFonteTextoDominio>[0]): ReturnType<typeof criarFonteTextoDominio> {
  return criarFonteTextoDominio(i);
}

export async function arquivarFonte(id: string): Promise<Resultado> {
  return arquivarFonteDominio(id);
}

export async function aprovarAcaoAria(id: string): Promise<Resultado> {
  return aprovarAcaoAriaDominio(id);
}

export async function rejeitarAcaoAria(id: string, motivo?: string): Promise<Resultado> {
  return rejeitarAcaoAriaDominio(id, motivo);
}

export async function desfazerAcaoAria(id: string): Promise<Resultado> {
  return desfazerAcaoAriaDominio(id);
}

export async function devolverParaAria(atendimentoId: string): Promise<Resultado> {
  return devolverParaAriaDominio(atendimentoId);
}

export async function testarAria(i: Parameters<typeof testarAriaDominio>[0]): ReturnType<typeof testarAriaDominio> {
  return testarAriaDominio(i);
}

export async function aprovarSugestaoNoInbox(atendimentoId: string, id: string) { return aprovarSugestaoNoInboxDominio(atendimentoId, id); }
export async function rejeitarSugestaoNoInbox(atendimentoId: string, id: string, motivo?: string) { return rejeitarSugestaoNoInboxDominio(atendimentoId, id, motivo); }
export async function desfazerSugestaoNoInbox(atendimentoId: string, id: string) { return desfazerSugestaoNoInboxDominio(atendimentoId, id); }
export async function aprovarSugestaoEditadaNoInbox(input: Parameters<typeof aprovarSugestaoEditadaNoInboxDominio>[0]) { return aprovarSugestaoEditadaNoInboxDominio(input); }
