import type { EtapaLead, Segmento, Temperatura } from "@prisma/client";

// C3 — IA COPILOTO (doc 27): contratos PUROS do módulo. A IA é SÓ-LEITURA — produz uma
// ANÁLISE; quem muda o CRM é o humano (aceitar/corrigir), pelas mesmas mutações e com os
// mesmos guards das telas. A IA nunca envia mensagem (lei de código do doc 27 §config).

/** Snapshot do lead entregue ao driver (só o que a análise precisa). */
export interface ContextoLead {
  nome: string;
  etapa: EtapaLead;
  temperatura: Temperatura;
  segmento: Segmento;
  b2b: boolean;
  criadoEmISO: string;
  dataExperimentalISO: string | null;
  resumoAtual: {
    interesse: string | null;
    objetivo: string | null;
    urgencia: string | null;
    orcamento: string | null;
    objecao: string | null;
    proximaAcao: string | null;
  };
  /** Destinos MANUAIS válidos a partir da etapa atual — a IA só pode sugerir estes. */
  etapasPermitidas: EtapaLead[];
}

export interface MensagemContexto {
  direcao: "ENTRADA" | "SAIDA";
  corpo: string;
  quandoISO: string;
}

export interface ContextoAnalise {
  lead: ContextoLead;
  /** Últimas mensagens da conversa (mais antigas primeiro). */
  mensagens: MensagemContexto[];
  /** Notas internas da equipe (contexto, nunca saem do ERP). */
  notasInternas: string[];
}

/** Resumo executivo nos 6 campos do doc 08. */
export interface ResumoExecutivo {
  interesse: string | null;
  objetivo: string | null;
  urgencia: string | null;
  orcamento: string | null;
  objecao: string | null;
  proximaAcao: string | null;
}

/** Saída da análise — campos null = a IA não tem o que sugerir naquele eixo. */
export interface AnaliseLead {
  resumo: ResumoExecutivo | null;
  temperatura: Temperatura | null;
  segmento: Segmento | null;
  /** Só destinos de `etapasPermitidas`; o orquestrador revalida contra a máquina. */
  etapaSugerida: EtapaLead | null;
  justificativa: string;
}

export interface DriverIA {
  /** Nome estampado na sugestão (auditoria/métrica por modelo). */
  nome: string;
  analisar(ctx: ContextoAnalise): Promise<AnaliseLead>;
}
