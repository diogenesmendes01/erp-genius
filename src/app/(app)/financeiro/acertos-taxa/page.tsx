import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarAditivosParaAcertoTaxa } from "@/server/contratos/aditivo-acerto-taxa-consulta";
import { VoltarPara } from "@/components/VoltarPara";
export default async function AcertosTaxaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO);
  const pagina = Number((await searchParams).pagina ?? 1);
  const r = await listarAditivosParaAcertoTaxa(pagina);
  return <main className="space-y-4"><VoltarPara href="/financeiro" para="Financeiro" /><h1 className="text-2xl">Acertos de taxa por aditivo</h1>
    <p>Confira a cobrança e as condições formalizadas. Preparação, aprovação independente e aplicação ficam registradas separadamente.</p>
    {!r.ok ? <p role="alert">{r.erro}</p> : <><ul className="space-y-3">{r.dado?.itens.map(v => <li key={v.propostaId}><Link className="underline" href={`/financeiro/acertos-taxa/${encodeURIComponent(v.matriculaId)}/${encodeURIComponent(v.propostaId)}`}>Matrícula {v.matriculaId} · condições versão {v.versao}</Link></li>)}</ul>
    {!r.dado?.itens.length && <p>Nenhum aditivo com condições de taxa nesta página.</p>}
    <nav className="flex gap-4">{pagina > 1 && <Link href={`?pagina=${pagina - 1}`}>Anterior</Link>}{r.dado?.temProxima && <Link href={`?pagina=${pagina + 1}`}>Próxima</Link>}</nav></>}
  </main>;
}
