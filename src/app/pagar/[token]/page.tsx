import { cobrancaPorToken, pagamentoSimuladoHabilitado } from "@/server/financeiro/gateway";
import { PagarCliente } from "./PagarCliente";

// PÁGINA PÚBLICA de pagamento (Fase 2, driver simulado): o cliente abre o link enviado
// pelo vendedor. Projeção MÍNIMA (primeiro nome + valor — nada de dados pessoais).
// O botão de pagar só aparece com PAGAMENTO_SIMULADO=1 (dev/demo); com um gateway real,
// esta página nem existe — o link aponta para o checkout do provedor.

export default async function PagarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cobranca = await cobrancaPorToken(token);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-10">
      <h1 className="text-xl font-medium">Pagamento — Escola Genius</h1>
      {!cobranca ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Link de pagamento inválido ou expirado.
        </p>
      ) : (
        <PagarCliente
          token={token}
          descricao={cobranca.descricao}
          valor={cobranca.valor}
          moeda={cobranca.moeda}
          status={cobranca.status}
          vencimentoISO={cobranca.vencimentoISO}
          simuladoHabilitado={pagamentoSimuladoHabilitado()}
        />
      )}
    </main>
  );
}
