import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarNiveisRegrasAvaliacao } from "@/server/avaliacoes/regras";
import { VoltarPara } from "@/components/VoltarPara";

export default async function RegrasPage({ searchParams }: { searchParams: Promise<{ busca?: string; pagina?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const p = await searchParams;
  const pagina = Number(p.pagina ?? 1);
  const r = await listarNiveisRegrasAvaliacao({ busca: p.busca, pagina: Number.isInteger(pagina) && pagina > 0 && pagina <= 100000 ? pagina : 1 });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-4">
    <VoltarPara href="/academico" para="Acadêmico" />
    <h1 className="text-2xl font-medium">Regras de avaliação</h1>
    <p>Selecione o idioma e o nível para preparar ou conferir os critérios institucionais.</p>
    <form className="flex flex-wrap items-end gap-3"><label>Idioma ou nível<input name="busca" maxLength={100} defaultValue={d.busca} className="block rounded border p-2" /></label><button className="rounded border px-4 py-2">Buscar</button></form>
    {d.niveis.length === 0 ? <p>Nenhum nível encontrado.</p> : <ul className="space-y-2">{d.niveis.map(n => <li key={n.id}><Link className="underline" href={`/academico/regras/${n.id}`}>{n.idioma.nome} — {n.codigo}</Link></li>)}</ul>}
    <nav aria-label="Páginas dos níveis" className="flex gap-4">
      {d.pagina > 1 && <Link href={`?busca=${encodeURIComponent(d.busca)}&pagina=${d.pagina - 1}`}>Anterior</Link>}
      <span>Página {d.pagina}</span>{d.temProxima && <Link href={`?busca=${encodeURIComponent(d.busca)}&pagina=${d.pagina + 1}`}>Próxima</Link>}
    </nav>
  </section>;
}
