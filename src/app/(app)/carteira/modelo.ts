import type { CorTag, EtapaLead } from "@prisma/client";

/** Contrato da tela. Sem Prisma em runtime: o componente cliente importa daqui. */

export type FiltrosCarteira = {
  donoId: string;
  busca: string;
  semInteracaoDias: "" | "7" | "15" | "30";
  emTurma: boolean;
  tipo: "todos" | "pf" | "pj";
};

export type LinhaCarteira = {
  oportunidadeId: string;
  pessoaId: string | null;
  empresaId: string | null;
  nome: string;
  tipo: "pf" | "pj";
  etapa: EtapaLead;
  dono: { id: string; nome: string } | null;
  diasSemInteracao: number;
  turmaAtiva: string | null;
  tags: { id: string; nome: string; cor: CorTag }[];
};

export type VendedorCarteira = { id: string; nome: string; total: number; cobertoPor: string | null };

export const TEXTO_CONSEQUENCIA_REATRIBUICAO =
  "Os atendimentos comerciais abertos passam para o novo responsável e as mensagens agendadas pelo responsável anterior são canceladas.";

export const MAX_LOTE_CARTEIRA = 50;
