import type { FiltrosContatos } from "@/server/crm/contatos";

/** Parâmetros que a URL da lista mantém ao abrir uma ficha ou trocar de página. */
export function paramsDaLista(f: FiltrosContatos): Record<string, string | number | null> {
  return {
    busca: f.busca,
    tipo: f.tipo === "todos" ? null : f.tipo,
    tagId: f.tagId,
    donoId: f.donoId,
    etapa: f.etapa,
    origem: f.origem,
  };
}
