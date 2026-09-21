import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarMatriculasConferenciaAgendaAditivo } from "@/server/contratos/agenda-aditivo";

export default async function AgendaAditivoAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params, r = await listarMatriculasConferenciaAgendaAditivo({ alunoId: id });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  return <div className="space-y-5"><Link className="underline" href={`/alunos/${encodeURIComponent(id)}`}>Voltar à ficha do aluno</Link><h1 className="text-2xl">Conferir agenda para aditivo</h1><p>Escolha a matrícula particular ativa. A conferência não reserva nem altera agenda.</p>{r.dado.length ? <ul className="space-y-2">{r.dado.map(matricula => <li key={matricula.id} className="rounded border p-3"><Link className="underline" href={`/matriculas/${encodeURIComponent(matricula.id)}/contrato/aditivos/agenda`}>{matricula.produto.idioma.nome} · {matricula.produto.modalidade.nome}{matricula.codigo ? ` · ${matricula.codigo}` : ""}</Link></li>)}</ul> : <p role="status">Não há matrícula particular ativa com encontro futuro disponível.</p>}</div>;
}
