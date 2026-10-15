// Posição de um painel flutuante (menu, popover) e navegação por teclado do menu.
// Funções puras: o componente só liga eventos e mede o DOM.

export type DOMRectLike = { top: number; bottom: number; left: number; right: number };

export function posicaoPopover(i: {
  ancora: DOMRectLike;
  painel: { largura: number; altura: number };
  viewport: { largura: number; altura: number };
  margem?: number;
  distancia?: number;
}): { topo: number; esquerda: number; lado: "abaixo" | "acima" } {
  const margem = i.margem ?? 8;
  const distancia = i.distancia ?? 6;
  const { ancora, painel, viewport } = i;

  const espacoAbaixo = viewport.altura - margem - (ancora.bottom + distancia);
  const espacoAcima = ancora.top - distancia - margem;
  const lado: "abaixo" | "acima" = espacoAbaixo >= painel.altura || espacoAbaixo >= espacoAcima ? "abaixo" : "acima";

  const topoBruto = lado === "abaixo" ? ancora.bottom + distancia : ancora.top - distancia - painel.altura;
  const topoMax = Math.max(margem, viewport.altura - margem - painel.altura);
  const topo = Math.min(Math.max(topoBruto, margem), topoMax);

  const esquerdaMax = Math.max(margem, viewport.largura - margem - painel.largura);
  const esquerda = Math.min(Math.max(ancora.left, margem), esquerdaMax);

  return { topo, esquerda, lado };
}

export function proximoIndiceMenu(atual: number, tecla: "ArrowDown" | "ArrowUp" | "Home" | "End", total: number): number {
  if (total <= 0) return -1;
  if (tecla === "Home") return 0;
  if (tecla === "End") return total - 1;
  if (tecla === "ArrowDown") return (atual + 1) % total;
  return (atual - 1 + total) % total;
}
