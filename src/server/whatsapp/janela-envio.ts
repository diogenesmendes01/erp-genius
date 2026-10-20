import { horaEDiaInstitucional } from "@/server/operacao/fuso";

/**
 * Janela de envio (S3): horas [janelaInicio, janelaFim) e dias da semana (0 = domingo) em que uma mensagem pode
 * sair. É a regra que o despachante usa para adiar a automação (passo 8) e a que recusa o agendamento de uma
 * mensagem fora do horário (D12, #202 C4): uma fonte só, para as duas não divergirem.
 */
export interface JanelaEnvio {
  janelaInicio: number;
  janelaFim: number;
  diasSemana: readonly number[];
}

/** `instante` cai dentro da janela no `fuso`? Fuso inválido no cadastro usa a hora do servidor (não trava a fila). */
export function dentroDaJanelaEnvio(instante: Date, fuso: string, janela: JanelaEnvio): boolean {
  let local: { hora: number; diaSemana: number };
  try {
    local = horaEDiaInstitucional(instante, fuso);
  } catch {
    local = { hora: instante.getHours(), diaSemana: instante.getDay() };
  }
  return local.hora >= janela.janelaInicio && local.hora < janela.janelaFim && janela.diasSemana.includes(local.diaSemana);
}

const NOME_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function descreverDias(dias: readonly number[]): string {
  const ordenados = [...new Set(dias)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (ordenados.length === 7) return "todos os dias";
  const seguidos = ordenados.length >= 3 && ordenados.every((d, i) => i === 0 || d === ordenados[i - 1] + 1);
  if (seguidos) return `de ${NOME_DIA[ordenados[0]]} a ${NOME_DIA[ordenados.at(-1)!]}`;
  const nomes = ordenados.map((d) => `${d === 0 || d === 6 ? "no" : "na"} ${NOME_DIA[d]}`);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : nomes[0] ?? "em nenhum dia";
}

/** Recusa do agendamento fora da janela, com o horário que vale (decisão D12). */
export function mensagemForaDaJanela(janela: JanelaEnvio, fuso: string): string {
  return `Fora da janela de envio da escola: as mensagens saem das ${janela.janelaInicio}h às ${janela.janelaFim}h, `
    + `${descreverDias(janela.diasSemana)} (horário de ${fuso}). Escolha outro horário.`;
}
