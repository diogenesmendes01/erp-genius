import { EtapaLead } from "@prisma/client";

// Funil completo na ordem do doc 08. As etapas geradas por evento (Exp. Realizada,
// Proposta, Aguardando Matrícula) seguem visíveis para acompanhamento, mas NÃO
// recebem arraste — só ETAPAS_MANUAIS + Matriculado/Perdido (fluxo próprio) aceitam.
// Módulo sem "use client": o loading.tsx (server) também usa, para o esqueleto ter as mesmas colunas.
export const COLUNAS: EtapaLead[] = [
  EtapaLead.NOVO,
  EtapaLead.EM_ATENDIMENTO,
  EtapaLead.QUALIFICADO,
  EtapaLead.EXPERIMENTAL_AGENDADA,
  EtapaLead.EXPERIMENTAL_REALIZADA,
  EtapaLead.PROPOSTA,
  EtapaLead.AGUARDANDO_MATRICULA,
  EtapaLead.MATRICULADO,
  EtapaLead.PERDIDO,
];
