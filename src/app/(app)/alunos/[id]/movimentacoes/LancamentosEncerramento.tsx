import { z } from "zod";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDataCivil } from "@/lib/data-civil";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
const Schema = z.object({ contratos: z.array(z.object({ lancamentos: z.object({ plano: z.object({ moeda: z.string(), multa: z.object({ valorProposto: z.string(), vencimento: z.string().nullable() }).optional(), ajustes: z.array(z.object({ cobrancaId: z.string(), valorDevido: z.string(), saldo: z.string(), credito: z.string() })), creditos: z.array(z.object({ origemTipo: z.string(), origemId: z.string(), valor: z.string() })) }).nullable() }).optional() })) });
export function LancamentosEncerramento({ snapshot }: { snapshot: unknown }) {
  const r = Schema.safeParse(snapshot); if (!r.success) return null;
  return <div>{r.data.contratos.map((c, i) => c.lancamentos?.plano && <Collapsible key={i}><CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-left text-sm font-medium text-gray-800">Lançamentos previstos do acerto · {c.lancamentos.plano.moeda}</CollapsibleTrigger><CollapsibleContent forceMount className="data-[state=closed]:hidden">
    <Table><TableHeader><TableRow><TableHead>Cobrança</TableHead><TableHead>Valor após acerto</TableHead><TableHead>Saldo devido</TableHead><TableHead>Crédito apurado</TableHead></TableRow></TableHeader><TableBody>{c.lancamentos.plano.ajustes.map(a => <TableRow key={a.cobrancaId}><TableCell>{a.cobrancaId}</TableCell><TableCell>{formatarMoeda(a.valorDevido, c.lancamentos!.plano!.moeda)}</TableCell><TableCell>{formatarMoeda(a.saldo, c.lancamentos!.plano!.moeda)}</TableCell><TableCell>{formatarMoeda(a.credito, c.lancamentos!.plano!.moeda)}</TableCell></TableRow>)}</TableBody></Table>
    <p>Multa prevista: {c.lancamentos.plano.multa ? formatarMoeda(c.lancamentos.plano.multa.valorProposto, c.lancamentos.plano.moeda) : "conferir"} · Vencimento: {formatarDataCivil(c.lancamentos.plano.multa?.vencimento, "sem cobrança programada")}.</p><p>Créditos previstos por origem:</p><ul>{c.lancamentos.plano.creditos.map(cr => <li key={`${cr.origemTipo}:${cr.origemId}`}>{cr.origemTipo === "COBRANCA" ? "Cobrança" : "Compra de horas"} {cr.origemId}: {formatarMoeda(cr.valor, c.lancamentos!.plano!.moeda)}</li>)}</ul>
    <p>Os créditos desta lista detalham os valores do acerto; não devem ser somados novamente ao total. Nenhum lançamento foi efetivado.</p>
  </CollapsibleContent></Collapsible>)}</div>;
}
