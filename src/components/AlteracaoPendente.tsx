import { IconPointFilled } from "@tabler/icons-react";

// Marca de alteração pendente num painel com "Salvar" próprio (C32 da #170; docs/42 L2519): diz qual bloco
// tem mudança ainda não gravada. A região `role="status"` fica sempre montada (o leitor de tela só anuncia
// mudança numa região que já existe); vazia, não ocupa espaço. O aviso ao sair é do useAvisoAoSair.
export const TEXTO_ALTERACAO_PENDENTE = "Alterações não salvas";

export function AlteracaoPendente({ sujo, className = "" }: { sujo: boolean; className?: string }) {
  return (
    <p role="status" className={`inline-flex items-center gap-1 text-xs text-amber-700 empty:hidden ${className}`.trim()}>
      {sujo && <><IconPointFilled aria-hidden="true" className="h-3 w-3" />{TEXTO_ALTERACAO_PENDENTE}</>}
    </p>
  );
}
