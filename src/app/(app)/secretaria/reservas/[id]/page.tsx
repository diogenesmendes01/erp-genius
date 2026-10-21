import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarResolucoesReserva } from "@/server/matricula/reserva-resolucao";
import { PrepararResolucao, DecidirResolucao } from "./Formularios";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { STATUS_RESERVA_VAGA_LABEL } from "@/lib/labels";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
export default async function ResolucaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const { id } = await params, filtros = await searchParams;
  const [resultado, preferencia] = await Promise.all([consultarResolucoesReserva({ reservaId: id, pagina: Number(filtros.pagina ?? 1) }), consultarPreferenciaFusoEquipe()]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const r = resultado.dado, fuso = r.reserva.janela.fusoAdmissao;
  // Prazo e horários são publicados no fuso da reserva (a proposta de novo prazo é digitada nele): mantêm esse fuso.
  const data = (d: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(d);
  // Registro da proposta e decisão são instantes: fuso pessoal de exibição; sem preferência, o da reserva.
  const preferido = preferencia.ok ? preferencia.dado?.fusoExibicao ?? null : null;
  const instante = (d: Date) => { const e = formatarInstanteExibicao(d, preferido, fuso); return `${e.texto} (${e.fuso})`; };
  return <div className="space-y-4"><VoltarPara href="/secretaria/reservas" /><h1 className="text-2xl font-medium">Resolução da reserva</h1>
    <p role="status">Estado atual: {STATUS_RESERVA_VAGA_LABEL[r.reserva.status]}</p>
    <p>Turma: {r.reserva.turma.codigo ?? r.reserva.turma.nome} · Prazo atual: {data(r.reserva.expiraEm)} · {fuso}</p>
    <Link href={`/secretaria?matriculaId=${r.reserva.matriculaId}`} className="underline">Conferir contratação</Link>
    <p>A proposta exige decisão de outra pessoa da Administração. Confira o tratamento da contratação antes de aprovar.</p>
    {r.podePreparar && <PrepararResolucao key={r.versaoAtual} reservaId={id} versao={r.versaoAtual} fuso={fuso} />}
    <h2 className="text-xl">Histórico de propostas</h2>{!r.registros.length && <EstadoVazio bloco>Nenhuma proposta registrada.</EstadoVazio>}
    {r.registros.map((p) => <section key={p.id} className="space-y-2 rounded border p-4"><h3 className="font-medium">Versão {p.versao} · {p.tipo === "PRORROGAR" ? "Prorrogar" : "Liberar vaga"}</h3>
      <p>Preparada por {p.preparador.nome} em {instante(p.criadaEm)}</p>{p.novoPrazo && <p>Novo prazo proposto: {data(p.novoPrazo)} · {fuso}</p>}
      <p className="whitespace-pre-wrap">Motivo: {p.motivo}</p><p className="whitespace-pre-wrap">Tratamento previsto: {p.tratamentoContratacao}</p>
      {p.decisao ? <div><p>{p.decisao.aprovada ? "Aprovada e aplicada" : "Rejeitada"} por {p.decisao.decisor.nome} em {instante(p.decisao.decididaEm)}</p><p className="whitespace-pre-wrap">{p.decisao.motivo}</p></div> : p.podeDecidir ? <DecidirResolucao propostaId={p.id} podeAprovar={p.podeAprovar} /> : <p>Aguardando decisão administrativa independente.</p>}
    </section>)}
    <nav aria-label="Páginas das propostas" className="flex gap-4">{r.pagina > 1 && <Link href={`?pagina=${r.pagina - 1}`}>Anterior</Link>}{r.possuiMais && <Link href={`?pagina=${r.pagina + 1}`}>Próxima</Link>}</nav>
  </div>;
}
