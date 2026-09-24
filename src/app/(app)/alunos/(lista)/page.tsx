import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarAlunosPagina, opcoesFiltroAlunos, podeVerFinanceiroAluno } from "@/server/alunos/consultas";
import { filtrosParaQuery, lerFiltrosAlunos } from "@/server/alunos/filtros";
import { exigirSessao } from "@/server/_shared";
import { podeCriarMatricula } from "@/server/matricula/permissoes";
import { AlunosLista } from "../AlunosLista";
import { ExportarPlanilha } from "@/components/ExportarPlanilha";

// Guard server-side por papel ANTES de buscar dados de alunos (issue #1).
// Papéis alinhados ao nav.ts; Administrador passa sempre (exigirPapelLeitura).
const PAPEIS_ALUNOS: Papel[] = [
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_PEDAGOGICO,
  Papel.FINANCEIRO,
  Papel.PROFESSOR,
];

export default async function AlunosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Guard de leitura por papel (UX AcessoNegado). Lista de alunos (doc 07 / nav):
  // Admin, Secretaria, Pedagógico, Financeiro, Professor.
  const papeis = await exigirPapelLeitura(...PAPEIS_ALUNOS);
  if (!papeis) return <AcessoNegado recurso="os alunos" />;

  // Filtros na URL (E4): sobrevivem a voltar/F5, o link é compartilhável e a exportação usa o
  // mesmo recorte. Professor recebe escopo row-level (só suas turmas) dentro das consultas (issue #46).
  const filtros = lerFiltrosAlunos(await searchParams);
  const usuario = await exigirSessao();
  const [pagina, opcoes] = await Promise.all([listarAlunosPagina(usuario, filtros), opcoesFiltroAlunos(usuario)]);
  // "Cadastrar aluno" leva ao fluxo de matrícula (aluno nasce da matrícula — doc 09).
  // Gateado pela permissão real de criar matrícula (Vendedor/Gerente Comercial/Admin).
  const podeCadastrar = podeCriarMatricula(usuario.papeis);
  // Cadastro em lote (XLSX) é exclusivo do Administrador (doc 22 — carga por lote).
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
