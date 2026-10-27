import { Papel } from "@prisma/client";
import { memoPorRequisicao } from "@/server/_shared/memo-requisicao";

export const papeisDaSessao = memoPorRequisicao(async (): Promise<Papel[]> => {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return [];
  const { carregarUsuarioFresco } = await import("@/server/_shared/sessao");
  return (await carregarUsuarioFresco(id))?.papeis ?? [];
});

export function papeisTem(papeis: Papel[], ...alvo: Papel[]): boolean {
  if (papeis.includes(Papel.ADMINISTRADOR)) return true;
  return papeis.some((p) => alvo.includes(p));
}

export async function exigirPapelLeitura(...alvo: Papel[]): Promise<Papel[] | null> {
  const papeis = await papeisDaSessao();
  return papeisTem(papeis, ...alvo) ? papeis : null;
}
