import { useCallback, useRef, useState } from "react";
import type { Resultado } from "@/server/_shared/resultado";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";

// Padrão único de execução de server action no cliente (docs/42-auditoria-frontend-ux.md, E3).
// A action já transforma erro de negócio em `{ ok: false, erro }` (executarAcao no servidor); o que
// sobra é falha de TRANSPORTE — rede, redeploy, timeout — em que o resultado é desconhecido. Sem
// `catch`, o botão fica travado em "Salvando…" para sempre; com `catch` mal redigido, o operador
// altera os dados e reenvia, quebrando a idempotência. Aqui os dois casos têm resposta fixa.

export type DesfechoAcao<T> =
  | { tipo: "ok"; dado?: T }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "incerto"; mensagem: string };

export type OpcoesAcao = {
  /**
   * A action recebe chave de idempotência estável (a mesma entre tentativas) e o servidor devolve o
   * registro existente quando ela se repete? Só então a mensagem de falha manda reenviar.
   * Obrigatório de propósito: cada tela declara, em vez de herdar um padrão otimista.
   */
  idempotente: boolean;
};

export async function executarAcaoCliente<T>(acao: () => Promise<Resultado<T>>, { idempotente }: OpcoesAcao): Promise<DesfechoAcao<T>> {
  try {
    const r = await acao();
    return r.ok ? { tipo: "ok", dado: r.dado } : { tipo: "erro", mensagem: r.erro };
  } catch {
    return { tipo: "incerto", mensagem: idempotente ? MSG_RESULTADO_INCERTO : MSG_RESULTADO_INCERTO_SEM_CHAVE };
  }
}

/**
 * Estado de uma ação de tela: ocupado, erro e sucesso, com trava contra duplo clique (a ref vale
 * antes do re-render que desabilita o botão). Par natural do <FeedbackAcao>.
 */
export function useAcaoCliente(opcoes: OpcoesAcao) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const emCurso = useRef(false);
  const { idempotente } = opcoes;

  const executar = useCallback(
    async <T,>(acao: () => Promise<Resultado<T>>, aoConcluir?: (dado: T | undefined) => string | null | void): Promise<DesfechoAcao<T> | null> => {
      if (emCurso.current) return null;
      emCurso.current = true;
      setOcupado(true);
      setErro(null);
      setSucesso(null);
      try {
        const desfecho = await executarAcaoCliente(acao, { idempotente });
        if (desfecho.tipo === "ok") setSucesso(aoConcluir?.(desfecho.dado) ?? null);
        else setErro(desfecho.mensagem);
        return desfecho;
      } finally {
        emCurso.current = false;
        setOcupado(false);
      }
    },
    [idempotente],
  );

  const limpar = useCallback(() => { setErro(null); setSucesso(null); }, []);

  return { ocupado, erro, sucesso, executar, setErro, limpar };
}
