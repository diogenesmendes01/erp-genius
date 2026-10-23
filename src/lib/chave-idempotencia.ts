import { useState } from "react";
import type { DesfechoAcao } from "@/lib/acao-cliente";

// Chave de idempotência da tela (#166), no mesmo contrato de `AcertoContratualFormularios`: a mesma chave
// enquanto a tentativa não foi confirmada (resultado incerto, erro do servidor, duplo clique) e chave nova
// só depois do sucesso, quando a próxima criação já é outra tentativa. O servidor devolve o registro
// existente quando a chave se repete com a mesma entrada.

export type ChaveTentativa = {
  readonly atual: string;
  /** Chame com o desfecho de `acao.executar`: só o sucesso abre nova tentativa. */
  depoisDo(desfecho: DesfechoAcao<unknown> | null | undefined): void;
};

export function criarChaveTentativa(gerar: () => string = () => crypto.randomUUID()): ChaveTentativa {
  let chave = gerar();
  return {
    get atual() { return chave; },
    depoisDo(desfecho) { if (desfecho?.tipo === "ok") chave = gerar(); },
  };
}

/** Uma tentativa por componente, pela vida toda dele (useState, como o executor de `useAcaoCliente`). */
export function useChaveIdempotencia(): ChaveTentativa {
  const [tentativa] = useState(() => criarChaveTentativa());
  return tentativa;
}

/**
 * Uma tentativa por alvo (matrícula, destino…), para telas com vários alvos (C3 da R1 do #291): o resultado incerto
 * de um alvo não prende a chave do outro, e voltar ao mesmo alvo reaproveita a tentativa ainda não confirmada.
 */
export type ChavesPorAlvo = { para(alvo: string): ChaveTentativa };

export function criarChavesPorAlvo(gerar: () => string = () => crypto.randomUUID()): ChavesPorAlvo {
  const tentativas = new Map<string, ChaveTentativa>();
  return {
    para(alvo) {
      let t = tentativas.get(alvo);
      if (!t) { t = criarChaveTentativa(gerar); tentativas.set(alvo, t); }
      return t;
    },
  };
}

export function useChavesPorAlvo(): ChavesPorAlvo {
  const [chaves] = useState(() => criarChavesPorAlvo());
  return chaves;
}
