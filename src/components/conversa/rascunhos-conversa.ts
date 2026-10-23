"use client";

import { useLayoutEffect, useState } from "react";

type Revisao = { dono: object; numero: number };
/** Controle local ao Inbox: não persiste metadados nem compartilha autorização entre montagens. */
export function criarRevisoesRascunhos() {
  const revisoes = new Map<string, Revisao>();
  let ativo = true;
  return {
    ativar() { ativo = true; },
    invalidar() { ativo = false; revisoes.clear(); },
    registrar(chave: string, dono: object, numero: number) { revisoes.set(chave, { dono, numero }); },
    alterar(chave: string, dono: object, numero: number) {
      if (revisoes.get(chave)?.dono === dono) revisoes.set(chave, { dono, numero });
    },
    confere(chave: string, dono: object, numero: number) {
      const atual = revisoes.get(chave);
      return ativo && atual?.dono === dono && atual.numero === numero;
    },
  };
}
export type RevisoesRascunhos = ReturnType<typeof criarRevisoesRascunhos>;

export function useRevisoesRascunhos(): RevisoesRascunhos {
  const [revisoes] = useState(criarRevisoesRascunhos);
  useLayoutEffect(() => {
    revisoes.ativar();
    // Sair do Inbox revoga callbacks antigos, inclusive se outro Inbox remontar com o mesmo texto.
    return () => revisoes.invalidar();
  }, [revisoes]);
  return revisoes;
}
