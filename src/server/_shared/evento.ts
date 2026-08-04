import { Prisma } from "@prisma/client";

// Gravação padronizada de Evento (ver docs/12-catalogo-de-eventos.md).
// Regra inegociável (docs/13): toda mutação relevante grava um Evento na MESMA
// transação da mudança de estado. Use sempre dentro de prisma.$transaction.

/** Agregados conhecidos (mantém consistência com o catálogo de eventos). */
export type AgregadoTipo =
  | "Lead"
  | "Matricula"
  | "Aluno"
  | "Cobranca"
  | "Comissao"
  | "Turma"
  | "Pais"
  | "Usuario"
  | "Idioma"
  | "Modalidade"
  | "Nivel"
  | "Produto"
  | "Preco"
  | "TaxaCambio"
  // Canal WhatsApp (docs 26/30). Conversa/Mensagem NÃO são agregados de Evento:
  // são tabelas operacionais (doc 29 regra 3 — "Evento = auditoria; tabela = operacional").
  | "NumeroWhatsApp"
  | "ContatoWhatsApp"
  | "TemplateWhatsApp"
  | "PoliticaRegua"
  // Fase comercial (doc 27): config de automação comercial (auto-lead + saudação) e a
  // régua comercial editável (lead-novo e demais cadências).
  | "ConfigComercial"
  | "PoliticaComercial";

export interface EntradaEvento {
  /** Nome do evento em PascalCase (ex.: "MatriculaAtivada"). */
  tipo: string;
  agregadoTipo: AgregadoTipo;
  agregadoId: string;
  /** Autor da ação (null = sistema/cron). */
  autorId?: string | null;
  /** Antes→depois + contexto. */
  payload?: Prisma.InputJsonValue;
  /** Versão do formato do payload (default 1). */
  versao?: number;
}

/**
 * Grava um Evento usando o client transacional (`tx`) recebido de
 * `prisma.$transaction(async (tx) => { ... })`.
 *
 * @example
 * await prisma.$transaction(async (tx) => {
 *   await tx.lead.update({ ... });
 *   await registrarEvento(tx, {
 *     tipo: "EtapaAlterada", agregadoTipo: "Lead", agregadoId, autorId,
 *     payload: { de, para },
 *   });
 * });
 */
export async function registrarEvento(
  tx: Prisma.TransactionClient,
  entrada: EntradaEvento,
): Promise<void> {
  await tx.evento.create({
    data: {
      tipo: entrada.tipo,
      agregadoTipo: entrada.agregadoTipo,
      agregadoId: entrada.agregadoId,
      autorId: entrada.autorId ?? null,
      payload: entrada.payload,
      versao: entrada.versao ?? 1,
    },
  });
}
