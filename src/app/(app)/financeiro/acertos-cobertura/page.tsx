import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarAditivosParaCobertura } from "@/server/contratos/aditivo-cobertura-consulta";

export default async function AcertosCoberturaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const valor = Number((await searchParams).pagina ?? 1), pagina = Number.isInteger(valor) && valor >= 1 && valor <= 100000 ? valor : 1;
  const r = await listarAditivosParaCobertura(pagina);
  return <main className="space-y-4"><Link href="/financeiro" className="underline">Voltar ao Financeiro</Link><h1 className="text-2xl">Correções de cobertura por aditivo</h1><p>Prepare todas as mensalidades, registre a decisão independente e aplique o conjunto completo uma única vez.</p>
    {!r.ok ? <p role="alert">{r.erro}</p> : <><ul className="space-y-3">{r.dado?.itens.map(item => <li key={item.propostaId}><Link className="underline" href={`/financeiro/acertos-cobertura/${encodeURIComponent(item.matriculaId)}/${encodeURIComponent(item.propostaId)}`}>Matrícula {item.matriculaId} · condições versão {item.versao}</Link></li>)}</ul>{!r.dado?.itens.length && <p role="status">Nenhum aditivo de cobertura foi encontrado nesta página.</p>}<nav className="flex gap-4">{pagina > 1 && <Link href={`?pagina=${pagina - 1}`}>Anterior</Link>}{r.dado?.temProxima && <Link href={`?pagina=${pagina + 1}`}>Próxima</Link>}</nav></>}
  </main>;
}
