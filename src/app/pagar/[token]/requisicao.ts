import type { Resultado } from "@/server/_shared/resultado";

export const ERRO_PAGAMENTO = "Não conseguimos concluir o pagamento. Recarregue a página para ver a situação da cobrança antes de tentar de novo.";

export async function pagarCobrancaSimulada(token: string): Promise<Resultado> {
  const resposta = await fetch("/api/pagamentos/webhook/simulado", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!resposta.ok) return { ok: false, erro: ERRO_PAGAMENTO };
  const corpo = (await resposta.json()) as { ok?: boolean };
  return corpo.ok ? { ok: true } : { ok: false, erro: ERRO_PAGAMENTO };
}
