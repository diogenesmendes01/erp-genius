import { consultarFusoInstitucional } from "@/server/operacao/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { fusoInicialDeEntrada } from "@/server/operacao/fuso-exibicao";
import { PrepararGradeFormulario, type TurmaGrade } from "./PrepararGradeFormulario";

/**
 * Componente de servidor da proposta de grade (docs/43 §6 item 6; docs/42 L1126): o "Fuso de origem da turma"
 * começava vazio, com três sugestões. Aqui se resolve o fuso inicial — o da escola, senão a preferência de quem
 * prepara — e o formulário (cliente) recebe pronto. A página continua passando só as turmas.
 */
export async function PrepararGrade({ turmas, turmaInicialId }: { turmas: TurmaGrade[]; turmaInicialId?: string | null }) {
  const [institucional, preferencia] = await Promise.all([consultarFusoInstitucional(), consultarPreferenciaFusoEquipe()]);
  const fusoInicial = fusoInicialDeEntrada(institucional, preferencia.ok ? preferencia.dado?.fusoExibicao : null);
  return <PrepararGradeFormulario turmas={turmas} turmaInicialId={turmaInicialId} fusoInicial={fusoInicial} />;
}
