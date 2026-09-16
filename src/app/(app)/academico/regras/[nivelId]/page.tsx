import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarRegrasAvaliacao } from "@/server/avaliacoes/regras";
import { DecidirRegra, ProporRegra } from "./Formularios";
import { ResumoRegra } from "./ResumoRegra";

export default async function RegraNivelPage({ params, searchParams }: { params: Promise<{ nivelId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { nivelId } = await params; const p = Number((await searchParams).pagina ?? 1);
  const r = await consultarRegrasAvaliacao({ nivelId, pagina: Number.isInteger(p) && p > 0 && p <= 100000 ? p : 1 });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <section className="space-y-6">
    <Link href="/academico/regras" className="underline">Outros níveis</Link>
    <h1 className="text-2xl font-medium">Avaliações — {d.nivel.idioma.nome} / {d.nivel.codigo}</h1>
    <p>{d.vigente ? `Última versão publicada: ${d.vigente.versao}.` : "Nenhuma versão publicada."} As versões anteriores permanecem no histórico.</p>
    {d.regras.map(v => <article key={v.id} className="space-y-4 rounded border p-4">
      <h2 className="text-lg font-medium">Versão {v.versao} — {v.decisao ? v.decisao.aprovada ? "Publicada" : "Rejeitada" : "Aguardando conferência"}</h2>
      <p>Preparada por {v.preparador.nome} em {v.criadaEm.toLocaleString("pt-BR", { timeZone: "UTC" })} UTC.</p><p className="whitespace-pre-wrap">Motivo: {v.motivo}</p>
      <ResumoRegra conteudo={v.conteudo} />
      {v.decisao && <p className="whitespace-pre-wrap">Decisão por {v.decisao.decisor.nome}: {v.decisao.motivo}</p>}
      {v.podeDecidir && <DecidirRegra regraId={v.id} conteudoHash={v.conteudoHash} podeAprovar={v.podeAprovar} />}
      {!v.decisao && !v.podeDecidir && <p>A decisão precisa ser registrada por outra pessoa autorizada.</p>}
    </article>)}
    <nav aria-label="Páginas do histórico" className="flex gap-4">{d.pagina > 1 && <Link href={`?pagina=${d.pagina - 1}`}>Anterior</Link>}<span>Página {d.pagina}</span>{d.temProxima && <Link href={`?pagina=${d.pagina + 1}`}>Próxima</Link>}</nav>
    {d.pagina === 1 && <ProporRegra key={d.ultimaVersao} nivelId={nivelId} versaoEsperada={d.ultimaVersao} inicial={d.regras[0]?.conteudo} />}
  </section>;
}
