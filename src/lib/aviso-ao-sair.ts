import { useEffect } from "react";

// Proteção de rascunho (docs/43-medicao-auditoria-ux.md §6 item 3; docs/42-auditoria-frontend-ux.md L1059 e
// L2367): F5, fechar a aba ou sair do site com um formulário longo preenchido apagava tudo em silêncio — havia
// 0 `beforeunload` no app. Enquanto houver alteração não salva (`sujo`), o navegador pergunta antes de sair;
// sem alteração, ou depois de salvar, o ouvinte nem existe (sair de uma tela intocada não pergunta nada).
//
// Limite: o `beforeunload` cobre recarga, fechamento e navegação para fora do app. O clique num link interno
// do Next (navegação client-side) não dispara o evento; interceptá-lo com diálogo próprio depende do
// ConfirmarAcao (docs/43 §6 item 1) e fica como pendência.

/** O mínimo de `window` que o aviso usa (o teste passa um objeto falso). */
export type AlvoDoAviso = {
  addEventListener(tipo: "beforeunload", ouvinte: (evento: BeforeUnloadEvent) => void): void;
  removeEventListener(tipo: "beforeunload", ouvinte: (evento: BeforeUnloadEvent) => void): void;
};

/** Pede a confirmação do navegador: `preventDefault` (padrão atual) e `returnValue` (Chrome/Edge antigos). */
export function pedirConfirmacaoDeSaida(evento: BeforeUnloadEvent) {
  evento.preventDefault();
  evento.returnValue = "";
}

/**
 * Liga o aviso em `alvo` quando `sujo`; devolve o desligamento (o mesmo ouvinte sai). Sem alteração, não
 * registra nada e devolve uma função vazia.
 */
export function ligarAvisoAoSair(alvo: AlvoDoAviso, sujo: boolean): () => void {
  if (!sujo) return () => {};
  alvo.addEventListener("beforeunload", pedirConfirmacaoDeSaida);
  return () => alvo.removeEventListener("beforeunload", pedirConfirmacaoDeSaida);
}

/**
 * Avisa ao sair da página enquanto `sujo` for verdadeiro. A tela passa `sujo = false` depois de salvar
 * (ou quando o conteúdo volta ao que estava salvo) e o ouvinte é removido.
 */
export function useAvisoAoSair(sujo: boolean) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    return ligarAvisoAoSair(window, sujo);
  }, [sujo]);
}
