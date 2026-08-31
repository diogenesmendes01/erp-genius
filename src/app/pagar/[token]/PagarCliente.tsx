"use client";

import { useState } from "react";

export function PagarCliente({
  token,
  descricao,
  valor,
  moeda,
  status,
  vencimentoISO,
  simuladoHabilitado,
}: {
  token: string;
  descricao: string;
  valor: number;
  moeda: string;
  status: string;
  vencimentoISO: string;
  simuladoHabilitado: boolean;
}) {
  const [estado, setEstado] = useState<"aberto" | "pagando" | "pago" | "erro">(
    status === "PAGO" ? "pago" : "aberto",
  );
  const [erro, setErro] = useState<string | null>(null);

  async function pagar() {
    setEstado("pagando");
    setErro(null);
    try {
      const r = await fetch("/api/pagamentos/webhook/simulado", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const corpo = (await r.json()) as { ok?: boolean; erro?: string };
      if (!r.ok || !corpo.ok) throw new Error(corpo.erro ?? "Falha no pagamento.");
      setEstado("pago");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no pagamento.");
      setEstado("erro");
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="text-sm text-gray-500">{descricao}</div>
      <div className="mt-1 text-2xl font-medium">
        {moeda} {valor.toLocaleString("pt-BR")}
      </div>
      <div className="text-xs text-gray-400">
        Vencimento: {new Date(vencimentoISO).toLocaleDateString("pt-BR")}
      </div>

      {estado === "pago" ? (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          Pagamento confirmado. Obrigado! ✅
        </p>
      ) : simuladoHabilitado ? (
        <>
          <button
            className="mt-4 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            disabled={estado === "pagando"}
            onClick={pagar}
          >
            {estado === "pagando" ? "Processando…" : "Pagar (ambiente de teste)"}
          </button>
          <p className="mt-2 text-[11px] text-gray-400">
            Ambiente de demonstração — nenhum valor real é cobrado.
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Pagamento online indisponível no momento — fale com a escola para concluir por outro canal.
        </p>
      )}
      {erro && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
