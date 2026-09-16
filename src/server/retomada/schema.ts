import { z } from "zod";

export const OPCOES_RETOMADA = ["MANTER_VENCIMENTOS", "REPROGRAMAR_PARCELAS"] as const;

/** Data de calendário local, sem aceitar normalização de 31/02 ou strings com horário. */
export function dataRetomada(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia, 12);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? data : null;
}

export const SolicitarRetomadaSchema = z.object({
  opcao: z.enum(OPCOES_RETOMADA),
  motivo: z.string().trim().min(5, "Informe o motivo da retomada (mínimo 5 caracteres).").max(2000),
  novosVencimentos: z.array(z.object({
    cobrancaId: z.string().min(1),
    vencimento: z.string().refine((valor) => dataRetomada(valor) !== null, "Informe uma data real no formato AAAA-MM-DD."),
  })).default([]),
}).superRefine((dados, ctx) => {
  if (dados.opcao === "MANTER_VENCIMENTOS" && dados.novosVencimentos.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["novosVencimentos"], message: "Manter vencimentos não permite informar novas datas." });
  }
  if (new Set(dados.novosVencimentos.map((parcela) => parcela.cobrancaId)).size !== dados.novosVencimentos.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["novosVencimentos"], message: "Uma cobrança não pode receber duas datas." });
  }
});
export type SolicitarRetomadaInput = z.input<typeof SolicitarRetomadaSchema>;

export const DecidirRetomadaSchema = z.object({
  aprovar: z.boolean(),
  motivo: z.string().trim().min(5, "Informe o motivo da decisão (mínimo 5 caracteres).").max(2000),
});
export type DecidirRetomadaInput = z.input<typeof DecidirRetomadaSchema>;

export interface ParcelaRetomada {
  cobrancaId: string;
  codigo: string | null;
  matriculaId: string;
  matriculaCodigo: string | null;
  moeda: string;
  status: string;
  valorNegociado: number;
  valorRecebido: number;
  saldo: number;
  vencimento: string;
  competencia: string | null;
  restaurar: boolean;
}

export interface ContextoRetomada {
  alunoId: string;
  alunoNome: string;
  status: string;
  dataMinimaReprogramacao: string;
  pausa: { id: string; criadoEm: string; motivo: string | null } | null;
  propostaPendenteId: string | null;
  impedimento: string | null;
  parcelas: ParcelaRetomada[];
}

export interface PropostaRetomadaResumo {
  id: string;
  alunoId: string;
  alunoNome: string;
  pausaId: string;
  opcao: typeof OPCOES_RETOMADA[number];
  status: string;
  motivo: string;
  solicitante: { id: string; nome: string };
  aprovador: { id: string; nome: string } | null;
  criadoEm: string;
  decididoEm: string | null;
  motivoDecisao: string | null;
  podeDecidir: boolean;
  impedimentoAprovacao: string | null;
  parcelas: (ParcelaRetomada & { novoVencimento: string })[];
}
