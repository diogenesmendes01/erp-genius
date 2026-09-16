import Link from "next/link";
import { notFound } from "next/navigation";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPreviaContratual } from "@/server/contratos/previas";
import { TextoPreviaSchema } from "@/server/contratos/previa-projecao";
import { TextoPrevia } from "../../TextoPrevia";
import { PreservarOriginal } from "../../PreservarOriginal";
import { consultarOriginaisContratuais } from "@/server/contratos/originais";

export default async function PreviaPage({ params, searchParams }: { params: Promise<{ id: string; previaId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id, previaId } = await params, r = await consultarPreviaContratual(previaId);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  if (r.dado.matriculaId !== id) notFound();
  const p = r.dado, texto = TextoPreviaSchema.safeParse(p.snapshot);
  const pagina = Number((await searchParams).pagina ?? "1");
  const originais = await consultarOriginaisContratuais({ previaId, pagina });
  return <div className="space-y-4"><Link className="underline" href={`/matriculas/${id}/contrato`}>Voltar às prévias da matrícula</Link>
    <h1 className="text-2xl">Prévia contratual preservada</h1>
    <a className="underline" href={`/api/matriculas/${id}/previas/${previaId}/pdf`} target="_blank" rel="noopener noreferrer">Abrir PDF da prévia sem assinatura</a>
    <p>Registrada por {p.autor.nome}, em {p.criadaEm.toISOString().replace("T", " ").slice(0, 19)} UTC.</p>
    <p className="whitespace-pre-wrap">{p.motivo}</p>
    <p>O texto abaixo corresponde ao registro original. A prévia não comprova assinatura ou aceite do contrato.</p>
    <Link className="underline" href={`/matriculas/${id}/contrato/previas/${previaId}/participantes`}>Conferir participantes e consultar histórico</Link>
    {texto.success ? <TextoPrevia dados={texto.data} /> : <p role="alert">A estrutura preservada precisa de conferência.</p>}
    {originais.ok && originais.dado ? <section className="space-y-3">
      {originais.dado.conferencia && !originais.dado.conferenciaJaPreservada
        ? <PreservarOriginal previaId={previaId} conferenciaId={originais.dado.conferencia.id} /> : null}
      <h2 className="text-xl">Originais preservados</h2>
      {!originais.dado.registros.length && <p>Ainda não há original preservado. A geração exige uma conferência atual dos participantes.</p>}
      {originais.dado.registros.map((a) => <article key={a.id} className="rounded border p-3">
        <a className="underline" href={`/api/matriculas/${id}/originais/${a.id}/pdf`} target="_blank" rel="noopener noreferrer">Abrir original registrado em {a.criadoEm.toISOString().replace("T", " ").slice(0, 19)} UTC</a>
        <p>{a.paginas} página(s). {a.motivo}</p><p>Arquivo anterior à assinatura; geração não comprova aceite.</p>
        <Link className="underline" href={`/matriculas/${id}/contrato/originais/${a.id}`}>Conferir condições para assinatura</Link>
      </article>)}
      {pagina > 1 && <Link className="underline mr-4" href={`?pagina=${pagina - 1}`}>Anteriores</Link>}
      {originais.dado.temProxima && <Link className="underline" href={`?pagina=${pagina + 1}`}>Próximos</Link>}
    </section> : <p role="alert">{originais.ok ? "Consulta indisponível." : originais.erro}</p>}
  </div>;
}
