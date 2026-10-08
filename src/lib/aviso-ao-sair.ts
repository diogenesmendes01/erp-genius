import { useEffect } from "react";

// Proteção de rascunho (docs/43-medicao-auditoria-ux.md §6 item 3; docs/42-auditoria-frontend-ux.md L1059 e
// L2367): F5, fechar a aba ou sair do site com um formulário longo preenchido apagava tudo em silêncio — havia
// 0 `beforeunload` no app. Enquanto houver alteração não salva (`sujo`), o navegador pergunta antes de sair;
// sem alteração, ou depois de salvar, o ouvinte nem existe (sair de uma tela intocada não pergunta nada).
//
// O ouvinte é registrado direto em `window.addEventListener` (o objeto global nunca vai como valor a outra
// função: a trava de src/app/confirmacoes.test.ts trata a janela passada adiante como possível confirmação nativa). O
// teste troca o `window` global por um falso (vi.stubGlobal).
//
// Limite: o `beforeunload` cobre recarga, fechamento e navegação para fora do app. O clique num link interno
// do Next (navegação client-side) não dispara o evento; interceptá-lo com diálogo próprio fica como pendência.

/** Pede a confirmação do navegador: `preventDefault` (padrão atual) e `returnValue` (Chrome/Edge antigos). */
export function pedirConfirmacaoDeSaida(evento: BeforeUnloadEvent) {
  evento.preventDefault();
  evento.returnValue = "";
}

/**
 * Avisa ao sair da página enquanto `sujo` for verdadeiro. A tela passa `sujo = false` depois de salvar
 * (ou quando o conteúdo volta ao que estava salvo) e o ouvinte é removido.
 */
export function useAvisoAoSair(sujo: boolean) {
  useEffect(() => {
    if (!sujo || typeof window === "undefined") return;
    window.addEventListener("beforeunload", pedirConfirmacaoDeSaida);
    return () => window.removeEventListener("beforeunload", pedirConfirmacaoDeSaida);
  }, [sujo]);
}
