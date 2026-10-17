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
export function Modal({ titulo, aoFechar, bloquearFechamento = false, larga = false, telaCheiaNoCelular = false, papel = "dialog", descricaoId, focoInicial, children }: {
  titulo: React.ReactNode;
  aoFechar: () => void;
  bloquearFechamento?: boolean;
  /** Variante larga (640 px a partir de `sm`); o padrão é 460 px. Em tela estreita ocupa a largura menos 24 px. */
  larga?: boolean;
  /** Em tela estreita (abaixo de `sm`) ocupa a tela inteira, sem margem nem cantos; de `sm` em diante é o modal centralizado. */
  telaCheiaNoCelular?: boolean;
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
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 ${telaCheiaNoCelular ? "p-0 sm:p-4" : "p-4"}`} onClick={() => { if (!bloquearFechamento) aoFechar(); }}>
      <div
        ref={ref}
        role={papel === "alertdialog" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricaoId}
        tabIndex={-1}
        className={`overflow-y-auto border border-gray-200 bg-surface-raised p-6 shadow-dialog ${telaCheiaNoCelular
          ? "h-dvh w-full max-w-none rounded-none sm:h-auto sm:max-h-[90dvh] sm:max-w-[calc(100vw-24px)] sm:rounded-dialog"
          : "max-h-[90dvh] w-full max-w-[calc(100vw-24px)] rounded-dialog"} ${larga ? "sm:w-[640px]" : "sm:w-[460px]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={tituloId} className="mb-3 text-xl font-medium">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}
