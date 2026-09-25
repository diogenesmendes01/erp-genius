import { z } from "zod";
import { formatarMoeda } from "@/lib/dinheiro";
const schema = z.object({ contratos: z.array(z.object({ calculo: z.object({ matriculaId: z.string(), moeda: z.string() }), outrasCobrancasConferidas: z.object({
  pendencias: z.array(z.string()), parcelas: z.array(z.object({ cobrancaId: z.string(), valorOriginal: z.string(), valorDevidoProposto: z.string(), valorRecebido: z.string(), saldoDevido: z.string(), creditoApurado: z.string(), motivo: z.string(), evidenciaContratual: z.string(),
    valorLiquidadoCredito: z.string().optional(),
    recebimentos: z.array(z.object({ id: z.string(), valor: z.string(), moeda: z.string(), dataPagamento: z.string() })).optional(),
    utilizacoesCredito: z.array(z.object({ propostaId: z.string(), creditoId: z.string(), decisaoId: z.string(), valor: z.string() })).optional(),
    origemFaturamentoHoras: z.object({ emissaoId: z.string(), decisaoId: z.string(), itens: z.array(z.object({ id: z.string(), conferenciaId: z.string(), valor: z.string() })) }).optional(),
  })),
  consolidado: z.object({ saldoDevidoSemCompensarCreditos: z.string(), creditoApurado: z.string() }).nullable(),
}).optional() })) });
export function OutrasCobrancasResumo({ snapshot }: { snapshot: unknown }) {
  const r = schema.safeParse(snapshot);
  if (!r.success) return null;
  return <>{r.data.contratos.map((c) => <section key={c.calculo.matriculaId} className="space-y-2 rounded border p-3">
    <h4>Demais cobranças · {c.calculo.matriculaId}</h4>
    {!c.outrasCobrancasConferidas ? <p>Esta versão não contém conferência das demais cobranças.</p> : <>
      {c.outrasCobrancasConferidas.pendencias.map((p) => <p key={p} className="text-amber-800">{p}</p>)}
      {c.outrasCobrancasConferidas.parcelas.map((p) => <details key={p.cobrancaId}><summary>Cobrança {p.cobrancaId} · devido proposto {formatarMoeda(p.valorDevidoProposto, c.calculo.moeda)}</summary>
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          <dt>Valor negociado antes do acerto</dt><dd>{formatarMoeda(p.valorOriginal, c.calculo.moeda)}</dd>
          <dt>Recebimentos registrados</dt><dd>{formatarMoeda(p.valorRecebido, c.calculo.moeda)}</dd>
          <dt>Crédito já utilizado nesta cobrança</dt><dd>{formatarMoeda(p.valorLiquidadoCredito ?? "0.00", c.calculo.moeda)}</dd>
          <dt>Valor devido proposto</dt><dd>{formatarMoeda(p.valorDevidoProposto, c.calculo.moeda)}</dd>
          <dt>Saldo a pagar após o acerto</dt><dd>{formatarMoeda(p.saldoDevido, c.calculo.moeda)}</dd>
          <dt>Crédito apurado pelo acerto</dt><dd>{formatarMoeda(p.creditoApurado, c.calculo.moeda)}</dd>
        </dl>
        <p>O saldo considera os recebimentos e créditos já utilizados. O crédito apurado será registrado na efetivação do acerto aprovado; sua utilização ou devolução exige o fluxo correspondente.</p>
        {p.origemFaturamentoHoras && <details className="mt-2"><summary>Origem das particulares por hora · {p.origemFaturamentoHoras.itens.length} encontro(s)</summary>
          <p>Emissão {p.origemFaturamentoHoras.emissaoId}. Aprovação do fechamento {p.origemFaturamentoHoras.decisaoId}.</p>
          <ul>{p.origemFaturamentoHoras.itens.map(item => <li key={item.id}>Conferência {item.conferenciaId} · valor faturado preservado {formatarMoeda(item.valor, c.calculo.moeda)}</li>)}</ul>
        </details>}
        {!!p.recebimentos?.length && <details className="mt-2"><summary>Recebimentos preservados · {p.recebimentos.length}</summary>
          <ul>{p.recebimentos.map(recebimento => <li key={recebimento.id}>Recebimento {recebimento.id} · {formatarMoeda(recebimento.valor, recebimento.moeda)}</li>)}</ul>
        </details>}
        {!!p.utilizacoesCredito?.length && <details className="mt-2"><summary>Utilizações anteriores de crédito · {p.utilizacoesCredito.length}</summary>
          <ul>{p.utilizacoesCredito.map(uso => <li key={uso.propostaId}>Crédito {uso.creditoId} · {formatarMoeda(uso.valor, c.calculo.moeda)} · aprovação {uso.decisaoId}</li>)}</ul>
        </details>}
        <p>Motivo: {p.motivo}. Evidência: {p.evidenciaContratual}.</p>
      </details>)}
      {c.outrasCobrancasConferidas.consolidado && <p>Subtotal das demais cobranças: saldo devido {formatarMoeda(c.outrasCobrancasConferidas.consolidado.saldoDevidoSemCompensarCreditos, c.calculo.moeda)}; crédito separado {formatarMoeda(c.outrasCobrancasConferidas.consolidado.creditoApurado, c.calculo.moeda)}.</p>}
    </>}
    <p>Proposta sujeita à aprovação independente. Não utiliza créditos, devolve dinheiro ou converte horas antecipadas.</p>
  </section>)}</>;
}
