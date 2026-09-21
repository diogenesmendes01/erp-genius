import { ErroRegra } from "@/server/_shared";
import { planejarCobrancasEntrada } from "@/server/matricula/plano-cobrancas-entrada";
import type { OrigemCampo } from "./campos";

export type OrigemEstruturadaAditivo = {
  moeda: string;
  coberturaInicio: string | null;
  coberturaFim: string | null;
  fontesMonetarias: OrigemCampo[];
};

/**
 * Lê somente as condições imutáveis preservadas na prévia original. Campos
 * renderizados e cadastro atual não são fontes contratuais neste carregador.
 */
export function extrairOrigemEstruturadaAditivo(snapshot: unknown): OrigemEstruturadaAditivo {
  if (!snapshot || typeof snapshot !== "object" || !("condicoes" in snapshot))
    throw new ErroRegra("A prévia original não preserva condições estruturadas.");

  let plano: ReturnType<typeof planejarCobrancasEntrada>;
  try {
    plano = planejarCobrancasEntrada((snapshot as { condicoes: unknown }).condicoes);
  } catch {
    throw new ErroRegra("As condições estruturadas da prévia original são insuficientes.");
  }
  const taxa = plano.find(item => item.tipo === "MATRICULA");
  if (!taxa?.moeda) throw new ErroRegra("As condições estruturadas não identificam a moeda contratada.");
  if (plano.some(item => item.moeda !== taxa.moeda))
    throw new ErroRegra("As condições estruturadas usam moedas divergentes.");

  const mensalidade = plano.find(item => item.tipo === "MENSALIDADE");
  if (mensalidade) {
    if (!mensalidade.cobertura) throw new ErroRegra("A mensalidade original não preserva a cobertura inicial.");
    return { moeda: taxa.moeda, coberturaInicio: mensalidade.cobertura.inicio, coberturaFim: mensalidade.cobertura.fim,
      fontesMonetarias: ["TAXA_VALOR", "MENSALIDADE_VALOR"] };
  }

  const adiantamento = plano.find(item => item.tipo === "HORA_PARTICULAR");
  return { moeda: taxa.moeda, coberturaInicio: null, coberturaFim: null,
    fontesMonetarias: ["TAXA_VALOR", "HORA_VALOR", ...(adiantamento ? ["ADIANTAMENTO_VALOR" as const] : [])] };
}
