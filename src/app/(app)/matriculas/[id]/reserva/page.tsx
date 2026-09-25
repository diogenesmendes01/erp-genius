import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTurmasParaReserva } from "@/server/matricula/reserva-comercial";
import { ReservarFormulario } from "./ReservarFormulario";
import { VoltarPara } from "@/components/VoltarPara";
const motivos: Record<string, string> = { TURMA_CONCLUIDA: "Turma concluída", AGENDA_NAO_PUBLICADA: "Agenda ainda não publicada", PROFESSOR_INAPTO: "Professor ou encontros precisam de conferência", DISPONIBILIDADE_NAO_CONFERIDA: "Conflito de agenda ou indisponibilidade docente", LIMITE_NAO_CONFIGURADO: "Janela de entrada ainda não aprovada", JANELA_ENCERRADA: "Prazo de entrada encerrado", RESERVAS_NAO_CONFERIDAS: "Reservas precisam de conferência", SEM_VAGA: "Sem vaga disponível" };
export default async function ReservaContratacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  await exigirSessaoPagina(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  const { id } = await params, filtros = await searchParams;
  const resultado = await consultarTurmasParaReserva({ matriculaId: id, pagina: Number(filtros.pagina ?? 1) });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const r = resultado.dado;
  return <div className="space-y-4"><VoltarPara href={`/secretaria?matriculaId=${id}`} para="Contratação" /><h1 className="text-2xl font-medium">Reserva de vaga · {r.matricula.codigo ?? "Contratação em preparação"}</h1>
    <Link className="underline" href={`/matriculas/${id}/preparacao`}>Revisar proposta comercial</Link>
    <p>A disponibilidade será conferida novamente ao confirmar. Reservar não ativa a matrícula nem emite cobranças.</p>
    {r.reservas.map((v) => <section key={v.id} className="rounded border p-4"><p role="status">{v.status === "MANTIDA_PENDENCIA" ? "Vaga mantida por pendência" : "Reserva ativa"} · {v.turma.codigo ?? v.turma.nome}</p><p>Prazo: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: v.janela.fusoAdmissao }).format(v.expiraEm)} · {v.janela.fusoAdmissao}</p><p>A Secretaria acompanha a reserva e eventuais pendências.</p></section>)}
    {!r.prazoMinutos && <p role="alert">A Administração precisa configurar o prazo inicial de reserva.</p>}
    {!r.podeReservar && !r.reservas.length && r.prazoMinutos && <p>A situação da matrícula ou uma alocação existente impede nova reserva. Confira a contratação.</p>}
    {r.podeReservar && <><p>Prazo inicial: {r.prazoMinutos} minutos a partir da confirmação.</p><h2 className="text-xl">Turmas compatíveis</h2>
      {!r.registros.length && <p>Nenhuma turma nesta página.</p>}
      {r.registros.map((t) => <section key={t.id} className="rounded border p-3"><h3>{t.codigo ?? t.nome ?? "Turma sem código"}</h3><p>{t.vagas === null ? "Disponibilidade pendente" : `${t.vagas} vaga(s)`}{t.limiteEntrada ? ` · Entrada até ${t.limiteEntrada} (${t.fuso})` : ""}</p>{t.impedimentos.map((m) => <p key={m}>{motivos[m] ?? "Exige conferência"}</p>)}</section>)}
      <ReservarFormulario matriculaId={id} turmas={r.registros.filter((t) => t.elegivel).map((t) => ({ id: t.id, nome: t.codigo ?? t.nome ?? "Turma sem código" }))} />
      <nav aria-label="Páginas das turmas" className="flex gap-4">{r.pagina > 1 && <Link href={`?pagina=${r.pagina - 1}`}>Anterior</Link>}{r.possuiMais && <Link href={`?pagina=${r.pagina + 1}`}>Próxima</Link>}</nav>
    </>}
  </div>;
}
