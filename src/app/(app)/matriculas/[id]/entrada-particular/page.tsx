import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPagamentosEntradaParticular } from "@/server/matricula/entrada-particular-consulta";
import { nomeCompleto } from "@/lib/nome";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDataCivil } from "@/lib/data-civil";
const tipo = (s: string) => s === "MATRICULA" ? "Taxa de matrícula" : s === "MENSALIDADE" ? "Primeira mensalidade" : "Adiantamento por hora";

export default async function EntradaParticular({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
  const { id } = await params, r = await consultarPagamentosEntradaParticular(id);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4">
    <h1 className="text-2xl font-medium">Pagamentos de entrada da particular</h1>
    <p>{nomeCompleto(d.aluno)} · Matrícula {d.codigo ?? d.matriculaId} · Condições versão {d.versaoCondicoes}.</p>
    <p>{d.pagamentosExigidosConfirmados ? "Os pagamentos exigidos para a entrada estão confirmados." : "Há pendências nos pagamentos de entrada."}</p>
    <p>Esta conferência não ativa a matrícula. O aceite do contrato e a disponibilidade dos horários precisam ser validados no fluxo de ativação.</p>
    {d.itens.map(c => <article key={c.id} className="space-y-2 rounded border p-4"><h2 className="font-medium">{tipo(c.tipo)}</h2>
      <p>{formatarMoeda(Number(c.valor),c.moeda)}{c.minutos ? ` · ${c.minutos} minutos contratados` : ""}.</p>
      <p>{c.exigido ? "Pagamento exigido para ativar." : "Antecipação opcional; não condiciona a ativação."} {c.confirmada ? "Recebimento confirmado." : "Recebimento ainda não confirmado."}</p>
      {c.pendencia && <p role="alert">{c.pendencia}</p>}
    </article>)}
    {d.emitirNaAtivacao.length > 0 && <section><h2 className="text-xl font-medium">Emissão prevista na ativação</h2><ul>{d.emitirNaAtivacao.map(c => <li key={c.tipo}>{tipo(c.tipo)} · {formatarMoeda(Number(c.valor),c.moeda)} · vencimento {formatarDataCivil(c.vencimento)}.</li>)}</ul></section>}
    <Link className="underline" href="/financeiro">Acompanhar recebimentos no Financeiro</Link>
  </section>;
}
