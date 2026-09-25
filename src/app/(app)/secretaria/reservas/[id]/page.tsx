import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarResolucoesReserva } from "@/server/matricula/reserva-resolucao";
import { PrepararResolucao, DecidirResolucao } from "./Formularios";
import { VoltarPara } from "@/components/VoltarPara";
export default async function ResolucaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id } = await params, filtros = await searchParams;
  const resultado = await consultarResolucoesReserva({ reservaId: id, pagina: Number(filtros.pagina ?? 1) });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const r = resultado.dado, fuso = r.reserva.janela.fusoAdmissao;
  const estados = { ATIVA: "Reserva ativa", MANTIDA_PENDENCIA: "Vaga mantida por pendência", EXPIRADA: "Reserva expirada", UTILIZADA: "Reserva utilizada", LIBERADA: "Vaga liberada" };
  const data = (d: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(d);
  return <div className="space-y-4"><VoltarPara href="/secretaria/reservas" /><h1 className="text-2xl font-medium">Resolução da reserva</h1>
    <p role="status">Estado atual: {estados[r.reserva.status]}</p>
    <p>Turma: {r.reserva.turma.codigo ?? r.reserva.turma.nome} · Prazo atual: {data(r.reserva.expiraEm)} · {fuso}</p>
    <Link href={`/secretaria?matriculaId=${r.reserva.matriculaId}`} className="underline">Conferir contratação</Link>
    <p>A proposta exige decisão de outra pessoa da Administração. Confira o tratamento da contratação antes de aprovar.</p>
    {r.podePreparar && <PrepararResolucao key={r.versaoAtual} reservaId={id} versao={r.versaoAtual} fuso={fuso} />}
    <h2 className="text-xl">Histórico de propostas</h2>{!r.registros.length && <p>Nenhuma proposta registrada.</p>}
    {r.registros.map((p) => <section key={p.id} className="space-y-2 rounded border p-4"><h3 className="font-medium">Versão {p.versao} · {p.tipo === "PRORROGAR" ? "Prorrogar" : "Liberar vaga"}</h3>
      <p>Preparada por {p.preparador.nome} em {data(p.criadaEm)}</p>{p.novoPrazo && <p>Novo prazo proposto: {data(p.novoPrazo)} · {fuso}</p>}
      <p className="whitespace-pre-wrap">Motivo: {p.motivo}</p><p className="whitespace-pre-wrap">Tratamento previsto: {p.tratamentoContratacao}</p>
      {p.decisao ? <div><p>{p.decisao.aprovada ? "Aprovada e aplicada" : "Rejeitada"} por {p.decisao.decisor.nome} em {data(p.decisao.decididaEm)}</p><p className="whitespace-pre-wrap">{p.decisao.motivo}</p></div> : p.podeDecidir ? <DecidirResolucao propostaId={p.id} podeAprovar={p.podeAprovar} /> : <p>Aguardando decisão administrativa independente.</p>}
    </section>)}
    <nav aria-label="Páginas das propostas" className="flex gap-4">{r.pagina > 1 && <Link href={`?pagina=${r.pagina - 1}`}>Anterior</Link>}{r.possuiMais && <Link href={`?pagina=${r.pagina + 1}`}>Próxima</Link>}</nav>
  </div>;
}
