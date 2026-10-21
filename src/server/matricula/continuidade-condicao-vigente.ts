import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import {
  DataCivilContinuidadeSchema,
  RegrasContinuidadeMensalSchema,
} from "./continuidade-mensal-schema";

const CondicaoParaSelecaoSchema = z
  .object({
    id: z.string().min(1),
    versao: z.number().int().nonnegative(),
    regras: z.unknown(),
  })
  .passthrough();

export type CondicaoContinuidadeParaSelecao = z.output<typeof CondicaoParaSelecaoSchema>;
export type RegrasContinuidadeMensal = z.output<typeof RegrasContinuidadeMensalSchema>;

export type CondicaoContinuidadeVigente<T extends CondicaoContinuidadeParaSelecao> = {
  condicoes: T;
  regras: RegrasContinuidadeMensal;
};

/**
 * Confere todas as condições aprovadas carregadas pelo chamador e seleciona a
 * que já vigora na data civil informada. Esta função não consulta nem aprova
 * condições; documento, moeda e preço continuam sendo gates do consumidor.
 */
export function selecionarCondicaoContinuidadeVigente<
  T extends CondicaoContinuidadeParaSelecao,
>(condicoes: readonly T[], data: string): CondicaoContinuidadeVigente<T> {
  const dataCivil = DataCivilContinuidadeSchema.parse(data);
  const candidatas = condicoes.map((condicao) => {
    const estrutura = CondicaoParaSelecaoSchema.safeParse(condicao);
    if (!estrutura.success) {
      throw new ErroRegra("Há condição de continuidade aprovada sem versão ou dados conferíveis.");
    }
    const completa = RegrasContinuidadeMensalSchema.safeParse(condicao.regras);
    if (completa.success) {
      return { condicoes: condicao, vigenteDesde: completa.data.vigenteDesde, completa: true };
    }
    const objeto = z.record(z.unknown()).safeParse(condicao.regras);
    const eLegadaSemReferencia =
      objeto.success &&
      !Object.prototype.hasOwnProperty.call(objeto.data, "referenciaVencimento") &&
      RegrasContinuidadeMensalSchema.safeParse({
        ...objeto.data,
        referenciaVencimento: "MES_COBERTURA",
      }).success;
    if (!eLegadaSemReferencia) {
      throw new ErroRegra(
        "Há condição de continuidade aprovada com dados incompletos. Confira o histórico antes de prosseguir.",
      );
    }
    const vigenteDesde = DataCivilContinuidadeSchema.parse(objeto.data.vigenteDesde);
    return { condicoes: condicao, vigenteDesde, completa: false };
  });
  candidatas.sort(
    (esquerda, direita) =>
      direita.vigenteDesde.localeCompare(esquerda.vigenteDesde) ||
      direita.condicoes.versao - esquerda.condicoes.versao,
  );
  const candidata = candidatas.find(({ vigenteDesde }) => vigenteDesde <= dataCivil);
  if (!candidata) {
    throw new ErroRegra("Não há condição de continuidade mensal aprovada e vigente para esta cobertura.");
  }
  if (!candidata.completa) {
    throw new ErroRegra(
      "A condição de continuidade mais recente e vigente está incompleta. Confira ou substitua essa versão.",
    );
  }
  const regras = RegrasContinuidadeMensalSchema.safeParse(candidata.condicoes.regras);
  if (!regras.success) throw new ErroRegra("A condição de continuidade mais recente e vigente está incompleta. Confira ou substitua essa versão.");
  return { condicoes: candidata.condicoes, regras: regras.data };
}
