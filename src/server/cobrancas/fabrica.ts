import type { ModoDegrau } from "@prisma/client";
import type { ModeloWhatsapp } from "@/server/financeiro/schema";
import type { PassoRegua } from "./regua";

export const POLITICA_COBRANCA_NOME = "Régua de cobrança (padrão)";

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
