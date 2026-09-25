import Link from "next/link";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarExcecoesAdmissao } from "@/server/matricula/excecao-admissao";
import { FormularioExcecao } from "./FormularioExcecao";
import { VoltarPara } from "@/components/VoltarPara";

const Resumo = z.object({ turmaId: z.string(), statusReserva: z.string(), expiraEm: z.string(), criadaEm: z.string(), janelaAtual: z.object({ limiteEntrada: z.string(), fusoAdmissao: z.string() }).nullable(),
  identificacao: z.object({ aluno: z.string(), matricula: z.string().nullable(), turma: z.string().nullable() }),
  encontros: z.array(z.object({ id: z.string(), inicio: z.string(), fim: z.string() })) });
function Cenario({ snapshot }: { snapshot: unknown }) {
  const p = Resumo.safeParse(snapshot);
  return p.success ? <div><p>{p.data.identificacao.aluno} · {p.data.identificacao.matricula ?? "Matrícula em preparação"} · {p.data.identificacao.turma ?? "Turma sem código"}</p><p>Reserva criada em {p.data.criadaEm}; prazo {p.data.expiraEm}.</p><p>Entrada até {p.data.janelaAtual?.limiteEntrada} ({p.data.janelaAtual?.fusoAdmissao}). {p.data.encontros.length} encontro(s) futuro(s) conferidos.</p>
    <details><summary>Agenda revisada</summary><ul>{p.data.encontros.map((e) => <li key={e.id}>{e.inicio} até {e.fim}</li>)}</ul></details></div> : <p role="alert">O cenário preservado precisa de conferência.</p>;
}
export default async function ExcecaoAdmissaoPage({ params, searchParams }: { params: Promise<{ reservaId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { reservaId } = await params, pagina = Number((await searchParams).pagina ?? "1");
  const r = await consultarExcecoesAdmissao({ reservaId, pagina });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <div className="space-y-4"><VoltarPara href="/academico/admissoes" para="Admissões" /><h1 className="text-2xl">Exceção de ingresso após o limite</h1>
    <p>A decisão vale somente para esta matrícula e reserva. Não ativa a matrícula, confirma pagamento ou amplia a janela das demais contratações.</p>
    {d.pendencia && <p role="alert">{d.pendencia}</p>}
    {d.revisao && <section><h2 className="text-xl">Cenário atual</h2><Cenario snapshot={d.revisao.snapshot} /><FormularioExcecao key={d.revisao.estadoHash} reservaId={reservaId} estadoHash={d.revisao.estadoHash} /></section>}
    <section className="space-y-3"><h2 className="text-xl">Propostas e decisões</h2>{!d.historico.length && <p>Nenhuma proposta registrada.</p>}
      {d.historico.map((p) => <article key={p.id} className="space-y-2 rounded border p-3"><p>{p.preparador.nome}, {p.criadaEm.toISOString()}.</p><p>{p.motivo}</p><p className="whitespace-pre-wrap">{p.parecerViabilidade}</p><Cenario snapshot={p.snapshot} />
        {p.decisao ? <p>{p.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {p.decisao.decisor.nome}: {p.decisao.motivo}. {d.revisao?.estadoHash === p.estadoHash ? "Cenário ainda corresponde à revisão atual." : "A decisão permanece no histórico; o cenário deve ser reavaliado."}</p>
          : d.podeDecidir && p.preparadorId !== d.autorId ? <FormularioExcecao reservaId={reservaId} propostaId={p.id} estadoHash={p.estadoHash} podeAprovar={d.revisao?.estadoHash === p.estadoHash} /> : <p>Aguarda decisão de outra pessoa da Gerência Pedagógica/Administração.</p>}
      </article>)}
      {pagina > 1 && <Link className="underline mr-4" href={`?pagina=${pagina - 1}`}>Anteriores</Link>}{d.temProxima && <Link className="underline" href={`?pagina=${pagina + 1}`}>Próximos</Link>}
    </section></div>;
}
