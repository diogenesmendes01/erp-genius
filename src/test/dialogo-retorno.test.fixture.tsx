import { useLayoutEffect, useRef, type MutableRefObject } from "react";
import { useDialogo } from "@/lib/dialogo";
/** Só montagem de teste; a suíte mantém o hook e o React DOM reais. */
export function TelaRetorno({ aberto, explicito = false, isolar = false, versao = 0, focoAoFecharRef }: {
 aberto: boolean; explicito?: boolean; isolar?: boolean; versao?: number; focoAoFecharRef: MutableRefObject<HTMLElement | null>;
}) {
 const caixa = useRef<HTMLDivElement>(null);
 useDialogo(caixa, { aberto, aoFechar() {}, focoAoFechar: explicito ? focoAoFecharRef : undefined, isolar: isolar ? caixa : undefined });
 return <div><button aria-label="Gatilho">Abrir</button><input aria-label="Busca" />{aberto && <div ref={caixa} role="dialog"><button aria-label="Dentro">Dentro</button></div>}<span>{versao}</span></div>;
}
export function NavegacaoRetorno({ aberto, focoAoFecharRef }: { aberto: boolean; focoAoFecharRef: MutableRefObject<HTMLElement | null> }) {
 const caixa = useRef<HTMLDivElement>(null); const conversa = useRef<HTMLElement>(null);
 useDialogo(caixa, { aberto, aoFechar() {}, focoAoFechar: focoAoFecharRef });
 useLayoutEffect(() => { if (!aberto) focoAoFecharRef.current = conversa.current; }, [aberto, focoAoFecharRef]);
 return <div><button aria-label="Gatilho">Abrir</button><section ref={conversa} tabIndex={-1} aria-label="Conversa" />{aberto && <div ref={caixa} role="dialog"><button>Dentro</button></div>}</div>;
}
