import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarReservasSecretaria, listarReservasParticularesSecretaria } from "@/server/matricula/reserva-painel";
import { ConferirReserva } from "./ConferirReserva";
export default async function ReservasPage({ searchParams }: { searchParams: Promise<{ pagina?: string; matriculaId?: string; historico?: string; tipo?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
  const filtros = await searchParams;
  const particular = filtros.tipo === "particular";
  const resultado = await (particular ? listarReservasParticularesSecretaria : listarReservasSecretaria)({ pagina: Number(filtros.pagina ?? 1), matriculaId: filtros.matriculaId || undefined, historico: filtros.historico === "todos" });
  if (!resultado.ok || !resultado.dado) return <div><Link href="/secretaria">Voltar à secretaria</Link><p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p></div>;
  const r = resultado.dado;
  const params = new URLSearchParams(); if (filtros.matriculaId) params.set("matriculaId", filtros.matriculaId);
  if (particular) params.set("tipo", "particular");
  const porTipo = (tipo: string) => { const p = new URLSearchParams(params); p.set("tipo", tipo); return `?${p}`; };
  const url = (pagina: number, todos = filtros.historico === "todos") => { const p = new URLSearchParams(params); p.set("pagina", String(pagina)); if (todos) p.set("historico", "todos"); return `?${p}`; };
  const estados = { ATIVA: "Reserva ativa", MANTIDA_PENDENCIA: "Reserva mantida por pendência", EXPIRADA: "Expirada", UTILIZADA: "Utilizada", LIBERADA: "Liberada" };
  return <div className="space-y-4"><Link href="/secretaria" className="underline">Voltar à secretaria</Link><h1 className="text-2xl font-medium">Reservas de matrícula</h1>
    <nav className="flex gap-4" aria-label="Tipo de reserva"><Link href={porTipo("turma")} aria-current={!particular ? "page" : undefined}>Turmas</Link><Link href={porTipo("particular")} aria-current={particular ? "page" : undefined}>Particulares</Link></nav>
    <p>Reservas ativas e mantidas por pendência ocupam vagas ou horários. Nas particulares, a conferência pode expirar a reserva sem avanço formal. Pagamentos, documentos e pendências exigem o tratamento aplicável; não há devolução ou cancelamento da contratação por esta conferência.</p>
    <nav className="flex gap-4"><Link href={url(1, false)}>Ocupantes</Link><Link href={url(1, true)}>Incluir histórico</Link></nav>
    {!r.registros.length && <p>Nenhuma reserva nesta consulta.</p>}
    {r.registros.map((v) => <section key={v.id} className="space-y-2 rounded border p-4">
      <h2 className="font-medium">{v.matricula.codigo ?? "Matrícula sem código"} · {[v.matricula.aluno.primeiroNome, v.matricula.aluno.sobrenome].filter(Boolean).join(" ")}</h2>
      <p>{v.referencia} · {estados[v.status]}</p>
      <p>Prazo: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: v.fuso ?? "UTC" }).format(v.expiraEm)} · {v.fuso ?? "UTC (fuso da reserva indisponível)"}{v.prazoVencido ? " · Prazo vencido" : ""}</p>
      {v.quantidadeHorarios !== null && <p>{v.quantidadeHorarios} horário(s) reservado(s). Consulte a preparação para os detalhes.</p>}
      <p className="whitespace-pre-wrap">{v.motivo}</p><Link className="underline" href={`/secretaria?matriculaId=${v.matriculaId}`}>Consultar contratação</Link>
      {v.podeConferir && <ConferirReserva reservaId={v.id} particular={v.particular} />}
      <div><Link className="underline" href={v.particular ? `/secretaria/reservas/particulares/${v.id}` : `/secretaria/reservas/${v.id}`}>Resolução e histórico da reserva</Link></div>
    </section>)}
    <nav aria-label="Páginas das reservas" className="flex gap-4">{r.pagina > 1 && <Link href={url(r.pagina - 1)}>Anterior</Link>}{r.possuiMais && <Link href={url(r.pagina + 1)}>Próxima</Link>}</nav>
  </div>;
}
