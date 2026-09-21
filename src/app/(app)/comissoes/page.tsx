import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarComissoes } from "@/server/financeiro/consultas";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_COMISSAO_LABEL } from "@/lib/labels";

/** Beneficiário histórico tem acesso à comissão sem recuperar a carteira transferida. */
export default async function ComissoesPage() {
  await exigirSessaoPagina(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO);
  const comissoes = await listarComissoes();
  return <div className="space-y-4"><h1 className="text-2xl font-medium">Comissões</h1>
    <p className="text-sm text-gray-600">Comissões das negociações autorizadas, preservadas quando muda o responsável pelo atendimento.</p>
    <div className="overflow-x-auto rounded border"><table className="w-full text-left text-sm">
      <thead><tr className="bg-gray-50"><th className="p-3">Beneficiário</th><th className="p-3">Cálculo</th><th className="p-3">Valor</th><th className="p-3">Situação</th></tr></thead>
      <tbody>{comissoes.map((c) => <tr key={c.id} className="border-t"><td className="p-3">{c.vendedor}</td><td className="p-3">{c.tipo === "VALOR_FIXO" ? "Valor fixo" : `${c.percentual}% da taxa`}</td><td className="p-3">{formatarMoeda(c.valor, c.moeda)}</td><td className="p-3">{STATUS_COMISSAO_LABEL[c.status]}</td></tr>)}</tbody>
    </table></div>
    {!comissoes.length && <p className="text-sm text-gray-500">Nenhuma comissão no seu escopo.</p>}
  </div>;
}
