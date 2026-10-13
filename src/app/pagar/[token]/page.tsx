import type { Metadata } from "next";
import { IconCircleCheck } from "@tabler/icons-react";
import { formatarDataCivil } from "@/lib/data-civil";
import { formatarMoeda } from "@/lib/dinheiro";
import { cobrancaPorToken, pagamentoSimuladoHabilitado } from "@/server/financeiro/gateway";
import { PagarCliente } from "./PagarCliente";
import { quadroDoPagamento, type TomQuadro } from "./quadro";

// PÁGINA PÚBLICA de pagamento (Fase 2, driver simulado): o cliente abre o link enviado
// pelo vendedor. Projeção MÍNIMA (primeiro nome + valor — nada de dados pessoais).
// O botão de pagar só aparece com PAGAMENTO_SIMULADO=1 (dev/demo); com um gateway real,
// esta página nem existe — o link aponta para o checkout do provedor.
//
// Cada situação do link e da cobrança tem texto e saída próprios (./quadro.ts; docs/43 §6 item 8): link
// inválido, expirado, cobrança paga, cancelada, vencida e pendente.

// Link de cobrança circula por mensagem: não pode ser indexado (docs/42 /pagar #7).
export const metadata: Metadata = { title: "Pagamento | Escola Genius", robots: { index: false, follow: false } };

const TONS: Record<TomQuadro, string> = {
  neutro: "bg-gray-50 text-gray-700",
  sucesso: "bg-green-50 text-green-700",
  aviso: "bg-amber-50 text-amber-700",
  erro: "bg-red-50 text-red-700",
};

export default async function PagarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cobranca = await cobrancaPorToken(token);
  const quadro = quadroDoPagamento(token, cobranca);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-xl font-medium">Pagamento — Escola Genius</h1>
      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        {cobranca && quadro.mostraValor && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">{cobranca.descricao}</p>
            <p className="mt-1 text-2xl font-medium">{formatarMoeda(cobranca.valor, cobranca.moeda)}</p>
            <p className="text-sm text-gray-600">Vencimento: {formatarDataCivil(cobranca.vencimentoISO.slice(0, 10))}</p>
          </div>
        )}
        <div className={`rounded-md px-3 py-2 text-sm ${TONS[quadro.tom]}`}>
          <h2 className="flex items-center gap-1.5 font-medium">
            {quadro.tom === "sucesso" && <IconCircleCheck className="h-4 w-4" aria-hidden="true" />}
            {quadro.titulo}
          </h2>
          <p className="mt-1">{quadro.texto}</p>
          <p className="mt-1">{quadro.saida}</p>
        </div>
        {quadro.podePagar && <PagarCliente token={token} simuladoHabilitado={pagamentoSimuladoHabilitado()} />}
      </section>
    </main>
  );
}
