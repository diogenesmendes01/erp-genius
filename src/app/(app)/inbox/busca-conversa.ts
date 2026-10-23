import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
export function normalizarBusca(s: string): string { return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/gu, " "); }
export function encontrarMensagens(mensagens: readonly Pick<MensagemThread, "id" | "corpo" | "criadoEm" | "apagada">[], termo: string): string[] {
 const busca = normalizarBusca(termo);
 if ([...busca].length < 2) return [];
 return mensagens.filter(m => !m.apagada && m.corpo != null && normalizarBusca(m.corpo).includes(busca))
  .sort((a,b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id)).map(m => m.id);
}
export function moverAchado(ids: readonly string[], atual: string | null, direcao: 1 | -1): string | null {
 if (!ids.length) return null;
 const indice = atual == null ? -1 : ids.indexOf(atual);
 return ids[indice < 0 ? direcao === 1 ? 0 : ids.length - 1 : (indice + direcao + ids.length) % ids.length];
}
