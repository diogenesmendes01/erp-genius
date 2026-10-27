import { IconPointFilled } from "@tabler/icons-react";

export const TEXTO_ALTERACAO_PENDENTE = "Alterações não salvas";

export function AlteracaoPendente({ sujo, className = "" }: { sujo: boolean; className?: string }) {
  return (
    <p role="status" className={`inline-flex items-center gap-1 text-xs text-amber-700 empty:hidden ${className}`.trim()}>
      {sujo && <><IconPointFilled aria-hidden="true" className="h-3 w-3" />{TEXTO_ALTERACAO_PENDENTE}</>}
    </p>
  );
}
