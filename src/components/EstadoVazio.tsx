import type { ReactNode } from "react";

type PropsEstadoVazio = {
  children: ReactNode;
  acao?: ReactNode;
  bloco?: boolean;
  className?: string;
  role?: "status";
  "aria-busy"?: boolean;
};

const VISUAL = {
  compacto: "rounded-item bg-surface-muted px-3 py-3 text-sm text-gray-500",
  bloco: "rounded-lg border border-dashed border-gray-200 bg-surface-muted px-6 py-8 text-center text-sm text-gray-500",
};

export function EstadoVazio({ children, acao, bloco = false, className, ...atributos }: PropsEstadoVazio) {
  return (
    <div data-estado-vazio="" className={(bloco ? VISUAL.bloco : VISUAL.compacto) + (className ? ` ${className}` : "")} {...atributos}>
      <p>{children}</p>
      {acao && <div className={bloco ? "mt-3 flex flex-wrap justify-center gap-2" : "mt-2 flex flex-wrap gap-2"}>{acao}</div>}
    </div>
  );
}

export function EstadoVazioLinha({ colSpan, children, acao, ...atributos }: { colSpan: number; children: ReactNode; acao?: ReactNode; role?: "status"; "aria-busy"?: boolean }) {
  return (
    <tr>
      <td colSpan={colSpan} data-estado-vazio="" className="px-4 py-8 text-center text-sm text-gray-500">
        <div {...atributos}>
          <p>{children}</p>
          {acao && <div className="mt-3 flex flex-wrap justify-center gap-2">{acao}</div>}
        </div>
      </td>
    </tr>
  );
}
