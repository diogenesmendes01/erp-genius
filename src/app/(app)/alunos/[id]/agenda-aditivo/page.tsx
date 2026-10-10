import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { listarMatriculasConferenciaAgendaAditivo } from "@/server/contratos/agenda-aditivo";
import { consultarIdentificacaoAluno } from "@/server/identificacao-registro";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro";

// A agenda é de um aluno: a tela diz de quem (docs/42 L268; docs/43 §6 item 7). Em erro, o cabeçalho e a
// volta à ficha ficam — só o corpo vira o alerta (docs/42 L269).
export default async function AgendaAditivoAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params;
  const [r, identificacao] = await Promise.all([listarMatriculasConferenciaAgendaAditivo({ alunoId: id }), consultarIdentificacaoAluno(usuario, id)]);
  return <div className="space-y-5"><VoltarPara href={`/alunos/${encodeURIComponent(id)}`} para="Ficha do aluno" /><h1 className="text-2xl">Conferir agenda para aditivo</h1>
    {identificacao && <IdentificacaoRegistro rotulo="Aluno desta agenda" dados={{ aluno: identificacao.aluno, alunoHref: `/alunos/${encodeURIComponent(identificacao.alunoId)}`, registro: ["Matrículas particulares ativas com encontro futuro"] }} />}
    {!r.ok || !r.dado ? <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p> : <>
      <p>Escolha a matrícula particular ativa. A conferência não reserva nem altera agenda.</p>
      {r.dado.length ? <ul className="space-y-2">{r.dado.map(matricula => <li key={matricula.id} className="rounded border p-3"><Link className="underline" href={`/matriculas/${encodeURIComponent(matricula.id)}/contrato/aditivos/agenda`}>{matricula.produto.idioma.nome} · {matricula.produto.modalidade.nome}{matricula.codigo ? ` · ${matricula.codigo}` : ""}</Link></li>)}</ul> : <EstadoVazio bloco role="status">Não há matrícula particular ativa com encontro futuro disponível.</EstadoVazio>}
    </>}
  </div>;
}
