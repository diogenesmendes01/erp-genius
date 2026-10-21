import { EsqueletoCartoes } from "@/components/Esqueleto";

// Nova matrícula (#174): a página faz 6 consultas (lead, produtos, turmas, preços, países e níveis) antes de
// pintar. Nenhum layout acima desenha título: o esqueleto traz o título do formulário e os blocos dos passos.
export default function LoadingMatriculaNova() {
  return <EsqueletoCartoes rotulo="nova matrícula" />;
}
