import { z } from "zod";
import { DataCivilSchema } from "./cobertura";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";

const Entrada = z.object({
  agora: z.date(), fusoAdmissao: FusoInstitucionalSchema,
  limiteEntrada: DataCivilSchema.nullable(),
  status: z.enum(["PLANEJADA", "ABERTA", "EM_ANDAMENTO", "CONCLUIDA"]),
  agendaPublicada: z.boolean(), professorApto: z.boolean(), disponibilidadeConferida: z.boolean(),
  capacidade: z.number().int().positive(), ocupacoes: z.number().int().nonnegative(),
  reservasOcupando: z.number().int().nonnegative().nullable(),
}).strict();

/** Q103/Q107/Q109: somente nova reserva. Q110 exige fluxo próprio e não amplia esta janela.
 * Os dados devem ser reconsultados pelo servidor sob os locks da futura operação de reserva.
 * Esta função não confirma disponibilidade, não reserva e não libera cobrança/assinatura.
 */
export function conferirNovaAdmissaoTurma(input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input);
  const hoje = dataCivilInstitucional(d.agora, d.fusoAdmissao);
  const impedimentos: string[] = [];
  if (d.status === "CONCLUIDA") impedimentos.push("TURMA_CONCLUIDA");
  if (!d.agendaPublicada) impedimentos.push("AGENDA_NAO_PUBLICADA");
  if (!d.professorApto) impedimentos.push("PROFESSOR_INAPTO");
  if (!d.disponibilidadeConferida) impedimentos.push("DISPONIBILIDADE_NAO_CONFERIDA");
  if (d.limiteEntrada === null) impedimentos.push("LIMITE_NAO_CONFIGURADO");
  else if (hoje > d.limiteEntrada) impedimentos.push("JANELA_ENCERRADA");
  if (d.reservasOcupando === null) impedimentos.push("RESERVAS_NAO_CONFERIDAS");
  const vagas = d.reservasOcupando === null ? null : Math.max(0, d.capacidade - d.ocupacoes - d.reservasOcupando);
  if (vagas === 0) impedimentos.push("SEM_VAGA");
  return { elegivel: impedimentos.length === 0, impedimentos, vagas, dataConferencia: hoje, limiteEntrada: d.limiteEntrada,
    fusoAdmissao: d.fusoAdmissao, reservada: false as const };
}
