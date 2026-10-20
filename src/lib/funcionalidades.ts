// Funcionalidades desligadas por decisão do dono, sem apagar código nem dados. Cada chave é lida pela tela (que
// esconde a ação) e pela ação do servidor (que recusa com a mensagem ao lado). Para religar, troque a chave para
// `true`: o fluxo antigo volta como estava, com os testes que o cobrem (que já a religam).

/**
 * Cobrança de empresas (fatura B2B; docs/42 L2282). Desligada pela decisão D9 do dono (19/10/2026): a escola não
 * usa. Com a chave desligada, não se fecha nem se paga fatura. CANCELAR continua disponível (R1 do #251, B1): só
 * desfaz o agrupamento, e é o caminho que pausar/cancelar aluno, ajustar cobrança e dar baixa pedem para uma fatura
 * FECHADA que já exista. A empresa continua podendo ser responsável financeira de contratos individuais.
 */
export const COBRANCA_B2B_ATIVA: boolean = false;

export const MSG_COBRANCA_B2B_DESLIGADA =
  "A cobrança de empresas (fatura B2B) está desligada nesta escola: não se fecha nem se paga fatura. Uma fatura já fechada ainda pode ser cancelada, o que só desfaz o agrupamento e solta as cobranças.";
