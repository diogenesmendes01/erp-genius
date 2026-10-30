import { ConteudoRegraAvaliacaoSchema } from "@/server/avaliacoes/regra-schema";
import { HABILIDADES } from "@/server/avaliacoes/calculo";

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

type Json = Record<string, unknown>;
const semCampos = (o: Json, campos: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !campos.includes(k)));

/**
 * #530: conteúdos JSON legados, como gravados antes da evolução do schema (sem os campos
 * adicionados pelas migrations de recuperação e segunda chamada). Reproduzem as versões de
 * Português A1, A2, B1 e B2 do ambiente QA que exibiam apenas "Required".
 */
export function regrasLegadasPortugues(): Record<"A1" | "A2" | "B1" | "B2", Json> {
  const base = JSON.parse(JSON.stringify(regraAvaliacaoTeste())) as Json & { habilidades: Json[]; avaliacoes: Json[] };
  const habilidadesSemLimite = base.habilidades.map(h => semCampos(h, ["limiteRecuperacoes"]));
  const avaliacoesSemLimite = base.avaliacoes.map(a => semCampos(a, ["limiteSegundasChamadas"]));
  return {
    // formato mais antigo: antes de limites, recuperação e segunda chamada
    A1: { ...semCampos(base, ["recuperacao", "segundaChamada", "habilidades", "avaliacoes"]), titulo: "Português A1", habilidades: habilidadesSemLimite, avaliacoes: avaliacoesSemLimite },
    // antes da segunda chamada
    A2: { ...semCampos(base, ["segundaChamada", "avaliacoes"]), titulo: "Português A2", avaliacoes: avaliacoesSemLimite },
    // sem limite de recuperação por habilidade
    B1: { ...semCampos(base, ["habilidades"]), titulo: "Português B1", habilidades: habilidadesSemLimite },
    // segunda chamada parcial (sem antecedência de cancelamento)
    B2: { ...base, titulo: "Português B2", segundaChamada: { prazoRealizacaoMinutos: 2000 } },
  };
}

/** Versão que nenhuma normalização recupera (campo obrigatório sem default conhecido). */
export function regraLegadaIlegivel(): Json {
  const base = JSON.parse(JSON.stringify(regraAvaliacaoTeste())) as Json;
  return semCampos(base, ["titulo", "segundaChamada"]);
}
