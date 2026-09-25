import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarLinhasConciliacaoFinanceira } from "@/server/migracao/consultas-financeiras";
import { VoltarPara } from "@/components/VoltarPara";

export default async function FilaConciliacaoPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.FINANCEIRO);
  const { cursor } = await searchParams;
  const resultado = await listarLinhasConciliacaoFinanceira({ cursor });
  return <section className="max-w-5xl space-y-4">
    <VoltarPara href="/financeiro" />
    <h1 className="text-xl font-medium">Conciliação financeira da migração</h1>
    <p>Confira as fontes históricas e proponha sua conciliação com o contrato correspondente. A proposta exige aprovação independente.</p>
    {!resultado.ok || !resultado.dado ? <p role="alert">{resultado.ok ? "Consulta sem resultado." : resultado.erro}</p> : <>
      {resultado.dado.itens.length === 0 && <p>Nenhuma linha financeira nesta página.</p>}
      <ul className="space-y-3">{resultado.dado.itens.map(linha => <li key={linha.id} className="rounded border p-4">
        <p>{linha.lote.origem} · {linha.lote.chaveLote} · linha {linha.linhaOrigem}</p>
        <p>Contrato na fonte: {linha.matriculaOrigemId ?? "não informado"} · registro financeiro: {linha.financeiroOrigemId ?? "não informado"}</p>
        <p>{linha.propostasConciliacaoFinanceira[0] ? "Última proposta: " + linha.propostasConciliacaoFinanceira[0].status : "Aguardando conferência"}</p>
        <Link href={"/financeiro/migracao/" + encodeURIComponent(linha.id)} className="text-brand-700 underline">Conferir linha</Link>
      </li>)}</ul>
      {resultado.dado.proximoCursor && <Link href={"/financeiro/migracao?cursor=" + encodeURIComponent(resultado.dado.proximoCursor)}>Próximas linhas</Link>}
    </>}
    {cursor && <Link href="/financeiro/migracao">Primeira página</Link>}
  </section>;
}
