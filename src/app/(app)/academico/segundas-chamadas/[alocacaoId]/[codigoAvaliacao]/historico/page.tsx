import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarHistoricoReservasSegundaChamada } from "@/server/avaliacoes/segunda-chamada-historico";
const r: Record<string, string> = { RESERVADA: "Reservada", CONSUMIDA_REALIZACAO: "Realizada", CONSUMIDA_FALTA: "Falta registrada", CONSUMIDA_CANCELAMENTO_TARDIO: "Cancelamento fora do prazo", LIBERADA_CANCELAMENTO_ESCOLA: "Cancelamento pela escola", LIBERADA_CANCELAMENTO_TEMPESTIVO: "Cancelamento dentro do prazo", PENDENCIA_ESCOLA: "Impedimento pela escola", PREVISTO: "Previsto", MINISTRADO: "Ministrado", CANCELADO: "Cancelado", NAO_REALIZADO: "Não realizado", IMPEDIDO_ESCOLA: "Impedido pela escola" };
const data = (v: string, f: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: f }).format(new Date(v));
export default async function Page({ params, searchParams }: {
    params: Promise<{
        alocacaoId: string;
        codigoAvaliacao: string;
    }>;
    searchParams: Promise<{
        antesId?: string;
    }>;
}) { await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO); const { alocacaoId, codigoAvaliacao } = await params, { antesId } = await searchParams, q = await consultarHistoricoReservasSegundaChamada({ alocacaoId, codigoAvaliacao, ...(antesId ? { antesId } : {}) }); if (!q.ok || !q.dado)
    return <p role="alert">{q.ok ? "Consulta indisponível." : q.erro}</p>; const d = q.dado, base = `/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}`; return <section className="space-y-4"><Link className="underline" href={base}>Voltar à segunda chamada</Link><h1 className="text-2xl font-medium">Histórico de reservas · {codigoAvaliacao}</h1><p>Datas exibidas em {d.fusoExibicao}.</p>{d.itens.map(i => <article key={i.id} className="space-y-2 rounded border p-4"><p><strong>Reserva:</strong> {r[i.status] ?? i.status} · {data(i.reservadaEm, d.fusoExibicao)} · {i.reservadaPor}</p>{i.encontro && <p>Encontro: {data(i.encontro.inicio, d.fusoExibicao)} a {data(i.encontro.fim, d.fusoExibicao)} · {r[i.encontro.status] ?? i.encontro.status} · {i.encontro.professor}</p>}{i.ocorrencia && <div><p>Ocorrência: {r[i.ocorrencia.status] ?? i.ocorrencia.status} em {data(i.ocorrencia.ocorridaEm, d.fusoExibicao)} · {i.ocorrencia.registradaPor}</p><p>Registro: {data(i.ocorrencia.criadaEm, d.fusoExibicao)}</p><p>Motivo: {i.ocorrencia.motivo}</p><p>Evidência: {i.ocorrencia.evidencia}</p></div>}{i.realizacao && <div><p>Realização: {data(i.realizacao.realizadaEm, d.fusoExibicao)} · {i.realizacao.professor} · {i.realizacao.registradaPor}</p><p>Evidência: {i.realizacao.evidencia}</p></div>}</article>)}{!d.itens.length && <p>Nenhuma reserva registrada.</p>}<nav className="flex gap-4">{antesId && <Link className="underline" href={`${base}/historico`}>Primeira página</Link>}{d.proximoId && <Link className="underline" href={`${base}/historico?antesId=${encodeURIComponent(d.proximoId)}`}>Reservas anteriores</Link>}</nav></section>; }
