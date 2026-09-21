import { z } from "zod";
import { DataCivilContinuidadeSchema } from "./continuidade-mensal-schema";

const StatusMensalidadeSchema = z.enum(["PENDENTE", "PAGO", "ATRASADO", "CANCELADA"]);
const RegularizacaoIntegralSchema = z.enum(["CREDITO", "COBERTURA_FUTURA"]);

/**
 * Recorte persistido necessário para escolher uma âncora de continuidade.
 * Datas nulas representam legado sem cobertura definida e exigem conferência.
 */
export const MensalidadeCadeiaContinuidadeSchema = z.object({
  id: z.string().trim().min(1),
  coberturaInicio: DataCivilContinuidadeSchema.nullable(),
  coberturaFim: DataCivilContinuidadeSchema.nullable(),
  status: StatusMensalidadeSchema,
  suspensaPorItemPausaId: z.string().trim().min(1).nullable(),
  regularizacaoIntegral: RegularizacaoIntegralSchema.nullable(),
}).strict();

export const EntradaConferirCadeiaContinuidadeSchema = z.object({
  mensalidades: z.array(MensalidadeCadeiaContinuidadeSchema).max(10_000),
}).strict();

export type MensalidadeCadeiaContinuidade = z.infer<typeof MensalidadeCadeiaContinuidadeSchema>;
export type EntradaConferirCadeiaContinuidade = z.input<typeof EntradaConferirCadeiaContinuidadeSchema>;

export type ResultadoConferirCadeiaContinuidade =
  | { estado: "CONFERIDA"; ultima: { id: string; inicio: string; fim: string } }
  | { estado: "A_CONFERIR"; motivo: string };

type MensalidadeComCobertura = MensalidadeCadeiaContinuidade & {
  coberturaInicio: string;
  coberturaFim: string;
};

function sobrepoe(a: MensalidadeComCobertura, b: MensalidadeComCobertura) {
  return a.coberturaInicio <= b.coberturaFim && b.coberturaInicio <= a.coberturaFim;
}

function possuiCobertura(mensalidade: MensalidadeCadeiaContinuidade): mensalidade is MensalidadeComCobertura {
  return mensalidade.coberturaInicio !== null && mensalidade.coberturaFim !== null;
}

function eAncora(mensalidade: MensalidadeComCobertura) {
  // A regularização em cobertura futura preserva a cobertura hoje registrada.
  return mensalidade.status !== "CANCELADA" && mensalidade.regularizacaoIntegral !== "CREDITO";
}

/**
 * Q161/Q162 não são inferidas aqui. Esta função somente escolhe uma cobertura
 * já registrada ou devolve a cadeia para conferência; ela jamais cria cobrança.
 */
export function conferirCadeiaContinuidade(
  input: EntradaConferirCadeiaContinuidade,
): ResultadoConferirCadeiaContinuidade {
  const { mensalidades } = EntradaConferirCadeiaContinuidadeSchema.parse(input);
  const ids = new Set<string>();

  for (const mensalidade of mensalidades) {
    if (ids.has(mensalidade.id)) {
      return { estado: "A_CONFERIR", motivo: `Mensalidade repetida na cadeia: ${mensalidade.id}.` };
    }
    ids.add(mensalidade.id);

    if (!possuiCobertura(mensalidade)) {
      return { estado: "A_CONFERIR", motivo: `Mensalidade sem cobertura definida: ${mensalidade.id}.` };
    }
    if (mensalidade.coberturaFim < mensalidade.coberturaInicio) {
      return { estado: "A_CONFERIR", motivo: `Cobertura invertida: ${mensalidade.id}.` };
    }
  }

  const comCobertura = mensalidades as MensalidadeComCobertura[];
  const elegiveis = comCobertura.filter(eAncora)
    .sort((a, b) => a.coberturaInicio.localeCompare(b.coberturaInicio) || a.coberturaFim.localeCompare(b.coberturaFim));

  for (let indice = 1; indice < elegiveis.length; indice++) {
    if (sobrepoe(elegiveis[indice - 1], elegiveis[indice])) {
      return { estado: "A_CONFERIR", motivo: "Coberturas elegíveis sobrepostas exigem conferência." };
    }
  }

  const suspensa = comCobertura.find((mensalidade) =>
    mensalidade.suspensaPorItemPausaId !== null,
  );
  if (suspensa) {
    return { estado: "A_CONFERIR", motivo: `Suspensão remanescente na mensalidade: ${suspensa.id}.` };
  }

  const ultima = [...elegiveis].sort((a, b) =>
    b.coberturaFim.localeCompare(a.coberturaFim) || b.coberturaInicio.localeCompare(a.coberturaInicio),
  )[0];
  if (!ultima) {
    return { estado: "A_CONFERIR", motivo: "Não há cobertura regular para ancorar a continuidade." };
  }

  const naoAncoraPosteriorOuSobreposta = comCobertura.find((mensalidade) =>
    !eAncora(mensalidade) &&
    (sobrepoe(mensalidade, ultima) || mensalidade.coberturaInicio > ultima.coberturaFim),
  );
  if (naoAncoraPosteriorOuSobreposta) {
    return {
      estado: "A_CONFERIR",
      motivo: `Mensalidade cancelada ou regularizada por crédito conflita com a última âncora: ${naoAncoraPosteriorOuSobreposta.id}.`,
    };
  }

  return {
    estado: "CONFERIDA",
    ultima: { id: ultima.id, inicio: ultima.coberturaInicio, fim: ultima.coberturaFim },
  };
}
