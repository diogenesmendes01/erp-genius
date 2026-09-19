import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina, temPapel } from "@/server/_shared";
import { listarSolicitacoesAcademicas } from "@/server/academico/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { MudancasAcademicasPainel } from "./MudancasAcademicasPainel";

export default async function AcademicoPage({ searchParams }: { searchParams: Promise<{ historico?: string; antesDe?: string }> }) {
  const usuario = await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR);
  const filtros = await searchParams;
  const todas = filtros.historico === "todos";
  const [resultado, preferencia] = await Promise.all([
    listarSolicitacoesAcademicas({ apenasAbertas: !todas, antesDe: filtros.antesDe }),
    consultarPreferenciaFusoEquipe(),
  ]);
  const dados = resultado.ok ? resultado.dado : null;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "America/Sao_Paulo");
  return <div className="space-y-5">
    {(temPapel(usuario, Papel.PROFESSOR) || temPapel(usuario, Papel.GERENTE_PEDAGOGICO)) && <Link className="text-sm text-brand-700 underline" href="/academico/avaliacoes">Avaliações por matrícula</Link>}
    {temPapel(usuario, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR) && <><Link className="text-sm text-brand-700 underline" href="/academico/segundas-chamadas/pendentes-agenda">Segundas chamadas pendentes de agenda</Link><Link className="text-sm text-brand-700 underline" href="/academico/segundas-chamadas/agendas">Agendas de segunda chamada</Link></>}
    {temPapel(usuario, Papel.GERENTE_PEDAGOGICO) && <Link className="text-sm text-brand-700 underline" href="/academico/regras">Regras de avaliação</Link>}
    {temPapel(usuario, Papel.GERENTE_PEDAGOGICO) && <Link className="text-sm text-brand-700 underline" href="/academico/correcoes">Revisões após correção de nota</Link>}
    {temPapel(usuario, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO) && <Link className="text-sm text-brand-700 underline" href="/academico/reposicoes">Reposições individuais de frequência</Link>}
    <Link className="text-sm text-brand-700 underline" href="/academico/indisponibilidades">Indisponibilidades docentes</Link>
    <Link className="text-sm text-brand-700 underline" href="/academico/grades">Grades das turmas</Link>
    {temPapel(usuario, Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR) && <Link className="text-sm text-brand-700 underline" href="/academico/modalidades/quantidade">Revisar quantidade de aulas da modalidade</Link>}
    <Link className="text-sm text-brand-700 underline" href="/diario/encontros">Encontros e cancelamentos de particulares</Link>
    <Link className="text-sm text-brand-700 underline" href="/academico/calendario">Calendário da escola</Link>
    <Link className="text-sm text-brand-700 underline" href="/academico/admissoes">Janelas de admissão</Link>
    <header><h1 className="text-2xl font-medium">Mudanças acadêmicas</h1><p className="mt-1 text-sm text-gray-500">Acompanhe pareceres, decisões pedagógicas e execução pela secretaria.</p></header>
    <nav aria-label="Filtro das solicitações acadêmicas" className="flex gap-3 text-sm"><Link href="/academico" className={!todas ? "font-medium text-brand-700" : "text-gray-500"} aria-current={!todas ? "page" : undefined}>Abertas</Link><Link href="/academico?historico=todos" className={todas ? "font-medium text-brand-700" : "text-gray-500"} aria-current={todas ? "page" : undefined}>Incluir histórico</Link></nav>
    <MudancasAcademicasPainel solicitacoes={dados?.solicitacoes ?? []} erroConsulta={resultado.ok ? null : resultado.erro} fusoExibicao={fusoExibicao} />
    {dados?.proximo && <Link className="inline-block text-sm text-brand-700 underline" href={`/academico?${todas ? "historico=todos&" : ""}antesDe=${encodeURIComponent(dados.proximo)}`}>Próximas solicitações</Link>}
  </div>;
}


