import Link from "next/link";
import { listarFamiliasModelos } from "@/server/contratos/modelos";

export default async function ModelosPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const p = Number((await searchParams).pagina ?? 1);
  const dados = await listarFamiliasModelos({ pagina: Number.isInteger(p) && p > 0 && p <= 100000 ? p : 1 });
  return <section className="space-y-4">
    <h2 className="text-xl font-medium">Modelos contratuais</h2>
    <p>Prepare o conteúdo institucional e encaminhe para decisão de outra pessoa da Administração. Cada alteração cria uma versão preservada no histórico.</p>
    <Link className="underline" href="/configuracao/contratos/novo">Preparar novo modelo</Link>
    {dados.familias.length === 0 ? <p>Nenhum modelo cadastrado.</p> : <ul className="space-y-2">{dados.familias.map((f) => <li key={f.codigo} className="rounded border p-3">
      <Link className="underline" href={`/configuracao/contratos/${f.codigo}`}>{f.codigo}</Link> — última versão {f.ultimaVersao}, {f.quantidade} versões registradas
    </li>)}</ul>}
    <nav aria-label="Páginas dos modelos" className="flex gap-4">
      {dados.pagina > 1 && <Link href={`?pagina=${dados.pagina - 1}`}>Anterior</Link>}
      <span>Página {dados.pagina}</span>{dados.temProxima && <Link href={`?pagina=${dados.pagina + 1}`}>Próxima</Link>}
    </nav>
  </section>;
}
