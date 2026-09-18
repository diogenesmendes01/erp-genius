export type TipoAcerto = "" | "VALOR_FIXO" | "PERCENTUAL_VALOR_NEGOCIADO";
export type AlcanceAcerto = "TODAS_COBRANCAS_MATRICULA" | "TIPOS_COBRANCA" | "COBRANCAS_IDENTIFICADAS" | "TOTAL_CONTRATACAO";

/** Converte escolhas visíveis em regra estruturada. A validação de limites e
 * consistência final permanece no schema compartilhado. */
export function montarAcertoDesistenciaPreparacao(formulario: FormData, tipo: TipoAcerto, alcance: AlcanceAcerto) {
  if (!tipo) return undefined;
  const valor = String(formulario.get("valorAcerto") ?? "");
  const clausulaId = String(formulario.get("clausulaAcerto") ?? "");
  const cobrancaIds = formulario.getAll("cobrancasAcerto").map(String);
  const porCobranca = alcance === "TODAS_COBRANCAS_MATRICULA"
    ? { momento: "ANTES_ATIVACAO" as const, unidade: "POR_COBRANCA" as const, alcance: { tipo: "TODAS_COBRANCAS_MATRICULA" as const } }
    : alcance === "TIPOS_COBRANCA"
      ? { momento: "ANTES_ATIVACAO" as const, unidade: "POR_COBRANCA" as const, alcance: { tipo: "TIPOS_COBRANCA" as const, tipos: formulario.getAll("tiposAcerto").map(String) } }
      : { momento: "ANTES_ATIVACAO" as const, unidade: "POR_COBRANCA" as const, alcance: { tipo: "COBRANCAS_IDENTIFICADAS" as const, cobrancaIds } };
  const condicoesAplicacao = alcance === "TOTAL_CONTRATACAO"
    ? { momento: "ANTES_ATIVACAO" as const, unidade: "TOTAL_CONTRATACAO" as const, cobrancaIds, rateio: cobrancaIds.map((cobrancaId) => ({ cobrancaId, percentual: String(formulario.get(`rateio:${cobrancaId}`) ?? "") })) }
    : porCobranca;
  return tipo === "VALOR_FIXO"
    ? { tipo, valor, clausulaId, condicoesAplicacao }
    : { tipo, percentual: valor, clausulaId, condicoesAplicacao };
}
