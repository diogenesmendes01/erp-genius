/**
 * URL do funil para uma visualização salva. As chaves salvas já são as de FiltrosFunil
 * (CHAVES_FILTRO.FUNIL), as mesmas que lerFiltrosFunil lê da URL.
 */
export function hrefSalvo(f: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/funil?${s}` : "/funil";
}
