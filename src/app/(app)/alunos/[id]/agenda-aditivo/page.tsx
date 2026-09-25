import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarMatriculasConferenciaAgendaAditivo } from "@/server/contratos/agenda-aditivo";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function AgendaAditivoAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params, r = await listarMatriculasConferenciaAgendaAditivo({ alunoId: id });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  return <div className="space-y-5"><VoltarPara href={`/alunos/${encodeURIComponent(id)}`} para="Ficha do aluno" /><h1 className="text-2xl">Conferir agenda para aditivo</h1><p>Escolha a matrícula particular ativa. A conferência não reserva nem altera agenda.</p>{r.dado.length ? <ul className="space-y-2">{r.dado.map(matricula => <li key={matricula.id} className="rounded border p-3"><Link className="underline" href={`/matriculas/${encodeURIComponent(matricula.id)}/contrato/aditivos/agenda`}>{matricula.produto.idioma.nome} · {matricula.produto.modalidade.nome}{matricula.codigo ? ` · ${matricula.codigo}` : ""}</Link></li>)}</ul> : <EstadoVazio bloco role="status">Não há matrícula particular ativa com encontro futuro disponível.</EstadoVazio>}</div>;
}
