import { ConteudoRegraAvaliacaoSchema } from "@/server/avaliacoes/regra-schema";
import { HABILIDADES } from "@/server/avaliacoes/calculo";

/** Parâmetros exclusivamente fictícios de teste; não são padrões institucionais. */
export function regraAvaliacaoTeste() {
  return ConteudoRegraAvaliacaoSchema.parse({
    titulo: "Regra fictícia de avaliação", aplicacao: "Aplicável somente aos testes automatizados.",
    escala: { minimo: "0", maximo: "10" }, minimoGeral: "7", frequenciaMinimaPercentual: "75",
    habilidades: HABILIDADES.map(habilidade => ({ habilidade, peso: "1", minimo: "6", limiteRecuperacoes: 2 })),
    avaliacoes: [
      { codigo: "I1", titulo: "Intermediária de fala", etapa: "INTERMEDIARIA", peso: "1", habilidades: ["FALA"], limiteSegundasChamadas: 1 },
      { codigo: "F1", titulo: "Avaliação final", etapa: "FINAL", peso: "3", habilidades: [...HABILIDADES], limiteSegundasChamadas: 2 },
    ],
    recuperacao: { prazoRealizacaoMinutos: 1000, antecedenciaCancelamentoMinutos: 60 },
    segundaChamada: { prazoRealizacaoMinutos: 2000, antecedenciaCancelamentoMinutos: 90 },
  });
}
