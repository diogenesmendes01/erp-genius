import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";

type ItemComPrazo = Pick<ItemListaInbox, "grupo" | "status" | "prazoRespostaEm">;

export function prazoEstourado(i: ItemComPrazo, agora: number): boolean {
  return !i.grupo && i.status !== "ENCERRADO" && !!i.prazoRespostaEm && new Date(i.prazoRespostaEm).getTime() < agora;
}
