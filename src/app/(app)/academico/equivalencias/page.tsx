import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { listarPropostasEquivalencia } from "@/server/avaliacoes/equivalencia-consulta";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";

const turma = (dado: { codigo: string | null; nome: string | null }) => dado.codigo ?? dado.nome ?? "Turma sem identificação";
const nomesEstado = { PENDENTE: "Aguardando decisão", APROVADA: "Autorizada para execução", REJEITADA: "Rejeitada", APLICADA: "Transferência efetivada" } as const;
const nomeEstado = (estado: string) => estado in nomesEstado ? nomesEstado[estado as keyof typeof nomesEstado] : "Estado em conferência";

export default async function EquivalenciasPage({ searchParams }: { searchParams: Promise<{ matriculaId?: string; cursor?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA);
  const { matriculaId, cursor } = await searchParams;
  if (!matriculaId) return <section className="space-y-3"><Link className="underline" href="/academico">Voltar ao acompanhamento acadêmico</Link><p role="alert">Selecione uma matrícula para consultar propostas de aproveitamento.</p></section>;
  const [resultado, preferencia] = await Promise.all([
    listarPropostasEquivalencia({ matriculaId, ...(cursor ? { cursor } : {}) }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <section className="space-y-3"><Link className="underline" href="/academico">Voltar ao acompanhamento acadêmico</Link><p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p></section>;
  const itens = resultado.dado.itens;
  const autorizadas = itens.filter((item) => item.estado === "APROVADA");
  const historico = itens.filter((item) => item.estado !== "APROVADA");
  const secretaria = temPapel(usuario, Papel.SECRETARIA_ACADEMICA) && !temPapel(usuario, Papel.GERENTE_PEDAGOGICO);
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const fusoExibicao = resolverFusoExibicao(preferenciaFusoExibicao, "America/Sao_Paulo");

  const lista = (propostas: typeof itens) => <div className="space-y-3">{propostas.map((proposta) => <article key={proposta.id} className="space-y-2 rounded border p-4">
    <header className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-medium">Versão {proposta.versao}</h2><p className="text-sm">{turma(proposta.turmaOrigem)} → {turma(proposta.turmaDestino)}</p></div><span className="rounded bg-gray-100 px-2 py-1 text-xs">{nomeEstado(proposta.estado)}</span></header>
    <p className="text-sm">Preparada em {formatarInstanteExibicao(proposta.criadaEm, preferenciaFusoExibicao, "America/Sao_Paulo").texto} (horário exibido em {fusoExibicao}).</p>
    <p className="whitespace-pre-wrap text-sm">{proposta.motivo}</p>
    <Link className="inline-block underline" href={`/academico/equivalencias/${encodeURIComponent(proposta.id)}`}>{proposta.estado === "APROVADA" ? "Conferir e efetivar autorização" : "Consultar proposta"}</Link>
  </article>)}</div>;

  return <section className="space-y-5">
    <Link className="underline" href="/academico">Voltar ao acompanhamento acadêmico</Link>
    <header className="space-y-2"><h1 className="text-2xl font-medium">Propostas de aproveitamento</h1><p>{secretaria ? "Fila de autorizações da matrícula. A execução é conferida novamente ao abrir cada proposta." : "Histórico e fila de propostas de aproveitamento desta matrícula."}</p></header>
    <section className="space-y-3"><h2 className="text-xl font-medium">Autorizações aguardando execução</h2>{autorizadas.length ? lista(autorizadas) : <p>Nenhuma proposta autorizada aguarda execução nesta página.</p>}</section>
    {historico.length > 0 && <section className="space-y-3"><h2 className="text-xl font-medium">Outras propostas</h2>{lista(historico)}</section>}
    {!itens.length && <p>Nenhuma proposta de aproveitamento foi encontrada para esta matrícula.</p>}
    {resultado.dado.proximoCursor && <Link className="inline-block underline" href={`/academico/equivalencias?${new URLSearchParams({ matriculaId, cursor: resultado.dado.proximoCursor })}`}>Próximas propostas</Link>}
  </section>;
}
