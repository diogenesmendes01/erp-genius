// Formato do token do link público de pagamento (`/pagar/<token>`): hexadecimal opaco, como o que o driver
// simulado gera (src/server/financeiro/gateway.ts). Fonte única para a consulta e para a página, que distingue
// "link inválido" (fora do formato, provavelmente cortado ao copiar) de "link sem cobrança" (expirado ou trocado).
const FORMATO_TOKEN_PAGAMENTO = /^[0-9a-f]{16,64}$/;

export function tokenPagamentoBemFormado(token: string): boolean {
  return FORMATO_TOKEN_PAGAMENTO.test(token);
}
