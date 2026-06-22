import { listarAlunos } from "@/server/alunos/consultas";
import { AlunosLista } from "./AlunosLista";

export default async function AlunosPage() {
  const alunos = await listarAlunos();
  return <AlunosLista alunos={alunos} />;
}
