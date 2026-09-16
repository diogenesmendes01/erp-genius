import Link from "next/link";
import { consultarOriginaisAditivo } from "@/server/contratos/aditivo-originais";
import { OriginalFormulario } from "./OriginalFormulario";
export async function OriginaisPainel({ matriculaId, propostaId, podeGerar, pagina }: { matriculaId: string; propostaId: string; podeGerar: boolean; pagina: number }) {
  const r = await consultarOriginaisAditivo({ matriculaId, propostaId, pagina });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Originais indisponíveis." : r.erro}</p>;
  const d = r.dado, base = `/matriculas/${encodeURIComponent(matriculaId)}/contrato/aditivos/${encodeURIComponent(propostaId)}`;
  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Originais preservados do aditivo</h2>
    <p>O PDF preservado é o documento anterior à assinatura. Sua geração não aplica as condições do aditivo.</p>
    {podeGerar && d.conferencia && !d.preservada && <OriginalFormulario matriculaId={matriculaId} propostaId={propostaId} conferencia={d.conferencia} />}
    {podeGerar && !d.conferencia && <p>Confira os signatários antes de gerar o original.</p>}
    {!d.registros.length && <p>Nenhum original nesta página.</p>}
    {d.registros.map(a => <article className="space-y-1 rounded border p-3" key={a.id}><p>{a.autor.nome} · {a.criadoEm.toISOString().replace("T", " ").slice(0, 19)} UTC · {a.paginas} página(s)</p><p className="whitespace-pre-wrap">{a.motivo}</p>
      <a className="underline" target="_blank" rel="noopener noreferrer" href={`/api/matriculas/${encodeURIComponent(matriculaId)}/aditivos/${encodeURIComponent(propostaId)}/originais/${encodeURIComponent(a.id)}/pdf`}>Abrir PDF original preservado</a>
      <Link className="block underline" href={`${base}/originais/${encodeURIComponent(a.id)}`}>Conferir original e consultar histórico</Link>
    </article>)}
    <nav aria-label="Páginas dos originais de aditivo" className="flex gap-3">{pagina > 1 && <Link className="underline" href={`${base}?paginaOriginais=${pagina - 1}`}>Originais anteriores</Link>}<span>Página {pagina}</span>{d.temProxima && <Link className="underline" href={`${base}?paginaOriginais=${pagina + 1}`}>Próximos originais</Link>}</nav>
  </section>;
}
