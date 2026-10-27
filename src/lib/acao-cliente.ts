import { useCallback, useState } from "react";
import type { Resultado } from "@/server/_shared/resultado";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";

export type DesfechoAcao<T> =
  | { tipo: "ok"; dado?: T }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "incerto"; mensagem: string };

export type OpcoesAcao = {
  idempotente: boolean;
};

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

export function criarExecutor({ setOcupado, setErro, setSucesso }: Estado, opcoes: OpcoesAcao) {
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

export function useAcaoCliente(opcoes: OpcoesAcao) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [executar] = useState(() => criarExecutor({ setOcupado, setErro, setSucesso }, opcoes));
  const limpar = useCallback(() => { setErro(null); setSucesso(null); }, []);
  return { ocupado, erro, sucesso, executar, setErro, setSucesso, limpar };
}
