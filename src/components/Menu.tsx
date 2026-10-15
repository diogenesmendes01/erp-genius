"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { acaoTecladoMenu, posicaoPopover } from "@/lib/popover";

export const CLASSE_PAINEL_MENU = "min-w-[220px] rounded-[9px] border border-gray-200 bg-surface-raised py-2 shadow-popover";
export const CLASSE_ITEM_MENU =
  "flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-highlight focus-visible:bg-highlight disabled:cursor-not-allowed disabled:text-disabled";

type Alvo = {
  addEventListener(tipo: string, f: (e: Event) => void, captura?: boolean): void;
  removeEventListener(tipo: string, f: (e: Event) => void, captura?: boolean): void;
};

/**
 * Ouvintes do menu aberto; devolve a limpeza. Exportada para o teste ligar o menu com `document` falso.
 * - Teclado em document, na fase de CAPTURA: roda antes do ouvinte do diálogo (useDialogo, fase de bolha).
 *   No Escape, o menu fecha e chama stopPropagation, então um Modal/Drawer/ConfirmarAcao em volta não
 *   fecha junto. O Tab fecha o menu e segue para o diálogo, que mantém o foco preso.
 * - Scroll (captura, pega rolagem de qualquer lista) e resize fecham o menu: o painel é position:fixed e
 *   ficaria solto sobre outra linha, com ações (até de perigo) parecendo de outro item.
 */
export function ligarMenuAberto(o: {
  doc: Alvo & { activeElement: Element | null };
  /** Padrão: a janela global (o teste passa uma falsa). */
  win?: Alvo;
  painel: () => { contains(n: Node | null): boolean } | null;
  gatilho: () => { contains(n: Node | null): boolean } | null;
  habilitados: () => { focus(): void }[];
  fechar: (devolverFoco: boolean) => void;
}): () => void {
  // Só os dois métodos da janela (a trava de confirmacoes.test.ts não aceita `window` passado como valor).
  const win: Alvo = o.win ?? {
    addEventListener: (t, f, c) => window.addEventListener(t, f, c),
    removeEventListener: (t, f, c) => window.removeEventListener(t, f, c),
  };
  const fora = (e: Event) => {
    const alvo = e.target as Node;
    if (!o.painel()?.contains(alvo) && !o.gatilho()?.contains(alvo)) o.fechar(false);
  };
  const tecla = (ev: Event) => {
    const e = ev as KeyboardEvent;
    const lista = o.habilitados();
    const acao = acaoTecladoMenu(e.key, lista.indexOf(o.doc.activeElement as unknown as { focus(): void }), lista.length);
    if (acao.tipo === "fechar") {
      if (acao.devolverFoco) {
        e.preventDefault();
        e.stopPropagation();
      }
      o.fechar(acao.devolverFoco);
    } else if (acao.tipo === "focar") {
      e.preventDefault();
      lista[acao.indice]?.focus();
    }
  };
  const rolou = (e: Event) => {
    const alvo = e.target as Node | null;
    if (alvo && o.painel()?.contains(alvo)) return;
    o.fechar(false);
  };
  const redimensionou = () => o.fechar(false);
  o.doc.addEventListener("mousedown", fora);
  o.doc.addEventListener("keydown", tecla, true);
  win.addEventListener("scroll", rolou, true);
  win.addEventListener("resize", redimensionou);
  return () => {
    o.doc.removeEventListener("mousedown", fora);
    o.doc.removeEventListener("keydown", tecla, true);
    win.removeEventListener("scroll", rolou, true);
    win.removeEventListener("resize", redimensionou);
  };
}

type ItemMenu = { rotulo: string; icone?: ReactNode; perigo?: boolean; desabilitado?: boolean; aoEscolher: () => void };

// Menu de ações. Posição e teclado vêm de funções puras (@/lib/popover); aqui só se ligam eventos.
export function Menu({ rotulo, gatilho, itens }: { rotulo: string; gatilho: ReactNode; itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ topo: number; esquerda: number } | null>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false);
    setPos(null);
    if (devolverFoco) gatilhoRef.current?.focus();
  }, []);

  const habilitados = () => Array.from(painelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  useLayoutEffect(() => {
    if (!aberto || !gatilhoRef.current || !painelRef.current) return;
    const a = gatilhoRef.current.getBoundingClientRect();
    const p = painelRef.current.getBoundingClientRect();
    const { topo, esquerda } = posicaoPopover({
      ancora: a,
      painel: { largura: p.width, altura: p.height },
      viewport: { largura: window.innerWidth, altura: window.innerHeight },
    });
    setPos({ topo, esquerda });
  }, [aberto]);

  // Foco no primeiro item só depois de pos definido: com visibility:hidden o elemento não recebe foco.
  useEffect(() => {
    // preventScroll: o foco não pode rolar a página, senão o ouvinte de scroll fecharia o menu recém-aberto.
    if (aberto && pos) habilitados()[0]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, pos !== null]);

  useEffect(() => {
    if (!aberto) return;
    return ligarMenuAberto({
      doc: document,
      painel: () => painelRef.current,
      gatilho: () => gatilhoRef.current,
      habilitados,
      fechar,
    });
  }, [aberto, fechar]);

  return (
    <>
      <button
        ref={gatilhoRef}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
        className="inline-flex items-center justify-center rounded-md max-sm:min-h-11 max-sm:min-w-11 hover:bg-highlight"
      >
        {gatilho}
      </button>
      {aberto && (
        <div
          ref={painelRef}
          id={id}
          role="menu"
          aria-label={rotulo}
          style={{ position: "fixed", top: pos?.topo ?? 0, left: pos?.esquerda ?? 0, visibility: pos ? "visible" : "hidden", zIndex: 50 }}
          className={CLASSE_PAINEL_MENU}
        >
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              disabled={item.desabilitado}
              onClick={() => {
                fechar(true);
                item.aoEscolher();
              }}
              className={`${CLASSE_ITEM_MENU} ${item.perigo ? "text-red-700" : "text-gray-800"}`}
            >
              {item.icone}
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
