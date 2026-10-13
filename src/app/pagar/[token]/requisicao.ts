import type { Resultado } from "@/server/_shared/resultado";

// Pagamento pelo driver simulado (POST /api/pagamentos/webhook/simulado), no formato de uma server action:
// recusa vira `{ ok: false }` com uma mensagem estável — o texto cru do servidor não vai para o cliente final
// (docs/42 /pagar #5) — e falha de transporte lança (o useAcaoCliente diz que o resultado não foi confirmado).

export const ERRO_PAGAMENTO = "Não conseguimos concluir o pagamento. Recarregue a página para ver a situação da cobrança antes de tentar de novo.";

export async function pagarCobrancaSimulada(token: string): Promise<Resultado> {
  const resposta = await fetch("/api/pagamentos/webhook/simulado", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!resposta.ok) return { ok: false, erro: ERRO_PAGAMENTO };
  // Corpo ilegível com 200: a baixa pode ter acontecido — lança (resultado incerto).
  const corpo = (await resposta.json()) as { ok?: boolean };
  return corpo.ok ? { ok: true } : { ok: false, erro: ERRO_PAGAMENTO };
}
