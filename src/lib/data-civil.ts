const DATA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPETENCIA = /^(\d{4})-(\d{2})$/;

export function formatarDataCivil(valor: string | null | undefined, ausente = "—"): string {
  if (valor == null || valor === "") return ausente;
  const m = DATA_CIVIL.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

export function formatarCompetencia(valor: string | null | undefined, ausente = "—"): string {
  if (valor == null || valor === "") return ausente;
  const m = COMPETENCIA.exec(valor);
  return m ? `${m[2]}/${m[1]}` : valor;
}
