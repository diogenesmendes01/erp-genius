import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarAlunosPagina, opcoesFiltroAlunos, podeVerFinanceiroAluno } from "@/server/alunos/consultas";
import { redirect } from "next/navigation";
import { destinoPaginaAlunos, filtrosParaQuery, lerFiltrosAlunos, sanearFiltrosAlunos } from "@/server/alunos/filtros";
import { exigirSessao } from "@/server/_shared";
import { podeCriarMatricula } from "@/server/matricula/permissoes";
import { AlunosLista } from "../AlunosLista";
import { ExportarPlanilha } from "@/components/ExportarPlanilha";

const PAPEIS_ALUNOS: Papel[] = [
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_PEDAGOGICO,
  Papel.FINANCEIRO,
  Papel.PROFESSOR,
];

export default async function AlunosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const papeis = await exigirPapelLeitura(...PAPEIS_ALUNOS);
  if (!papeis) return <AcessoNegado recurso="os alunos" />;

  const lidos = lerFiltrosAlunos(await searchParams);
  const usuario = await exigirSessao();
  const opcoes = await opcoesFiltroAlunos(usuario);
  const filtros = sanearFiltrosAlunos(lidos, opcoes);
  const pagina = await listarAlunosPagina(usuario, filtros);
  const destino = destinoPaginaAlunos(filtros, pagina.total);
  if (destino) redirect(destino);
  const podeCadastrar = podeCriarMatricula(usuario.papeis);
  const podeImportar = usuario.papeis.includes(Papel.ADMINISTRADOR);
  return <>
    <div className="mb-3 flex justify-end"><ExportarPlanilha tipo="alunos" query={filtrosParaQuery(filtros, { semPagina: true })} /></div>
    <AlunosLista
      alunos={pagina.itens}
      total={pagina.total}
      totalBase={pagina.totalBase}
      filtros={filtros}
      opcoes={opcoes}
      exibirFinanceiro={podeVerFinanceiroAluno(usuario)}
      podeCadastrar={podeCadastrar}
      podeImportar={podeImportar}
    />
  </>;
}
