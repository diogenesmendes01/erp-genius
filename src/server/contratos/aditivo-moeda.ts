import { Prisma } from "@prisma/client";
import { z } from "zod";
import { validarValorAlteracaoAditivo } from "./aditivo-valores";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";

export const ROTULOS_PENDENCIA_MOEDA: Record<string, string> = {
  COBRANCA_EM_ABERTO: "Há cobrança em aberto na moeda anterior. Receba, cancele ou acerte antes da troca.",
  COMPROVANTE_A_CONFERIR: "Há comprovante de pagamento aguardando conferência em cobrança da moeda anterior.",
  COBERTURA_MENSAL_ALEM_DA_VIGENCIA: "Existe mensalidade na moeda anterior cuja cobertura alcança a vigência do aditivo. A troca só vale a partir do fim dessa cobertura.",
  SALDO_HORAS_PRE_PAGAS: "Há saldo ou reserva pendente de horas pré-pagas compradas na moeda anterior. Consuma, libere com crédito ou liquide antes da troca.",
  PERMUTA_VIGENTE: "Há acordo de permuta vigente na moeda anterior. Encerre ou aguarde o fim da vigência.",
  // R1 do #284: direitos em andamento que, depois da troca, não teriam mais caminho. Nada é convertido.
  COMPENSACAO_COBERTURA_PENDENTE: "Há compensação de cobertura aguardando decisão sobre mensalidade da moeda anterior. Decida antes da troca.",
  DIAS_COMPENSACAO_PENDENTES: "Há dias de compensação aprovados sobre mensalidade da moeda anterior ainda não recompostos nem liquidados. Destine-os antes da troca.",
  PERIODO_INTEGRAL_PENDENTE: "Há proposta de período integral sobre cobrança da moeda anterior aguardando decisão ou aplicação. Conclua antes da troca.",
  PERMUTA_SERVICO_SEM_COMPENSACAO: "Há serviço de permuta confirmado em acordo da moeda anterior sem compensação aprovada. Compense antes da troca.",
  // Q171: saldo restrito só abate cobrança da mesma moeda e nunca vira dinheiro. Até o dono decidir, bloqueia a troca.
  SALDO_SERVICOS_PERMUTA: "Há saldo restrito a serviços de permuta disponível na moeda anterior. Use-o em cobrança da mesma moeda antes da troca.",
  DESTINACAO_EXCEDENTE_PENDENTE: "Há destinação de excedente de permuta na moeda anterior aguardando decisão. Decida antes da troca.",
  // R2 do #284.
  ADIANTAMENTO_SEM_COMPRA: "Há adiantamento de horas pago na moeda anterior ainda sem compra registrada. Registre a compra (e consuma, libere ou liquide as horas) antes da troca.",
  HORAS_A_FATURAR: "Há aula por hora da moeda anterior ainda não faturada: conferida sem fechamento, ou anterior à vigência ainda sem conferência financeira. Confira e feche as horas antes da troca.",
  REVISAO_CORRECAO_AULA_DEVOLVE_MINUTOS: "Há revisão financeira de correção de aula pendente que devolveria minutos a uma compra de horas da moeda anterior. Decida antes da troca.",
};

export type PendenciaMoeda = { codigo: string; texto: string };

/**
 * Alvo da troca: moeda formalizada, moeda atual e o que ainda impede a matrícula de estar "limpa".
 * O banco é a autoridade das pendências (`pendencias_moeda_antiga_173`); a vigência é lida no fuso da escola.
 */
export async function consultarAlvoMoedaTx(tx: Prisma.TransactionClient, matriculaId: string, versao: { condicoes: unknown; vigenciaInicio: Date }) {
  const bruto = z.record(z.unknown()).parse(versao.condicoes).MOEDA;
  const formalizada = bruto === undefined ? null : validarValorAlteracaoAditivo("MOEDA", bruto);
  const moedaNova = formalizada?.tipo === "MOEDA" ? formalizada.moeda : null;
  const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: matriculaId }, select: { moeda: true } });
  const vazio = { moedaAtual: matricula.moeda, moedaNova, fuso: null as string | null, pendencias: [] as PendenciaMoeda[], podePreparar: false };
  if (!moedaNova) return { ...vazio, pendencia: "Este aditivo não formaliza mudança de moeda." };
  if (moedaNova === matricula.moeda) return { ...vazio, pendencia: "A matrícula já opera na moeda formalizada." };
  const fuso = await carregarFusoInstitucionalTx(tx);
  if (!fuso) return { ...vazio, pendencia: "Configure o fuso institucional antes da troca de moeda: a vigência é conferida no dia civil da escola." };
  const [linha] = await tx.$queryRaw<Array<{ pendencias: string[] }>>`SELECT pendencias_moeda_antiga_173(${matriculaId},${matricula.moeda},(${versao.vigenciaInicio}::timestamptz AT TIME ZONE 'UTC'),${fuso}) AS pendencias`;
  const pendencias = (linha?.pendencias ?? []).map(codigo => ({ codigo, texto: ROTULOS_PENDENCIA_MOEDA[codigo] ?? codigo }));
  return { moedaAtual: matricula.moeda, moedaNova, fuso, pendencias, podePreparar: pendencias.length === 0,
    pendencia: pendencias.length ? "A troca de moeda exige a matrícula sem pendências na moeda anterior." : "A troca de moeda exige proposta de acerto e aprovação financeira independente antes da aplicação." };
}
