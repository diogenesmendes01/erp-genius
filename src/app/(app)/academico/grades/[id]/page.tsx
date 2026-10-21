import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostaGradeTurma } from "@/server/agenda/grade-consulta";
import { DecidirGrade } from "./DecidirGrade";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { formatarDataCivil } from "@/lib/data-civil";
import { VoltarPara } from "@/components/VoltarPara";

export default async function GradePage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params;
  const [r, preferencia] = await Promise.all([consultarPropostaGradeTurma({ propostaId: id }), consultarPreferenciaFusoEquipe()]);
  if (!r.ok || !r.dado) return <div><VoltarPara href="/academico/grades" /><p role="alert">{r.ok ? "Proposta indisponível." : r.erro}</p></div>;
  const p = r.dado, g = p.exibicao.grade, d = p.disponibilidade;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, p.fusoOrigem);
  const data = (v: string) => formatarInstanteExibicao(v, fusoExibicao, p.fusoOrigem).texto;
  const futuros = p.encontrosFuturos;
  const podePublicar = !p.necessitaNovaProposta && futuros && !!d?.professorApto && !d.reservas.length && !d.conflitos.length && !d.conflitosInternos.length && !d.indisponibilidades.length;
  return <div className="space-y-5">
    <VoltarPara href="/academico/grades" />
    <header><h1 className="text-2xl font-medium">{p.turmaCodigo} · Grade versão {p.versao}</h1><p>{p.decisao ? p.publicada ? "Publicada" : "Rejeitada" : "Aguardando decisão"}</p></header>
    <p className="whitespace-pre-wrap">{p.motivo}</p>
    <dl className="space-y-1">
      <div><dt className="inline font-medium">Horários exibidos em: </dt><dd className="inline">{fusoExibicao}; origem {p.fusoOrigem}</dd></div>
      <div><dt className="inline font-medium">Data inicial informada: </dt><dd className="inline">{formatarDataCivil(g.dataInicialInformada)}</dd></div>
      <div><dt className="inline font-medium">Primeira aula: </dt><dd className="inline">{data(g.primeiraAula)}</dd></div>
      <div><dt className="inline font-medium">Previsão de término: </dt><dd className="inline">{data(g.previsaoTermino)}</dd></div>
      <div><dt className="inline font-medium">Encontros: </dt><dd className="inline">{p.exibicao.origem.quantidadeAulas}, com {p.exibicao.origem.duracaoMinutos} minutos cada</dd></div>
    </dl>
    {p.pendencias.map((v) => <p role="alert" key={v}>{v}</p>)}
    {!p.decisao && !futuros && <p role="alert">Há encontros cujo início já passou. Revise a data inicial antes da publicação.</p>}
    {d && <section className="space-y-2 rounded border p-3"><h2 className="font-medium">Disponibilidade na conferência atual</h2>
      {!d.professorApto && <p role="alert">É necessário definir professor ativo e habilitado.</p>}
      {d.conflitos.map((c, i) => <p key={i}>Encontro {c.indiceEncontro + 1}: conflito de {c.professor ? "professor" : "turma"} com {data(c.inicioExistente)} a {data(c.fimExistente)}.</p>)}
      {d.conflitosInternos.map((c) => <p key={`${c.primeiro}-${c.segundo}`}>Encontros {c.primeiro + 1} e {c.segundo + 1} se sobrepõem.</p>)}
      {d.reservas.map((r) => <p key={r.id}>Horário particular reservado de {data(r.inicio.toISOString())} a {data(r.fim.toISOString())}.</p>)}
      {d.indisponibilidades.map((c, i) => <p key={i}>Encontro {c.indiceEncontro + 1}: professor indisponível de {data(c.inicio)} a {data(c.fim)}.</p>)}
      {podePublicar && <p>Sem conflitos nos encontros e indisponibilidades cadastrados. A aprovação confere novamente a disponibilidade.</p>}
    </section>}
    <details open><summary className="font-medium">Encontros da proposta</summary><ol className="mt-2 list-inside list-decimal space-y-1">{g.encontros.map((e) => <li key={e.inicio}>{data(e.inicio)} a {data(e.fim)}</li>)}</ol></details>
    {p.decisao && <p>Motivo da decisão: {p.decisao.motivo}</p>}
    {p.podeDecidir ? <DecidirGrade id={p.id} podePublicar={podePublicar} /> : !p.decisao && <p>A decisão exige outra pessoa da Gerência Pedagógica/Administração.</p>}
  </div>;
}
