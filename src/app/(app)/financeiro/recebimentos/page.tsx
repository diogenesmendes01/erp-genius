import Link from "next/link";
import { AcessoNegado } from "@/components/AcessoNegado";
import { exigirPapelLeitura } from "@/lib/guards";
import { formatarMoeda } from "@/lib/dinheiro";
import { FORMA_PAGAMENTO_LABEL, rotular } from "@/lib/labels";
import { listarContextosRecebimentoDestinado } from "@/server/financeiro/consultas";
import { consultarHistoricoRecebimentos } from "@/server/financeiro/recebimentos-historico";
import { RecebimentoDestinadoForm } from "./RecebimentoDestinadoForm";
import { formatarDataCivil } from "@/lib/data-civil";
import { VoltarPara } from "@/components/VoltarPara";

export default async function RecebimentosPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const papeis = await exigirPapelLeitura("FINANCEIRO");
  if (!papeis) return <AcessoNegado recurso="o caixa" />;
  const contextos = await listarContextosRecebimentoDestinado();
  const pagina = Number((await searchParams).pagina ?? 1);
  const historico = await consultarHistoricoRecebimentos({ pagina });
  return <section className="mx-auto max-w-4xl space-y-5"><VoltarPara href="/financeiro" /><div><h1 className="text-2xl font-medium">Registrar recebimento com destinações</h1><p className="mt-1 text-sm text-gray-600">Registre um fato de caixa e divida-o entre cobranças já emitidas do mesmo contrato ou deixe o saldo como crédito explícito. Matrículas em preparação aceitam antecipação documentada sem ativação automática.</p></div><RecebimentoDestinadoForm contextos={contextos} />
    <section className="space-y-3"><h2 className="text-xl">Histórico de recebimentos</h2>
      {!historico.ok ? <p role="alert">{historico.erro}</p> : <>{!historico.dado?.itens.length && <p>Nenhum recebimento nesta página.</p>}{historico.dado?.itens.map(r => <article key={r.id} className="space-y-2 rounded border p-3">
        <h3 className="font-medium">{formatarMoeda(r.valor, r.moeda)} · {rotular(FORMA_PAGAMENTO_LABEL, r.forma)}</h3><p>Matrícula {r.matriculaId} · pagamento em {formatarDataCivil(r.dataPagamento)}</p>
        {r.comprovante ? <a className="underline" href={r.comprovante.url} target="_blank" rel="noopener noreferrer">{r.comprovante.nome}</a> : <p>{r.evidenciaCaixaRegistrada ? "Sem arquivo de comprovante neste recebimento." : "Comprovante individual não identificado no registro histórico."}</p>}
        {r.comentario && <p className="whitespace-pre-wrap">{r.comentario}</p>}
        <ul>{r.destinos.map(v => <li key={v.id}>{v.tipo === "CREDITO_SEM_DESTINO" ? "Crédito sem destino" : `Cobrança ${v.cobrancaId}`} · {formatarMoeda(v.valor, r.moeda)} · {v.evidencia}</li>)}</ul>
      </article>)}<nav className="flex gap-4">{pagina > 1 && <Link href={`?pagina=${pagina - 1}`}>Anterior</Link>}{historico.dado?.temProxima && <Link href={`?pagina=${pagina + 1}`}>Próxima</Link>}</nav></>}
    </section></section>;
}
