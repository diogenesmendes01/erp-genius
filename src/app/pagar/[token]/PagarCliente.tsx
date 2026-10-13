"use client";

import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { pagarCobrancaSimulada } from "./requisicao";

// Caminho de pagamento da cobrança pendente ou vencida (a página decide quando ele aparece; ./quadro.ts).
// Erro e sucesso separados (useAcaoCliente + FeedbackAcao; docs/43 §6 item 8): a recusa sai em role="alert"
// com o botão "Tentar de novo", a confirmação em role="status", e a falha de rede como resultado não confirmado
// (recarregar mostra se a cobrança já está paga — a baixa não tem chave de idempotência). Depois do pagamento
// aceito, a página é renderizada de novo, e o quadro do servidor passa de "em aberto" a "paga".
export function PagarCliente({ token, simuladoHabilitado }: { token: string; simuladoHabilitado: boolean }) {
  const acao = useAcaoCliente({ idempotente: false });
  const router = useRouter();

  async function pagar() {
    const desfecho = await acao.executar(() => pagarCobrancaSimulada(token), "Pagamento confirmado. Obrigado!");
    if (desfecho?.tipo === "ok") router.refresh();
  }

  if (!simuladoHabilitado) {
    return (
      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
        Pagamento online indisponível no momento. Para pagar, fale com a Secretaria da escola, que indica outro canal.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {!acao.sucesso && (
        <>
          <Botao tamanho="lg" className="w-full" disabled={acao.ocupado} onClick={pagar}>
            {acao.ocupado ? "Processando…" : acao.erro ? "Tentar de novo" : "Pagar (ambiente de teste)"}
          </Botao>
          <p className="mt-2 text-xs text-gray-600">Ambiente de demonstração — nenhum valor real é cobrado.</p>
        </>
      )}
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-2" />
    </div>
  );
}
