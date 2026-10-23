import type { FiltrosInbox, IdChipInbox } from "@/server/inbox/filtros";
/** Formato público da URL, compartilhado com o painel anterior até sua retirada. */
export function paramsDaUrl(f: FiltrosInbox): URLSearchParams {
 const q = new URLSearchParams();
 if (f.setor) q.set("setor", f.setor);
 if (f.numeroId) q.set("numero", f.numeroId);
 if (f.responsavel) q.set("resp", f.responsavel);
 if (f.status) q.set("status", f.status);
 if (f.naoLidas) q.set("naoLidas", "1");
 if (f.prazoEstourado) q.set("prazo", "estourado");
 if (f.busca) q.set("busca", f.busca);
 return q;
}
export function hrefDosFiltros(caminho: string, f: FiltrosInbox): string {
 const q = paramsDaUrl(f).toString();
 return q ? caminho + "?" + q : caminho;
}
export function filtrosDoChip(id: IdChipInbox, f: FiltrosInbox): FiltrosInbox {
 const novo = { ...f };
 delete novo.responsavel; delete novo.naoLidas; delete novo.prazoEstourado;
 if (id === "minhas") novo.responsavel = "eu";
 if (id === "fila") novo.responsavel = "fila";
 if (id === "naoLidas") novo.naoLidas = true;
 if (id === "prazo") novo.prazoEstourado = true;
 return novo;
}
export function chipAtivo(f: FiltrosInbox): IdChipInbox | null {
 const dimensoes = Number(!!f.responsavel) + Number(!!f.naoLidas) + Number(!!f.prazoEstourado);
 if (dimensoes > 1) return null;
 if (f.responsavel) return f.responsavel === "eu" ? "minhas" : f.responsavel === "fila" ? "fila" : null;
 return f.naoLidas ? "naoLidas" : f.prazoEstourado ? "prazo" : "todas";
}
