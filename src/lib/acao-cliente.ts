import { useCallback, useState } from "react";
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

/** Mensagem de sucesso: texto fixo ou derivado do dado. Só texto — efeitos (fechar modal, refresh) vão depois do await. */
export type MensagemSucesso<T> = string | ((dado: T | undefined) => string | null);

export async function executarAcaoCliente<T>(acao: () => Promise<Resultado<T>>, { idempotente }: OpcoesAcao): Promise<DesfechoAcao<T>> {
  try {
    const r = await acao();
    return r.ok ? { tipo: "ok", dado: r.dado } : { tipo: "erro", mensagem: r.erro };
  } catch {
    return { tipo: "incerto", mensagem: idempotente ? MSG_RESULTADO_INCERTO : MSG_RESULTADO_INCERTO_SEM_CHAVE };
  }
}

type Estado = {
  setOcupado: (v: boolean) => void;
  setErro: (v: string | null) => void;
  setSucesso: (v: string | null) => void;
};

/**
 * O executor sem React, para ser testado sem renderizador: trava de duplo clique, ocupado liberado
 * em qualquer desfecho (inclusive se a mensagem de sucesso lançar), erro e sucesso gravados.
 * Devolve o desfecho — ou null quando o clique foi ignorado por já haver uma execução em curso.
 */
export function criarExecutor({ setOcupado, setErro, setSucesso }: Estado, opcoes: OpcoesAcao) {
  // Trava de duplo clique no fechamento do executor: vale no mesmo instante, antes do re-render que
  // desabilita o botão (o estado `ocupado` só chega na próxima renderização).
  let emCurso = false;
  return async function executar<T>(acao: () => Promise<Resultado<T>>, sucesso?: MensagemSucesso<T>): Promise<DesfechoAcao<T> | null> {
    if (emCurso) return null;
    emCurso = true;
    setOcupado(true);
    setErro(null);
    setSucesso(null);
    try {
      const desfecho = await executarAcaoCliente(acao, opcoes);
      if (desfecho.tipo === "ok") setSucesso(typeof sucesso === "function" ? sucesso(desfecho.dado) : sucesso ?? null);
      else setErro(desfecho.mensagem);
      return desfecho;
    } finally {
      emCurso = false;
      setOcupado(false);
    }
  };
}

/**
 * Estado de uma ação de tela: ocupado, erro e sucesso. Par natural do <FeedbackAcao>.
 * Uso: `const d = await acao.executar(() => action(...), "Salvo."); if (d?.tipo === "ok") onDone();`
 * — efeitos que desmontam o componente (fechar modal, navegar) rodam depois que o ocupado já foi liberado.
 */
export function useAcaoCliente(opcoes: OpcoesAcao) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  // Um executor por componente, pela vida toda dele (useState, não useMemo: o React pode descartar
  // um memo e, com ele, a trava). `idempotente` é lido na montagem — é uma propriedade da action.
  const [executar] = useState(() => criarExecutor({ setOcupado, setErro, setSucesso }, opcoes));
  const limpar = useCallback(() => { setErro(null); setSucesso(null); }, []);
  return { ocupado, erro, sucesso, executar, setErro, limpar };
}
