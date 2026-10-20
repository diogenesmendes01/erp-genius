"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarDiaPrevisaoComissao } from "@/server/financeiro/acoes";
import { DIA_PREVISAO_COMISSAO_MAX, DIA_PREVISAO_COMISSAO_MIN } from "@/server/financeiro/previsao-comissao";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

// D11 (decisão do dono, 20/10/2026): o dia X da previsão de pagamento das comissões (dia X do mês seguinte à
// competência). Fica na aba "Política de comissão" do financeiro, com a mesma alçada de publicar política.
// O valor enviado é o estado-alvo: repetir o mesmo dia não grava nada, então o envio é idempotente.

export const MSG_DIA_INVALIDO = `Informe um dia entre ${DIA_PREVISAO_COMISSAO_MIN} e ${DIA_PREVISAO_COMISSAO_MAX}.`;

export function DiaPrevisaoComissao({ dia }: { dia: number }) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: true });
  const [valor, setValor] = useState(String(dia));

  async function salvar() {
    const n = Number(valor);
    if (!/^\d+$/.test(valor.trim()) || n < DIA_PREVISAO_COMISSAO_MIN || n > DIA_PREVISAO_COMISSAO_MAX) {
      acao.limpar();
      acao.setErro(MSG_DIA_INVALIDO);
      return;
    }
    const d = await acao.executar(() => salvarDiaPrevisaoComissao({ dia: n }), `Previsão de pagamento: dia ${n} do mês seguinte à competência.`);
    if (d?.tipo === "ok") router.refresh();
  }

  return (
    <section aria-label="Previsão de pagamento das comissões" className="space-y-2 rounded border p-3 text-sm">
      <h2 className="text-lg font-medium">Previsão de pagamento</h2>
      <p className="text-gray-600">
        A comissão tem pagamento previsto para este dia do mês seguinte à competência, no fuso da escola. Aparece no painel de comissões.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          Dia do mês ({DIA_PREVISAO_COMISSAO_MIN} a {DIA_PREVISAO_COMISSAO_MAX})
          <input
            type="number" inputMode="numeric" min={DIA_PREVISAO_COMISSAO_MIN} max={DIA_PREVISAO_COMISSAO_MAX} step={1}
            value={valor} onChange={(e) => setValor(e.target.value)} className="block w-24 rounded border p-2"
          />
        </label>
        <Botao tamanho="lg" ocupado={acao.ocupado} onClick={salvar}>Salvar dia</Botao>
      </div>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    </section>
  );
}
