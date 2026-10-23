import type { ReactNode } from "react";

export function EventoSistema({ tom, icone, texto, hora, riscado = false }: { tom: "ia" | "neutro"; icone: ReactNode; texto: string; hora?: string | null; riscado?: boolean }) {
  return <div className="flex justify-center">
    <div className={`my-1 flex max-w-[80%] items-center gap-[7px] rounded-[20px] py-[5px] pl-[11px] pr-1.5 text-xs ${tom === "ia" ? "bg-ai-50 text-ai-700" : "bg-surface text-gray-600"}`}>
      <span aria-hidden>{icone}</span><span className={riscado ? "line-through" : undefined}>{texto}</span>
      {hora && <span className="mr-1 font-mono text-[11px] opacity-70">{hora}</span>}
    </div>
  </div>;
}
