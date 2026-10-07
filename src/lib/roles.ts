import { Papel } from "@prisma/client";

// Rótulos dos papéis: em labels.ts (mapa de rótulo só lá — E5, R3 da #138); reexportados aqui para os imports antigos.
export { PAPEL_LABEL } from "./labels";

export function temPapel(papeis: string[] = [], ...alvo: Papel[]): boolean {
  return papeis.some((p) => alvo.includes(p as Papel));
}

export function isAdmin(papeis: string[] = []): boolean {
  return papeis.includes(Papel.ADMINISTRADOR);
}
