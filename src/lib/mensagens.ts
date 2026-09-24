// Falha de transporte com resultado desconhecido. Nunca sugerir "confira os dados": dado alterado vira outra tentativa.
// Use só onde o servidor devolve o registro existente quando a entrada é repetida idêntica.

export const MSG_RESULTADO_INCERTO = "Resultado não confirmado. Reenvie sem alterar os dados para conferir a mesma operação.";

export const MSG_DECISAO_INCERTA = "Resultado não confirmado. Reenvie a mesma decisão para conferir.";

// Mesmo evento, mas a ação NÃO tem chave de idempotência: reenviar pode aplicar duas vezes.
// Por isso a instrução é conferir antes de repetir — nunca "reenvie".
export const MSG_RESULTADO_INCERTO_SEM_CHAVE = "Resultado não confirmado. Recarregue a página e veja se a operação já aparece antes de repetir.";
