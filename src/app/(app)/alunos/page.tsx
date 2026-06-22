import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarAlunos } from "@/server/alunos/consultas";
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
  const papeis = await exigirPapelLeitura(...PAPEIS_ALUNOS);
  if (!papeis) return <AcessoNegado recurso="os alunos" />;

  const alunos = await listarAlunos();
  return <AlunosLista alunos={alunos} />;
}
