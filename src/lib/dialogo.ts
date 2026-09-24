import { useEffect, useRef, type RefObject } from "react";

// Comportamento de diálogo acessível (docs/42-auditoria-frontend-ux.md, E7): Escape fecha, o foco
// entra no diálogo ao abrir, Tab/Shift+Tab ficam presos dentro dele e, ao fechar, o foco volta ao
// controle que o abriu. Antes, 8 de 9 overlays não faziam nada disso — quem usa teclado continuava
// tabulando pela tela de trás.

export const SELETOR_FOCAVEL = [
  "a[href]", "button:not([disabled])", "input:not([disabled]):not([type=hidden])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Próximo elemento a receber foco num Tab dentro do diálogo: do último vai ao primeiro (e, com Shift,
 * do primeiro ao último). Devolve null quando o navegador pode seguir sozinho (foco no meio da lista).
 */
export function proximoFocoPreso<T>(focaveis: T[], atual: T | null, shift: boolean): T | null {
  if (focaveis.length === 0) return null;
  const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
  const i = atual === null ? -1 : focaveis.indexOf(atual);
  if (i === -1) return shift ? ultimo : primeiro; // foco fora do diálogo: traz para dentro
  if (shift && i === 0) return ultimo;
  if (!shift && i === focaveis.length - 1) return primeiro;
  return null;
}

/**
 * Liga o comportamento de diálogo a `ref` enquanto `aberto`. `aoFechar` é chamado no Escape — a menos
 * que `bloquearFechamento` (ex.: ação em andamento) esteja ligado.
 */
export function useDialogo(ref: RefObject<HTMLElement | null>, { aberto, aoFechar, bloquearFechamento = false }: {
  aberto: boolean;
  aoFechar: () => void;
  bloquearFechamento?: boolean;
}) {
  // O callback mais recente, sem reinstalar os ouvintes a cada render do chamador.
  const fechar = useRef(aoFechar);
  const bloqueado = useRef(bloquearFechamento);
  useEffect(() => { fechar.current = aoFechar; bloqueado.current = bloquearFechamento; });

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const caixa = ref.current;
    const focaveis = () => (caixa ? [...caixa.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)].filter((el) => !el.closest("[inert]")) : []);
    // Foco inicial: o primeiro campo/botão; sem nenhum, a própria caixa (tabIndex -1 no componente).
    (focaveis()[0] ?? caixa)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!bloqueado.current) { e.stopPropagation(); fechar.current(); }
        return;
      }
      if (e.key !== "Tab") return;
      const alvo = proximoFocoPreso(focaveis(), document.activeElement as HTMLElement | null, e.shiftKey);
      if (alvo) { e.preventDefault(); alvo.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Devolve o foco a quem abriu, se ele ainda está na página.
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [aberto, ref]);
}
