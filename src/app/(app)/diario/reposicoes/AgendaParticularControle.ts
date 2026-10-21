export function criarControleAgendaParticular(criarChave: () => string) {
  let revisao = 0, chave: string | null = null, payloadDaChave: string | null = null;
  return {
    alterar() { revisao += 1; chave = null; payloadDaChave = null; },
    iniciarPrevia() { return revisao; },
    previaAindaAtual(revisaoSolicitada: number) { return revisaoSolicitada === revisao; },
    chavePara(payload: string) {
      if (payloadDaChave !== payload) { payloadDaChave = payload; chave = criarChave(); }
      return chave!;
    },
  };
}
