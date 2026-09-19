import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDesignacoesSegundaChamada } from "@/server/avaliacoes/segunda-chamada-designacao-consulta";
import { Formulario } from "./Formulario";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

export default async function Designacao({ params, searchParams }: {
  params: Promise<{ propostaId: string }>;
  searchParams: Promise<{ depoisVersao?: string; busca?: string }>;
}) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
  const { propostaId } = await params;
  const { depoisVersao, busca } = await searchParams;
  const pagina = Number(depoisVersao);
  const [r, preferencia] = await Promise.all([
    consultarDesignacoesSegundaChamada({
      propostaId,
      ...(Number.isInteger(pagina) && pagina > 0 ? { depoisVersao: pagina } : {}),
      ...(busca ? { busca } : {}),
    }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;

  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const data = (valor: Date | string) => formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto;
  const atualVigente = d.atual && d.vigenteProfessorId === d.atual.professor.id;
  return <section className="space-y-4">
    <Link className="underline" href="/academico/avaliacoes">Avaliações</Link>
    <h1 className="text-2xl font-medium">Designação da segunda chamada · {d.codigoAvaliacao}</h1>
    <p>{d.identificacao.aluno} · matrícula {d.identificacao.matriculaCodigo ?? d.identificacao.matriculaId} · {d.identificacao.turma}.</p>
    <p>Não altera o professor de encontro já publicado. Para regularizar uma aplicação registrada por outra pessoa, use a designação da avaliação.</p>
    {d.atual ? <p>
      Última designação: {d.atual.professor.nome} · {data(d.atual.inicio)} até {d.atual.fim ? data(d.atual.fim) : "sem término"} ({fusoExibicao}; origem UTC).
      {atualVigente ? " É a designação vigente." : " Não está vigente agora."}
    </p> : <p>Nenhuma designação registrada.</p>}
    <form>
      <label>Buscar professor<input name="busca" defaultValue={d.busca} className="ml-2 rounded border p-2" /></label>
      <button className="ml-2 rounded border p-2">Buscar</button>
    </form>
    {d.refinarBusca && <p>Mostrando os primeiros 50 resultados. Refine a busca.</p>}
    {d.podeDesignar && <Formulario propostaId={d.propostaId} professores={d.professores} />}
    <h2 className="text-xl font-medium">Histórico</h2>
    {d.historico.map(h => <article key={h.id} className="rounded border p-3">
      <p>Versão {h.versao} · {h.professor.nome} · registrada por {h.gestor.nome} em {data(h.criadaEm)} ({fusoExibicao}; origem UTC)</p>
      <p>Vigência: {data(h.inicio)} até {h.fim ? data(h.fim) : "sem término"} ({fusoExibicao}; origem UTC).</p>
      <p>{h.motivo}</p>
    </article>)}
    {!d.historico.length && <p>Nenhuma designação registrada.</p>}
    <nav className="flex gap-4" aria-label="Paginação do histórico">
      {depoisVersao && <Link className="underline" href={busca ? `?busca=${encodeURIComponent(busca)}` : "?"}>Primeira página</Link>}
      {d.proximaVersao && <Link className="underline" href={`?depoisVersao=${d.proximaVersao}${busca ? `&busca=${encodeURIComponent(busca)}` : ""}`}>Designações anteriores</Link>}
    </nav>
  </section>;
}
