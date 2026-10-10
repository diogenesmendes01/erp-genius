import Link from "next/link";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarExcecoesAdmissao } from "@/server/matricula/excecao-admissao";
import { FormularioExcecao } from "./FormularioExcecao";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { formatarDataCivil } from "@/lib/data-civil";

const Resumo = z.object({ turmaId: z.string(), statusReserva: z.string(), expiraEm: z.string(), criadaEm: z.string(), janelaAtual: z.object({ limiteEntrada: z.string(), fusoAdmissao: z.string() }).nullable(),
  identificacao: z.object({ aluno: z.string(), matricula: z.string().nullable(), turma: z.string().nullable() }),
  encontros: z.array(z.object({ id: z.string(), inicio: z.string(), fim: z.string() })) });
/**
 * Instantes do cenário no fuso de exibição, com a origem dita (docs/43 §6 item 6; docs/42 L1037): antes, os
 * instantes do snapshot e do histórico saíam em ISO cru. O limite de entrada é data civil da janela.
 */
function Cenario({ snapshot, fusoExibicao }: { snapshot: unknown; fusoExibicao: string }) {
  const p = Resumo.safeParse(snapshot);
  const quando = (valor: string) => formatarInstanteExibicao(valor, fusoExibicao, "UTC").texto;
  return p.success ? <div><p>{p.data.identificacao.aluno} · {p.data.identificacao.matricula ?? "Matrícula em preparação"} · {p.data.identificacao.turma ?? "Turma sem código"}</p><p>Reserva criada em {quando(p.data.criadaEm)}; prazo {quando(p.data.expiraEm)} ({fusoExibicao}; origem UTC).</p><p>Entrada até {formatarDataCivil(p.data.janelaAtual?.limiteEntrada.slice(0, 10))} ({p.data.janelaAtual?.fusoAdmissao ?? "janela sem fuso"}). {p.data.encontros.length} encontro(s) futuro(s) conferidos.</p>
    <details><summary>Agenda revisada ({fusoExibicao}; origem UTC)</summary><ul>{p.data.encontros.map((e) => <li key={e.id}>{quando(e.inicio)} até {quando(e.fim)}</li>)}</ul></details></div> : <p role="alert">O cenário preservado precisa de conferência.</p>;
}
export default async function ExcecaoAdmissaoPage({ params, searchParams }: { params: Promise<{ reservaId: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const { reservaId } = await params, pagina = Number((await searchParams).pagina ?? "1");
  const [r, preferencia] = await Promise.all([consultarExcecoesAdmissao({ reservaId, pagina }), consultarPreferenciaFusoEquipe()]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <div className="space-y-4"><VoltarPara href="/academico/admissoes" /><h1 className="text-2xl">Exceção de ingresso após o limite</h1>
    <p>A decisão vale somente para esta matrícula e reserva. Não ativa a matrícula, confirma pagamento ou amplia a janela das demais contratações.</p>
    {d.pendencia && <p role="alert">{d.pendencia}</p>}
    {d.revisao && <section><h2 className="text-xl">Cenário atual</h2><Cenario snapshot={d.revisao.snapshot} fusoExibicao={fusoExibicao} /><FormularioExcecao key={d.revisao.estadoHash} reservaId={reservaId} estadoHash={d.revisao.estadoHash} /></section>}
    <section className="space-y-3"><h2 className="text-xl">Propostas e decisões</h2>{!d.historico.length && <EstadoVazio>Nenhuma proposta registrada.</EstadoVazio>}
      {d.historico.map((p) => <article key={p.id} className="space-y-2 rounded border p-3"><p>{p.preparador.nome}, {formatarInstanteExibicao(p.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC).</p><p>{p.motivo}</p><p className="whitespace-pre-wrap">{p.parecerViabilidade}</p><Cenario snapshot={p.snapshot} fusoExibicao={fusoExibicao} />
        {p.decisao ? <p>{p.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {p.decisao.decisor.nome}: {p.decisao.motivo}. {d.revisao?.estadoHash === p.estadoHash ? "Cenário ainda corresponde à revisão atual." : "A decisão permanece no histórico; o cenário deve ser reavaliado."}</p>
          : d.podeDecidir && p.preparadorId !== d.autorId ? <FormularioExcecao reservaId={reservaId} propostaId={p.id} estadoHash={p.estadoHash} podeAprovar={d.revisao?.estadoHash === p.estadoHash} /> : <p>Aguarda decisão de outra pessoa da Gerência Pedagógica/Administração.</p>}
      </article>)}
      {pagina > 1 && <Link className="underline mr-4" href={`?pagina=${pagina - 1}`}>Anteriores</Link>}{d.temProxima && <Link className="underline" href={`?pagina=${pagina + 1}`}>Próximos</Link>}
    </section></div>;
}
