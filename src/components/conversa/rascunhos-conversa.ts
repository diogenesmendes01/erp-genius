"use client";

import { useLayoutEffect, useState } from "react";

type Revisao = { dono: object; intencao: object; aoConfirmar?: () => void };
export function criarRevisoesRascunhos() {
  const revisoes = new Map<string, Revisao>();
  let ativo = true;
  return {
    ativar() { ativo = true; },
    invalidar() { ativo = false; revisoes.clear(); },
    registrar(chave: string, dono: object, aoConfirmar: () => void) {
      revisoes.set(chave, { dono, intencao: revisoes.get(chave)?.intencao ?? {}, aoConfirmar });
      return () => { const atual = revisoes.get(chave); if (atual?.dono === dono) atual.aoConfirmar = undefined; };
    },
    alterar(chave: string, dono: object) {
      if (revisoes.get(chave)?.dono === dono) revisoes.set(chave, { ...revisoes.get(chave)!, intencao: {} });
    },
    capturar(chave: string, dono: object): object | undefined {
      const atual = revisoes.get(chave);
      return ativo && atual?.dono === dono ? atual.intencao : undefined;
    },
    confere(chave: string, intencao: object | undefined) {
      return ativo && intencao !== undefined && revisoes.get(chave)?.intencao === intencao;
    },
    confirmar(chave: string, intencao: object) {
      const atual = revisoes.get(chave);
      if (!ativo || atual?.intencao !== intencao) return;
      atual.intencao = {};
      atual.aoConfirmar?.();
    },
  };
}
export type RevisoesRascunhos = ReturnType<typeof criarRevisoesRascunhos>;

export function useRevisoesRascunhos(): RevisoesRascunhos {
  const [revisoes] = useState(criarRevisoesRascunhos);
  useLayoutEffect(() => {
    revisoes.ativar();
    return () => revisoes.invalidar();
  }, [revisoes]);
  return revisoes;
}
