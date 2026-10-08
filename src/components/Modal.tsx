"use client";

import { useId, useRef, type RefObject } from "react";
import { useDialogo } from "@/lib/dialogo";

// Casco único de modal centralizado (E7): role="dialog" + aria-modal + título ligado por
// aria-labelledby, Escape e clique no fundo fecham, foco preso e devolvido (useDialogo), e altura
// limitada à tela com rolagem interna — com o teclado do celular aberto, o botão final continua
// alcançável. Durante uma ação (`bloquearFechamento`), Escape e o fundo não fecham: o resultado
// precisa aparecer dentro do modal.
// A confirmação de ação irreversível (ConfirmarAcao) usa o mesmo casco como `alertdialog`, descrito
// pelo texto da consequência (aria-describedby) e com o foco inicial no botão seguro.
export function Modal({ titulo, aoFechar, bloquearFechamento = false, largura = "max-w-md", papel = "dialog", descricaoId, focoInicial, children }: {
  titulo: React.ReactNode;
  aoFechar: () => void;
  bloquearFechamento?: boolean;
  /** Classe de largura máxima do cartão. */
  largura?: string;
  /** "alertdialog": pede uma decisão sobre algo que não se desfaz (o leitor de tela anuncia título e descrição). */
  papel?: "dialog" | "alertdialog";
  /** id do elemento que descreve o diálogo (aria-describedby). */
  descricaoId?: string;
  /** Quem recebe o foco ao abrir; sem ele, o primeiro campo/botão. */
  focoInicial?: RefObject<HTMLElement | null>;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  useDialogo(ref, { aberto: true, aoFechar, bloquearFechamento, focoInicial });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => { if (!bloquearFechamento) aoFechar(); }}>
      <div
        ref={ref}
        role={papel === "alertdialog" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricaoId}
        tabIndex={-1}
        className={`max-h-[90dvh] w-full overflow-y-auto rounded-lg bg-surface p-5 ${largura}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={tituloId} className="mb-3 text-sm font-medium">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}
