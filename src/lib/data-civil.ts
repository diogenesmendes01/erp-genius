// Datas civis e competências na tela (docs/42-auditoria-frontend-ux.md, E5): várias telas imprimiam
// "2026-10-15" e "2026-10" crus. Data civil é um DIA, não um instante — nunca passa por `new Date`
// no navegador (mudaria de dia conforme o fuso). Instantes seguem formatarInstanteExibicao.

const DATA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPETENCIA = /^(\d{4})-(\d{2})$/;

/**
 * "2026-10-15" → "15/10/2026". Ausente → "—". Qualquer outro texto volta como está (nunca inventa
 * uma data a partir de um valor que não tem a forma de data civil).
 */
export function formatarDataCivil(valor: string | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const m = DATA_CIVIL.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

/** Competência "2026-10" → "10/2026". Ausente → "—". Outro texto volta como está. */
export function formatarCompetencia(valor: string | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const m = COMPETENCIA.exec(valor);
  return m ? `${m[2]}/${m[1]}` : valor;
}
