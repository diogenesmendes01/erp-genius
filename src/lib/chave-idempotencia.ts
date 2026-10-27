import { useState } from "react";
import type { DesfechoAcao } from "@/lib/acao-cliente";

export type ChaveTentativa = {
  readonly atual: string;
  depoisDo(desfecho: DesfechoAcao<unknown> | null | undefined): void;
};

export function criarChaveTentativa(gerar: () => string = () => crypto.randomUUID()): ChaveTentativa {
  let chave = gerar();
  return {
    get atual() { return chave; },
    depoisDo(desfecho) { if (desfecho?.tipo === "ok") chave = gerar(); },
  };
}

export function useChaveIdempotencia(): ChaveTentativa {
  const [tentativa] = useState(() => criarChaveTentativa());
  return tentativa;
}

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
