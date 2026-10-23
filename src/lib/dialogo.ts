import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

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
 * Pilha dos diálogos abertos, na ordem em que abriram: só o de cima responde ao teclado. Um
 * ConfirmarAcao aberto sobre outro diálogo (o detalhe da cobrança, por exemplo) não pode deixar o Escape
 * fechar também o de trás, nem o Tab de trás puxar o foco para fora da confirmação — os dois ouvintes
 * estão no mesmo `document`, e `stopPropagation` não impede o outro de rodar.
 */
export function criarPilhaDialogos() {
  const abertos: object[] = [];
  return {
    abrir(marca: object) { abertos.push(marca); },
    fechar(marca: object) {
      const i = abertos.lastIndexOf(marca);
      if (i >= 0) abertos.splice(i, 1);
    },
    noTopo(marca: object) { return abertos.length > 0 && abertos[abertos.length - 1] === marca; },
  };
}

const PILHA_DIALOGOS = criarPilhaDialogos();

/** O mínimo de elemento que o isolamento usa (o DOM real, ou um objeto no teste sem DOM). */
type NoIsolavel = { inert: boolean; tagName: string };
const FORA_DO_ISOLAMENTO = new Set(["SCRIPT", "STYLE", "TEMPLATE", "LINK"]);

/**
 * Deixa `inert` tudo o que está ao lado de `camada` no mesmo pai (o modal em portal no <body>: o <main>, a
 * barra lateral, outros diálogos por baixo) — fora do clique, do Tab e da árvore de acessibilidade, que é o
 * que `aria-modal` sozinho não garante (C14, #170). Só mexe em quem ainda não era inert e devolve a função que
 * desfaz exatamente isso: um modal aberto sobre outro isola o de baixo e, ao fechar, devolve-o sem soltar o
 * fundo que o de baixo isolou.
 */
export function isolarFundo(camada: { parentElement: { children: ArrayLike<unknown> } | null }): () => void {
  const pai = camada.parentElement;
  if (!pai) return () => {};
  const marcados: NoIsolavel[] = [];
  for (const irmao of Array.from(pai.children) as NoIsolavel[]) {
    if ((irmao as unknown) === camada || irmao.inert || FORA_DO_ISOLAMENTO.has(irmao.tagName)) continue;
    irmao.inert = true;
    marcados.push(irmao);
  }
  return () => { for (const el of marcados) el.inert = false; };
}

/** Só a primeira chamada desfaz: a limpeza de layout e a passiva chamam a mesma função. */
function soltarUmaVez(desfazer: () => void): () => void {
  let feito = false;
  return () => {
    if (feito) return;
    feito = true;
    desfazer();
  };
}

// No servidor não há commit nem fundo para soltar, e o React avisa sobre useLayoutEffect no HTML do servidor.
const useEfeitoDeLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Liga o comportamento de diálogo a `ref` enquanto `aberto`. `aoFechar` é chamado no Escape — a menos
 * que `bloquearFechamento` (ex.: ação em andamento) esteja ligado. `focoInicial` escolhe quem recebe o
 * foco ao abrir (a confirmação de ação irreversível abre no botão seguro); sem ele, o primeiro focável.
 * `isolar` é a camada do diálogo (o Modal em portal): enquanto aberto, o resto da página fica `inert`
 * (isolarFundo). Fica no mesmo efeito do foco de propósito: o fundo só é isolado depois de guardar quem
 * abriu e levar o foco para dentro, e é solto antes de devolver o foco — num fundo inert o `focus()` falha.
 * Soltar o fundo, porém, não pode esperar a limpeza do efeito passivo (#249 C1): quando a tela fecha o modal
 * e publica o resultado no mesmo lote (confirma → fecha → FeedbackAcao), o texto entra na região status no
 * commit, e a limpeza passiva pode ficar para outra tarefa — a região ainda estaria inert e o leitor de tela
 * não anunciaria. Por isso a limpeza de um efeito de layout solta o fundo dentro do próprio commit; a
 * limpeza passiva, que vem depois, só devolve o foco (soltar de novo não faz nada).
 */
export function useDialogo(ref: RefObject<HTMLElement | null>, { aberto, aoFechar, bloquearFechamento = false, focoInicial, focoAoFechar, isolar }: {
  aberto: boolean;
  aoFechar: () => void;
  bloquearFechamento?: boolean;
  focoInicial?: RefObject<HTMLElement | null>;
  /** Ausente retorna ao gatilho; ref explícito null suprime retorno. Lido no cleanup. */
  focoAoFechar?: RefObject<HTMLElement | null>;
  isolar?: RefObject<HTMLElement | null>;
}) {
  // O callback mais recente, sem reinstalar os ouvintes a cada render do chamador.
  const fechar = useRef(aoFechar);
  const bloqueado = useRef(bloquearFechamento);
  const inicial = useRef(focoInicial);
  const retorno = useRef(focoAoFechar);
  useEffect(() => { fechar.current = aoFechar; bloqueado.current = bloquearFechamento; inicial.current = focoInicial; retorno.current = focoAoFechar; });
  // Quem desfaz o isolamento do fundo, enquanto ele vale (soltarUmaVez: a primeira limpeza que rodar solta).
  const soltar = useRef<(() => void) | undefined>(undefined);

  // Limpeza no commit (antes de o navegador ver o DOM novo): solta o fundo antes de qualquer texto que o
  // mesmo commit publicar fora do diálogo. Na desmontagem, as limpezas de layout rodam no commit e as
  // passivas depois, então a ordem "solta → devolve o foco" se mantém.
  useEfeitoDeLayout(() => {
    if (!aberto) return;
    return () => { soltar.current?.(); };
  }, [aberto, isolar]);

  useEffect(() => {
    if (!aberto) return;
    const marca = {};
    PILHA_DIALOGOS.abrir(marca);
    const anterior = document.activeElement as HTMLElement | null;
    const caixa = ref.current;
    const focaveis = () => (caixa ? [...caixa.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)].filter((el) => !el.closest("[inert]")) : []);
    // Foco inicial: o escolhido pelo diálogo; senão o primeiro campo/botão; sem nenhum, a própria caixa
    // (tabIndex -1 no componente).
    (inicial.current?.current ?? focaveis()[0] ?? caixa)?.focus();
    const soltarFundo = isolar?.current ? soltarUmaVez(isolarFundo(isolar.current)) : undefined;
    soltar.current = soltarFundo;

    function onKey(e: KeyboardEvent) {
      // Diálogo por baixo de outro: quem responde é o de cima.
      if (!PILHA_DIALOGOS.noTopo(marca)) return;
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
      PILHA_DIALOGOS.fechar(marca);
      document.removeEventListener("keydown", onKey);
      soltarFundo?.(); // normalmente já solto pela limpeza de layout, no commit
      if (soltar.current === soltarFundo) soltar.current = undefined;
      // Devolve o foco a quem abriu, se ele ainda está na página.
      const destino = retorno.current === undefined ? anterior : retorno.current.current;
      if (destino && document.contains(destino)) destino.focus();
    };
  }, [aberto, ref, isolar]);
}
