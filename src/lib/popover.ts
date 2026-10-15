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
  // Foco fora dos itens (gatilho ou padding do painel): seta para baixo vai ao primeiro, para cima ao último.
  if (atual < 0) return tecla === "ArrowUp" ? total - 1 : 0;
  if (tecla === "ArrowDown") return (atual + 1) % total;
  return (atual - 1 + total) % total;
}

export type AcaoTecladoMenu =
  | { tipo: "fechar"; devolverFoco: boolean }
  | { tipo: "focar"; indice: number }
  | { tipo: "nenhuma" };

// Decisão de teclado do menu (pura): Escape fecha e devolve o foco ao gatilho; Tab fecha sem devolver;
// setas/Home/End movem o foco entre os itens habilitados (atual = índice focado, -1 se nenhum).
export function acaoTecladoMenu(tecla: string, atual: number, total: number): AcaoTecladoMenu {
  if (tecla === "Escape") return { tipo: "fechar", devolverFoco: true };
  if (tecla === "Tab") return { tipo: "fechar", devolverFoco: false };
  if (tecla === "ArrowDown" || tecla === "ArrowUp" || tecla === "Home" || tecla === "End") {
    const indice = proximoIndiceMenu(atual, tecla, total);
    return indice < 0 ? { tipo: "nenhuma" } : { tipo: "focar", indice };
  }
  return { tipo: "nenhuma" };
}
