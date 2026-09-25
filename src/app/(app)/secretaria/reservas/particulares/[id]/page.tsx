import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarResolucoesParticulares } from "@/server/matricula/reserva-particular-resolucao";
import { PrepararResolucao, DecidirResolucao } from "../../[id]/Formularios";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
export default async function ResolucaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id } = await params, filtros = await searchParams;
  const resultado = await consultarResolucoesParticulares({ reservaId: id, pagina: Number(filtros.pagina ?? 1) });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const r = resultado.dado, fuso = r.reserva.horarios[0]?.fusoOrigem ?? "UTC";
  const estados = { ATIVA: "Reserva ativa", MANTIDA_PENDENCIA: "Horários mantidos por pendência", EXPIRADA: "Reserva expirada", UTILIZADA: "Reserva utilizada", LIBERADA: "Horários liberados" };
  const data = (d: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(d);
  return <div className="space-y-4"><VoltarPara href="/secretaria/reservas?tipo=particular" /><h1 className="text-2xl font-medium">Resolução da reserva particular</h1>
    <p role="status">Estado atual: {estados[r.reserva.status]}</p>
    <p>Prazo atual: {data(r.reserva.expiraEm)} · {fuso}</p>
    {r.pendenciaProrrogacao && <p role="alert">Prorrogação pendente: {r.pendenciaProrrogacao}</p>}
    <ul>{r.reserva.horarios.map((h) => <li key={h.id}>{h.professor.nome} · {data(h.inicio)} — {data(h.fim)} · {fuso}</li>)}</ul>
    <Link href={`/secretaria?matriculaId=${r.reserva.matriculaId}`} className="underline">Conferir contratação</Link>
    <p>A proposta exige decisão de outra pessoa da Administração. Confira o tratamento da contratação antes de aprovar.</p>
    {r.podePreparar && <PrepararResolucao key={r.versaoAtual} reservaId={id} versao={r.versaoAtual} fuso={fuso} particular />}
    <h2 className="text-xl">Histórico de propostas</h2>{!r.registros.length && <EstadoVazio bloco>Nenhuma proposta registrada.</EstadoVazio>}
    {r.registros.map((p) => <section key={p.id} className="space-y-2 rounded border p-4"><h3 className="font-medium">Versão {p.versao} · {p.tipo === "PRORROGAR" ? "Prorrogar" : "Liberar horários"}</h3>
      <p>Preparada por {p.preparador.nome} em {data(p.criadaEm)}</p>{p.novoPrazo && <p>Novo prazo proposto: {data(p.novoPrazo)} · {fuso}</p>}
      <p className="whitespace-pre-wrap">Motivo: {p.motivo}</p><p className="whitespace-pre-wrap">Tratamento previsto: {p.tratamentoContratacao}</p>
      {p.decisao ? <div><p>{p.decisao.aprovada ? "Aprovada e aplicada" : "Rejeitada"} por {p.decisao.decisor.nome} em {data(p.decisao.decididaEm)}</p><p className="whitespace-pre-wrap">{p.decisao.motivo}</p></div> : p.podeDecidir ? <DecidirResolucao propostaId={p.id} podeAprovar={p.podeAprovar} particular /> : <p>Aguardando decisão administrativa independente.</p>}
    </section>)}
    <nav aria-label="Páginas das propostas" className="flex gap-4">{r.pagina > 1 && <Link href={`?pagina=${r.pagina - 1}`}>Anterior</Link>}{r.possuiMais && <Link href={`?pagina=${r.pagina + 1}`}>Próxima</Link>}</nav>
  </div>;
}
