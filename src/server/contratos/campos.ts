import { z } from "zod";

export const OrigemCampoSchema = z.enum([
  "ADITIVO_CONTRATO_ORIGINAL", "ADITIVO_ANTERIORES", "ADITIVO_ALTERACOES", "ADITIVO_VIGENCIA",
  "AGENDA_PARTICULAR", "ALUNO_NOME", "ALUNO_DOCUMENTO", "ALUNO_EMAIL", "ALUNO_ENDERECO",
  "PAGADOR_NOME", "PAGADOR_DOCUMENTO", "PAGADOR_EMAIL", "PAGADOR_ENDERECO",
  "MOEDA", "REGIME", "TAXA_VALOR", "TAXA_VENCIMENTO", "MENSALIDADE_VALOR",
  "PRIMEIRA_MENSALIDADE_VENCIMENTO", "COBERTURA_INICIO", "COBERTURA_FIM",
  "HORA_VALOR", "ADIANTAMENTO_VALOR", "ADIANTAMENTO_MINUTOS", "ADIANTAMENTO_VENCIMENTO",
]);
export type OrigemCampo = z.infer<typeof OrigemCampoSchema>;
export const ROTULOS_ORIGEM: Record<OrigemCampo, string> = {
  ADITIVO_CONTRATO_ORIGINAL: "Aditivo: referência ao contrato original assinado",
  ADITIVO_ANTERIORES: "Aditivo: documentos anteriores vinculados",
  ADITIVO_ALTERACOES: "Aditivo: condições anteriores e novas aprovadas",
  ADITIVO_VIGENCIA: "Aditivo: início de vigência aprovado",
  AGENDA_PARTICULAR: "Particular: forma de agenda, fuso, professor e encontros reservados",
  ALUNO_NOME: "Aluno: nome completo", ALUNO_DOCUMENTO: "Aluno: documento", ALUNO_EMAIL: "Aluno: e-mail", ALUNO_ENDERECO: "Aluno: endereço",
  PAGADOR_NOME: "Pagador: nome", PAGADOR_DOCUMENTO: "Pagador: documento", PAGADOR_EMAIL: "Pagador: e-mail", PAGADOR_ENDERECO: "Pagador: endereço",
  MOEDA: "Moeda contratada", REGIME: "Regime de cobrança", TAXA_VALOR: "Valor da taxa de matrícula", TAXA_VENCIMENTO: "Vencimento da taxa",
  MENSALIDADE_VALOR: "Valor da mensalidade", PRIMEIRA_MENSALIDADE_VENCIMENTO: "Vencimento da primeira mensalidade", COBERTURA_INICIO: "Início da primeira cobertura mensal", COBERTURA_FIM: "Fim da primeira cobertura mensal",
  HORA_VALOR: "Preço por hora de 60 minutos", ADIANTAMENTO_VALOR: "Valor do adiantamento", ADIANTAMENTO_MINUTOS: "Minutos do adiantamento", ADIANTAMENTO_VENCIMENTO: "Vencimento do adiantamento",
};
