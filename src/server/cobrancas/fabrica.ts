import type { ModoDegrau } from "@prisma/client";
import type { ModeloWhatsapp } from "@/server/financeiro/schema";
import type { PassoRegua } from "./regua";

// DEFAULTS DE FÁBRICA do canal de cobrança (docs 26/30) — arquivo PURO (só constantes,
// zero import de runtime) para poder ser consumido pelo seed (tsx) e pelos módulos do app
// sem puxar prisma/env. FONTE ÚNICA (doc 29 regra 4): o seed grava estes textos na
// entidade TemplateWhatsApp; render.ts os usa como fallback; o client migra na E2.

export const POLITICA_COBRANCA_NOME = "Régua de cobrança (padrão)";

/** Modos de fábrica (doc 26): preventivos automáticos · D+3/D+7 em lote · D+15 manual. */
export const MODOS_FABRICA: Record<PassoRegua, ModoDegrau> = {
  "D-7": "AUTOMATICO",
  "D-3": "AUTOMATICO",
  D0: "AUTOMATICO",
  "D+3": "LOTE",
  "D+7": "LOTE",
  "D+15": "MANUAL",
};

export const TEXTOS_FABRICA: Record<ModeloWhatsapp, string> = {
  amigavel:
    "Olá {nome}! 😊 Passando para lembrar da sua mensalidade de {valor}, com vencimento em {vencimento}. Qualquer dúvida, estou à disposição!",
  vencida: "Olá {nome}, notamos que a cobrança de {valor} (vencimento {vencimento}) está vencida. Consegue regularizar?",
  firme:
    "Olá {nome}, sua cobrança de {valor} está em atraso desde {vencimento}. Precisamos regularizar para manter seu acesso às aulas.",
  dados: "Olá {nome}! Seguem os dados para pagamento de {valor} (vencimento {vencimento}). Pode me confirmar quando efetuar?",
  promessa: "Olá {nome}, podemos combinar uma data para o pagamento de {valor}?",
};
