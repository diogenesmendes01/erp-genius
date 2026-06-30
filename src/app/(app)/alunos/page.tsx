import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarAlunos } from "@/server/alunos/consultas";
import { exigirSessao } from "@/server/_shared";
import { podeCriarMatricula } from "@/server/matricula/permissoes";
import { AlunosLista } from "./AlunosLista";

// Guard server-side por papel ANTES de buscar dados de alunos (issue #1).
// Papéis alinhados ao nav.ts; Administrador passa sempre (exigirPapelLeitura).
const PAPEIS_ALUNOS: Papel[] = [
  Papel.SECRETARIA_ACADEMICA,
  Papel.GERENTE_PEDAGOGICO,
  Papel.FINANCEIRO,
  Papel.PROFESSOR,
];

export default async function AlunosPage() {
  // Guard de leitura por papel (UX AcessoNegado). Lista de alunos (doc 07 / nav):
  // Admin, Secretaria, Pedagógico, Financeiro, Professor.
  const papeis = await exigirPapelLeitura(...PAPEIS_ALUNOS);
  if (!papeis) return <AcessoNegado recurso="os alunos" />;

  // Professor recebe escopo row-level (só suas turmas) dentro de listarAlunos (issue #46).
  const usuario = await exigirSessao();
  const alunos = await listarAlunos(usuario);
  // "Cadastrar aluno" leva ao fluxo de matrícula (aluno nasce da matrícula — doc 09).
  // Gateado pela permissão real de criar matrícula (Vendedor/Gerente Comercial/Admin).
  const podeCadastrar = podeCriarMatricula(usuario.papeis);
  // Cadastro em lote (XLSX) é exclusivo do Administrador (doc 22 — carga por lote).
  const podeImportar = usuario.papeis.includes(Papel.ADMINISTRADOR);
  return <AlunosLista alunos={alunos} podeCadastrar={podeCadastrar} podeImportar={podeImportar} />;
}
