"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TipoAjuste, Vigencia } from "@prisma/client";
import { formatarMoeda } from "@/lib/dinheiro";
import { ajustarCobranca } from "@/server/ajustes/acoes";
import type { obterResumoComercialFinanceiro } from "@/server/ajustes/consultas";

export function ResumoFinanceiroComercial({ dados }: { dados: NonNullable<Awaited<ReturnType<typeof obterResumoComercialFinanceiro>>> }) {
  const router = useRouter(); const [mensagem, setMensagem] = useState(""); const [ocupado, setOcupado] = useState(false);
  async function ajustar(form: FormData) {
    setOcupado(true); setMensagem("");
    const r = await ajustarCobranca({ cobrancaId: String(form.get("cobrancaId")), valorPara: Number(form.get("valor")), tipo: TipoAjuste.DESCONTO,
      vigencia: form.get("futuras") ? Vigencia.PROXIMOS_MESES : Vigencia.ESTA_COBRANCA, motivo: String(form.get("motivo")) });
    setOcupado(false); setMensagem(!r.ok ? r.erro : r.dado?.aprovacao ? "Pedido encaminhado para aprovação independente." : "Preço ajustado dentro da alçada.");
    if (r.ok) router.refresh();
  }
  return <div className="space-y-4"><h1 className="text-2xl font-medium">Acompanhamento comercial · {dados.aluno.primeiroNome} {dados.aluno.sobrenome}</h1>
    <Link className="text-sm text-brand-700 underline" href="/comissoes">Consultar histórico de comissões</Link>
    {mensagem && <p role="status" className="rounded bg-blue-50 p-3 text-sm">{mensagem}</p>}
    {dados.matriculas.map((m) => <section key={m.id} className="space-y-3 rounded border p-4 text-sm">
      {m.precoAguardandoAprovacao && <p className="rounded bg-amber-50 p-3 text-amber-800">Os valores propostos foram encaminhados para aprovação independente. Os preços de referência permanecem vigentes até a decisão, e a ativação aguarda essa análise.</p>}
      <h2 className="font-medium">{m.codigo} · {m.produto}</h2><p>Pagamento inicial: {m.pagamentoInicialConfirmado ? "confirmado" : "aguardando confirmação"}</p>
      {m.precos.map((p) => <form action={ajustar} key={p.id} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="cobrancaId" value={p.id} />
        <span>{p.tipo === "MATRICULA" ? "Taxa" : "Mensalidade"}: {formatarMoeda(p.valor, m.moeda)} · referência {formatarMoeda(p.referencia, m.moeda)}</span>
        <input required aria-label="Novo valor" type="number" name="valor" min="0" step="0.01" defaultValue={p.valor} className="w-28 rounded border p-1.5" />
        <input required name="motivo" aria-label="Motivo do ajuste" placeholder="Motivo do ajuste" minLength={5} className="rounded border p-1.5" />
        {p.tipo === "MENSALIDADE" && <label><input type="checkbox" name="futuras" /> Mensalidades futuras</label>}
        <button disabled={ocupado} className="rounded border px-3 py-1.5 disabled:opacity-50">Solicitar desconto</button>
      </form>)}
      {m.comissoes.map((c) => <p key={c.id}>Comissão: {formatarMoeda(c.valor, c.moeda)} · {c.tipo === "VALOR_FIXO" ? "valor fixo" : `${c.percentual}% da taxa`} · {c.status}</p>)}
    </section>)}
  </div>;
}
