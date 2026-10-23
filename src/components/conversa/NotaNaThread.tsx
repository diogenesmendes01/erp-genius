import { IconLock } from "@tabler/icons-react";
import type { NotaInternaThread } from "@/server/whatsapp/consultas-inbox";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

export function NotaNaThread({ n, fuso }: { n: NotaInternaThread; fuso: string | null }) {
  const rotulo = n.origem === "oportunidade" ? "Nota da oportunidade · só equipe" : "Nota interna · só equipe";
  return <div role="note" data-nota-id={n.id} className="flex justify-end">
    <div className="max-w-[80%] rounded-lg border border-dashed border-amber-700 bg-amber-50 px-3 py-2 text-sm">
      <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-700"><IconLock size={12} aria-hidden />{rotulo}</span>
      <span className="mb-1 block text-xs text-gray-600">{n.autorNome ?? "Autor não informado"}</span>
      <p className="whitespace-pre-wrap break-words">{n.nota}</p>
      <time dateTime={n.criadoEm} className="mt-1 block text-right text-xs text-gray-600">{formatarInstanteExibicao(n.criadoEm, fuso, "UTC", "hora").texto}</time>
    </div>
  </div>;
}
