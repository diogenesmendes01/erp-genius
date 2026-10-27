import { consultarFusoInstitucional } from "@/server/operacao/consultas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { fusoInicialDeEntrada } from "@/server/operacao/fuso-exibicao";
import { PrepararGradeFormulario, type TurmaGrade } from "./PrepararGradeFormulario";

export async function PrepararGrade({ turmas, turmaInicialId }: { turmas: TurmaGrade[]; turmaInicialId?: string | null }) {
  const [institucional, preferencia] = await Promise.all([consultarFusoInstitucional(), consultarPreferenciaFusoEquipe()]);
  const fusoInicial = fusoInicialDeEntrada(institucional, preferencia.ok ? preferencia.dado?.fusoExibicao : null);
  return <PrepararGradeFormulario turmas={turmas} turmaInicialId={turmaInicialId} fusoInicial={fusoInicial} />;
}
