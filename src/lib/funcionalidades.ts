// Funcionalidades desligadas por decisão do dono, sem apagar código nem dados. Cada chave é lida pela tela (que
// esconde a ação) e pela ação do servidor (que recusa com a mensagem ao lado). Para religar, troque a chave para
// `true`: o fluxo antigo volta como estava, com os testes que o cobrem (que já a religam).

/**
 * Cobrança de empresas (fatura B2B: fechar, pagar e cancelar; docs/42 L2282). Desligada pela decisão D9 do dono
 * (19/10/2026): a escola não usa. As faturas já registradas continuam na ficha da empresa, só para consulta, e a
 * empresa continua podendo ser responsável financeira de contratos individuais.
 */
export const COBRANCA_B2B_ATIVA: boolean = false;

export const MSG_COBRANCA_B2B_DESLIGADA =
  "A cobrança de empresas (fatura B2B) está desligada nesta escola. As faturas já registradas continuam aqui só para consulta.";
