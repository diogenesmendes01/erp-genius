import { z } from "zod";
const Schema = z.object({ contratos: z.array(z.object({ lancamentos: z.object({ plano: z.object({ moeda: z.string(), multa: z.object({ valorProposto: z.string(), vencimento: z.string().nullable() }).optional(), ajustes: z.array(z.object({ cobrancaId: z.string(), valorDevido: z.string(), saldo: z.string(), credito: z.string() })), creditos: z.array(z.object({ origemTipo: z.string(), origemId: z.string(), valor: z.string() })) }).nullable() }).optional() })) });
export function LancamentosEncerramento({ snapshot }: { snapshot: unknown }) {
  const r = Schema.safeParse(snapshot); if (!r.success) return null;
  return <div>{r.data.contratos.map((c, i) => c.lancamentos?.plano && <details key={i}><summary>Lançamentos previstos do acerto · {c.lancamentos.plano.moeda}</summary>
    <table><thead><tr><th>Cobrança</th><th>Valor após acerto</th><th>Saldo devido</th><th>Crédito apurado</th></tr></thead><tbody>{c.lancamentos.plano.ajustes.map(a => <tr key={a.cobrancaId}><td>{a.cobrancaId}</td><td>{a.valorDevido}</td><td>{a.saldo}</td><td>{a.credito}</td></tr>)}</tbody></table>
    <p>Multa prevista: {c.lancamentos.plano.multa?.valorProposto ?? "conferir"} {c.lancamentos.plano.moeda} · Vencimento: {c.lancamentos.plano.multa?.vencimento ?? "sem cobrança programada"}.</p><p>Créditos previstos por origem:</p><ul>{c.lancamentos.plano.creditos.map(cr => <li key={`${cr.origemTipo}:${cr.origemId}`}>{cr.origemTipo === "COBRANCA" ? "Cobrança" : "Compra de horas"} {cr.origemId}: {cr.valor} {c.lancamentos!.plano!.moeda}</li>)}</ul>
    <p>Os créditos desta lista detalham os valores do acerto; não devem ser somados novamente ao total. Nenhum lançamento foi efetivado.</p>
  </details>)}</div>;
}
