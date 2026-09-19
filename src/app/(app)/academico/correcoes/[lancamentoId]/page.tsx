import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCorrecoesNota } from "@/server/avaliacoes/correcao-consulta";
import { ProporCorrecao } from "./Formularios";
import { IdentificacaoAvaliacao } from "../../avaliacoes/Identificacao";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
const nomes = { FALA: "Fala", COMPREENSAO_ORAL: "Compreensão oral", LEITURA: "Leitura", ESCRITA: "Escrita" };
export default async function CorrecoesPage({ params, searchParams }: { params: Promise<{ lancamentoId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const { lancamentoId } = await params, p = Number((await searchParams).pagina ?? 1);
  const [r, preferencia] = await Promise.all([
    consultarCorrecoesNota({ lancamentoId, pagina: Number.isInteger(p) && p > 0 && p <= 100000 ? p : 1 }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <section className="space-y-5"><Link className="underline" href={`/academico/avaliacoes/${encodeURIComponent(d.alocacaoId)}/${encodeURIComponent(d.codigoAvaliacao)}`}>Voltar à avaliação</Link>
    <h1 className="text-2xl font-medium">Correções — {d.titulo}</h1><p>Escala: {d.escala.minimo} a {d.escala.maximo}. A correção pode reduzir uma nota registrada incorretamente; o histórico permanece preservado.</p>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    {d.pagina === 1 && <ProporCorrecao key={`${d.versaoEsperada}:${d.vigente.origemHash}`} lancamentoId={lancamentoId} origemHash={d.vigente.origemHash} versaoEsperada={d.versaoEsperada} notas={d.vigente.notas} />}
    <h2 className="text-xl font-medium">Histórico de propostas</h2>{!d.propostas.length && <p>Nenhuma proposta registrada.</p>}
    {d.propostas.map(p => <article key={p.id} className="space-y-3 rounded border p-4"><h3 className="font-medium">Proposta {p.versao} — {p.decisao ? p.decisao.aprovada ? "Aplicada" : "Rejeitada" : "Aguardando decisão"}</h3>
      <p>{p.autor.nome} · {formatarInstanteExibicao(p.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC)</p><p className="whitespace-pre-wrap">{p.motivo}</p>
      {p.notas.map(n => { const antes = p.anteriores.find(a => a.habilidade === n.habilidade); return <div key={n.habilidade}><p>{nomes[n.habilidade]}: {antes?.nota} → {n.nota}</p><p className="whitespace-pre-wrap">Comentário anterior: {antes?.comentarioAluno || "Sem comentário"}</p><p className="whitespace-pre-wrap">Comentário proposto: {n.comentarioAluno || "Sem comentário"}</p></div>; })}
      {p.decisao && <p className="whitespace-pre-wrap">{p.decisao.decisor.nome} · {formatarInstanteExibicao(p.decisao.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC): {p.decisao.motivo}</p>}
      {p.podeRevisar && <Link className="underline" href={`/academico/correcoes/${encodeURIComponent(lancamentoId)}/${encodeURIComponent(p.id)}`}>Conferir proposta e impactos</Link>}
    </article>)}
    <nav aria-label="Páginas de correções" className="flex gap-4">{d.pagina > 1 && <Link href={`?pagina=${d.pagina - 1}`}>Anterior</Link>}<span>Página {d.pagina}</span>{d.temProxima && <Link href={`?pagina=${d.pagina + 1}`}>Próxima</Link>}</nav>
  </section>;
}
