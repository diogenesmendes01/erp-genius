// Falha de transporte com resultado desconhecido. Nunca sugerir "confira os dados": dado alterado vira outra tentativa.
// Use só onde o servidor devolve o registro existente quando a entrada é repetida idêntica.

export const MSG_RESULTADO_INCERTO = "Resultado não confirmado. Reenvie sem alterar os dados para conferir a mesma operação.";

export const MSG_DECISAO_INCERTA = "Resultado não confirmado. Reenvie a mesma decisão para conferir.";

// Mesmo evento, mas a ação NÃO tem chave de idempotência: reenviar pode aplicar duas vezes.
// Por isso a instrução é conferir antes de repetir — nunca "reenvie".
export const MSG_RESULTADO_INCERTO_SEM_CHAVE = "Resultado não confirmado. Recarregue a página e veja se a operação já aparece antes de repetir.";

// Portal do aluno (docs/43 §6 item 8). A ativação consome o link: repetir depois de um sucesso que não chegou dá
// "link indisponível". Por isso a instrução é tentar entrar com a senha nova antes de repetir.
export const MSG_ATIVACAO_INCERTA = "Resultado não confirmado: não sabemos se a senha foi definida. Antes de repetir, tente entrar com a senha nova.";

// O pedido de recuperação não revela se a conta existe e pode ser repetido sem efeito além de outro aviso à escola.
export const MSG_RECUPERACAO_INCERTA = "Resultado não confirmado: não sabemos se o pedido chegou à escola. Verifique sua conexão e solicite de novo.";
