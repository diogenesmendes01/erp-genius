import { Papel } from "@prisma/client";
import { listarAlunos } from "@/server/alunos/consultas";
import { exigirSessaoPagina } from "@/server/_shared";
import { AlunosLista } from "./AlunosLista";

export default async function AlunosPage() {
  // Lista de alunos (doc 07 / nav): Admin, Secretaria, Pedagógico, Financeiro, Professor.
  // Professor recebe escopo row-level (só suas turmas) dentro de listarAlunos.
  const usuario = await exigirSessaoPagina(
    Papel.SECRETARIA_ACADEMICA,
    Papel.GERENTE_PEDAGOGICO,
    Papel.FINANCEIRO,
    Papel.PROFESSOR,
  );
  const alunos = await listarAlunos(usuario);
  return <AlunosLista alunos={alunos} />;
}
