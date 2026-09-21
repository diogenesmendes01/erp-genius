import { Prisma } from "@prisma/client";
import { z } from "zod";
import { validarValorAlteracaoAditivo } from "./aditivo-valores";

const ROTULOS_PENDENCIA: Record<string, string> = {
  COBRANCA_EM_ABERTO: "Há cobrança em aberto na moeda anterior. Receba, cancele ou acerte antes da troca.",
  COMPROVANTE_A_CONFERIR: "Há comprovante de pagamento aguardando conferência em cobrança da moeda anterior.",
  COBERTURA_MENSAL_ALEM_DA_VIGENCIA: "Existe mensalidade na moeda anterior cuja cobertura alcança a vigência do aditivo. A troca só vale a partir do fim dessa cobertura.",
  SALDO_HORAS_PRE_PAGAS: "Há saldo de horas pré-pagas compradas na moeda anterior. Consuma, libere com crédito ou liquide antes da troca.",
  PERMUTA_VIGENTE: "Há acordo de permuta vigente na moeda anterior. Encerre ou aguarde o fim da vigência.",
};

/** Alvo da troca: moeda formalizada, moeda atual e o que ainda impede a matrícula de estar "limpa". O banco é a autoridade das pendências. */
export async function consultarAlvoMoedaTx(tx: Prisma.TransactionClient, matriculaId: string, versao: { condicoes: unknown; vigenciaInicio: Date }) {
  const bruto = z.record(z.unknown()).parse(versao.condicoes).MOEDA;
  const formalizada = bruto === undefined ? null : validarValorAlteracaoAditivo("MOEDA", bruto);
  const moedaNova = formalizada?.tipo === "MOEDA" ? formalizada.moeda : null;
  const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: matriculaId }, select: { moeda: true } });
  if (!moedaNova) return { moedaAtual: matricula.moeda, moedaNova: null, pendencias: [] as { codigo: string; texto: string }[], podePreparar: false, pendencia: "Este aditivo não formaliza mudança de moeda." };
  if (moedaNova === matricula.moeda) return { moedaAtual: matricula.moeda, moedaNova, pendencias: [], podePreparar: false, pendencia: "A matrícula já opera na moeda formalizada." };
  const [linha] = await tx.$queryRaw<Array<{ pendencias: string[] }>>`SELECT pendencias_moeda_antiga_173(${matriculaId},${matricula.moeda},(${versao.vigenciaInicio}::timestamptz AT TIME ZONE 'UTC')) AS pendencias`;
  const pendencias = (linha?.pendencias ?? []).map(codigo => ({ codigo, texto: ROTULOS_PENDENCIA[codigo] ?? codigo }));
  return { moedaAtual: matricula.moeda, moedaNova, pendencias, podePreparar: pendencias.length === 0,
    pendencia: pendencias.length ? "A troca de moeda exige a matrícula sem pendências na moeda anterior." : "A troca de moeda exige proposta de acerto e aprovação financeira independente antes da aplicação." };
}

