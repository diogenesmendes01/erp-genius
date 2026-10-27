import { forwardRef, type ReactNode } from "react";

export type TomAviso = "info" | "sucesso" | "atencao" | "erro";

export const BASE_AVISO = "rounded-md p-3 text-sm";
export const TONS_AVISO: Record<TomAviso, string> = {
  info: "bg-blue-100 text-blue-700 border-s-[3px] border-blue-700",
  sucesso: "bg-green-100 text-green-700 border-s-[3px] border-green-700",
  atencao: "bg-amber-100 text-amber-800 border-s-[3px] border-amber-600",
  erro: "bg-red-100 text-red-700 border-s-[3px] border-red-600",
};

type Props = {
  tom: TomAviso;
  titulo?: string;
  children: ReactNode;
  acao?: ReactNode;
  className?: string;
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
