import { forwardRef, type ReactNode } from "react";

// Aviso do design system (Fase 0, Task 9): uma caixa só para info, sucesso, atenção e erro. Cor e borda
// inicial de 3 px vêm do tom (as shades já invertem no escuro pelos tokens); o papel acessível também:
// erro anuncia como alert, os demais como status. `papel="nenhum"` é para quem já tem a região anunciante
// em outro lugar (MensagemStatus mantém a sr-only e esconde a caixa visível com aria-hidden).

export type TomAviso = "info" | "sucesso" | "atencao" | "erro";

export const BASE_AVISO = "rounded-md p-3 text-sm";
export const TONS_AVISO: Record<TomAviso, string> = {
  info: "bg-surface-muted",
  sucesso: "bg-green-100 text-green-700 border-s-[3px] border-green-700",
  atencao: "bg-amber-100 text-amber-800 border-s-[3px] border-amber-600",
  erro: "bg-red-100 text-red-700 border-s-[3px] border-red-600",
};

type Props = {
  tom: TomAviso;
  titulo?: string;
  children: ReactNode;
  acao?: ReactNode;
  /** Só posição (margem). */
  className?: string;
  /** Padrão: alert no erro, status nos demais. */
  papel?: "nenhum";
  tabIndex?: number;
  "aria-hidden"?: true;
};

export const Aviso = forwardRef<HTMLDivElement, Props>(function Aviso(
  { tom, titulo, children, acao, className, papel, tabIndex, "aria-hidden": ariaHidden },
  ref,
) {
  const role = papel === "nenhum" ? undefined : tom === "erro" ? "alert" : "status";
  return (
    <div ref={ref} role={role} tabIndex={tabIndex} aria-hidden={ariaHidden} className={`${BASE_AVISO} ${TONS_AVISO[tom]}${className ? ` ${className}` : ""}`}>
      {titulo && <p className="font-medium">{titulo}</p>}
      <div>{children}</div>
      {acao && <div className="mt-2 flex flex-wrap gap-2">{acao}</div>}
    </div>
  );
});
