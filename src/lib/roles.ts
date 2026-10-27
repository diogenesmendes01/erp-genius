import { Papel } from "@prisma/client";

export { PAPEL_LABEL } from "./labels";

export function temPapel(papeis: string[] = [], ...alvo: Papel[]): boolean {
  return papeis.some((p) => alvo.includes(p as Papel));
}

export function isAdmin(papeis: string[] = []): boolean {
  return papeis.includes(Papel.ADMINISTRADOR);
}
