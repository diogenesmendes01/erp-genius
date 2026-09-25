import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarHistoricoReservasSegundaChamada } from "@/server/avaliacoes/segunda-chamada-historico";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { STATUS_ENCONTRO_LABEL } from "@/lib/labels";

const rotulos: Record<string, string> = {
  RESERVADA: "Reservada", CONSUMIDA_REALIZACAO: "Realizada", CONSUMIDA_FALTA: "Falta registrada",
  CONSUMIDA_CANCELAMENTO_TARDIO: "Cancelamento fora do prazo", LIBERADA_CANCELAMENTO_ESCOLA: "Cancelamento pela escola",
  LIBERADA_CANCELAMENTO_TEMPESTIVO: "Cancelamento dentro do prazo", PENDENCIA_ESCOLA: "Impedimento pela escola",
  ...STATUS_ENCONTRO_LABEL,
};

export default async function Page({ params, searchParams }: {
  params: Promise<{ alocacaoId: string; codigoAvaliacao: string }>;
  searchParams: Promise<{ antesId?: string }>;
}) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId, codigoAvaliacao } = await params;
  const { antesId } = await searchParams;
  const [q, preferencia] = await Promise.all([
    consultarHistoricoReservasSegundaChamada({ alocacaoId, codigoAvaliacao, ...(antesId ? { antesId } : {}) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!q.ok || !q.dado) return <p role="alert">{q.ok ? "Consulta indisponível." : q.erro}</p>;
  const d = q.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, d.fusoExibicao);
  const data = (valor: string) => formatarInstanteExibicao(valor, preferencia.ok ? preferencia.dado?.fusoExibicao : null, d.fusoExibicao).texto;
  const base = `/academico/segundas-chamadas/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigoAvaliacao)}`;
  return <section className="space-y-4">
    <VoltarPara href={base} para="Segunda chamada" />
    <h1 className="text-2xl font-medium">Histórico de reservas · {codigoAvaliacao}</h1>
    <p>Instantes exibidos em {fusoExibicao} (referência institucional {d.fusoExibicao}).</p>
    {d.itens.map((item) => <article key={item.id} className="space-y-2 rounded border p-4">
      <p><strong>Reserva:</strong> {rotulos[item.status] ?? item.status} · {data(item.reservadaEm)} · {item.reservadaPor}</p>
      {item.encontro && <p>Encontro: {data(item.encontro.inicio)} a {data(item.encontro.fim)} · {rotulos[item.encontro.status] ?? item.encontro.status} · {item.encontro.professor}</p>}
      {item.ocorrencia && <div><p>Ocorrência: {rotulos[item.ocorrencia.status] ?? item.ocorrencia.status} em {data(item.ocorrencia.ocorridaEm)} · {item.ocorrencia.registradaPor}</p><p>Registro: {data(item.ocorrencia.criadaEm)}</p><p>Motivo: {item.ocorrencia.motivo}</p><p>Evidência: {item.ocorrencia.evidencia}</p></div>}
      {item.realizacao && <div><p>Realização: {data(item.realizacao.realizadaEm)} · {item.realizacao.professor} · {item.realizacao.registradaPor}</p><p>Evidência: {item.realizacao.evidencia}</p></div>}
    </article>)}
    {!d.itens.length && <p>Nenhuma reserva registrada.</p>}
    <nav className="flex gap-4">{antesId && <Link className="underline" href={`${base}/historico`}>Primeira página</Link>}{d.proximoId && <Link className="underline" href={`${base}/historico?antesId=${encodeURIComponent(d.proximoId)}`}>Reservas anteriores</Link>}</nav>
  </section>;
}