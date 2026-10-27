const FORMATO_TOKEN_PAGAMENTO = /^[0-9a-f]{16,64}$/;

export function tokenPagamentoBemFormado(token: string): boolean {
  return FORMATO_TOKEN_PAGAMENTO.test(token);
}
