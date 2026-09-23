import Link from "next/link";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarCancelamentosAgendaSegundaChamada } from "@/server/avaliacoes/segunda-chamada-cancelamento";
import { Formulario } from "./Formulario";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { consultarFusoInstitucional } from "@/server/operacao/consultas";
const fonte = z.object({ reserva: z.object({ codigoAvaliacao: z.string(), status: z.string(), regraCancelamentoMinutos: z.number() }), encontro: z.object({ inicio: z.string(), fim: z.string(), fusoOrigem: z.string(), status: z.string() }).nullable() });
function Agenda({ valor, preferencia }: { valor: unknown; preferencia: string | null }) {
 const r = fonte.safeParse(valor);
 if (!r.success || !r.data.encontro) return <p role="alert">Agenda sem informação suficiente para conferência.</p>;
 const e = r.data.encontro;
 const fuso=resolverFusoExibicao(preferencia,e.fusoOrigem), data=(v:string)=>formatarInstanteExibicao(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`,fuso,e.fusoOrigem).texto;
 return <p>Avaliação {r.data.reserva.codigoAvaliacao} · {data(e.inicio)} até {data(e.fim)} ({fuso}; origem {e.fusoOrigem}). Encontro: {e.status}. Reserva: {r.data.reserva.status}. Antecedência de cancelamento: {r.data.reserva.regraCancelamentoMinutos} minutos.</p>;
}
function Efeito({ snapshot, origem, ocorridaEm }: { snapshot: unknown; origem: string; ocorridaEm: string }) {
 const r = fonte.safeParse(snapshot);
 if (!r.success || !r.data.encontro) return null;
 const v = r.data.encontro.inicio;
 const inicio = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`).getTime();
 const tempestivo = new Date(ocorridaEm).getTime() <= inicio - r.data.reserva.regraCancelamentoMinutos * 60000;
 return <p className="font-medium">Efeito proposto: {origem === "ESCOLA" || tempestivo ? "liberar a oportunidade" : "consumir a oportunidade por cancelamento tardio"} e cancelar o encontro. A aprovação confere novamente a agenda.</p>;
}
export default async function Page({ params, searchParams }: { params: Promise<{ reservaId: string }>; searchParams: Promise<{ beforeId?: string }> }) {
 await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
 const { reservaId } = await params, { beforeId } = await searchParams;
 const [r, preferencia, fusoInstitucional] = await Promise.all([consultarCancelamentosAgendaSegundaChamada({ reservaId, beforeId }), consultarPreferenciaFusoEquipe(), consultarFusoInstitucional()]);
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
 const d = r.dado;
 return <section className="space-y-4">
 <Link href="/academico" className="underline">Acadêmico</Link>
 <h1 className="text-2xl font-medium">Cancelar segunda chamada</h1>
 <p>{d.identificacao.aluno} · Matrícula {d.identificacao.matriculaCodigo ?? "sem código"} · {d.identificacao.turma} · {d.identificacao.nivel}</p>
 <p>A aprovação independente cancela este encontro. Cancelamento pela escola ou pedido do aluno dentro da antecedência devolve a oportunidade; pedido tardio do aluno consome. Vale a data original do pedido, não a data da aprovação. Não cria nota, presença ou cobrança.</p>
 <h2 className="font-medium">Agenda atual</h2><Agenda valor={d.atual} preferencia={preferencia.ok ? preferencia.dado?.fusoExibicao ?? null : null} />
 {d.podePropor && <Formulario reservaId={reservaId} estadoConferido={d.estadoConferido} fusoInstitucional={fusoInstitucional} />}
 <h2 className="font-medium">Propostas e decisões</h2>
 {d.propostas.map(p => <article key={p.id} className="space-y-3 rounded border p-4">
 <p>Origem: {p.origem === "ALUNO" ? "aluno" : "escola"}. Proposta de {p.autorNome}. Ocorrência informada: {formatarInstanteExibicao(p.ocorridaEm, resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC"), "UTC").texto} ({resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC")}; origem UTC).</p>
 <p>Motivo: {p.motivo}</p><p>Evidência: {p.evidencia}</p><Agenda valor={p.snapshot} preferencia={preferencia.ok ? preferencia.dado?.fusoExibicao ?? null : null} /><Efeito snapshot={p.snapshot} origem={p.origem} ocorridaEm={p.ocorridaEm} />
 {p.decisao ? <p role="status">{p.decisao.aprovada ? "Aprovado e aplicado" : "Rejeitado"} por {p.decisao.decisorNome}: {p.decisao.motivo}</p> : <p>Aguardando decisão de outra pessoa autorizada. Alterações posteriores na agenda exigem nova proposta.</p>}
 {p.podeDecidir && <Formulario reservaId={reservaId} estadoConferido={d.estadoConferido} proposta={{ id: p.id, hash: p.entradaHash }} fusoInstitucional={fusoInstitucional} />}
 </article>)}
 {!d.propostas.length && <p>Nenhuma proposta registrada.</p>}
 {d.proximoId && <Link className="underline" href={`?beforeId=${encodeURIComponent(d.proximoId)}`}>Propostas anteriores</Link>}
 {beforeId && <Link className="block underline" href={`/academico/segundas-chamadas/reservas/${encodeURIComponent(reservaId)}/cancelamento`}>Propostas mais recentes</Link>}
 </section>;
}
