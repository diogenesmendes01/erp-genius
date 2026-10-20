import { dataCivilInstitucional, horaEDiaInstitucional, inicioDoDiaCivil } from "@/server/operacao/fuso";

/**
 * Instantes para os testes de agendamento (D12): o agendamento fora da janela de envio é recusado, então um
 * "daqui a 2 horas" fica vermelho à noite e no fim de semana. `diaUtilAs` devolve o próximo dia útil (segunda
 * a sexta, a janela de fábrica) às `hora` no `fuso`, a partir de amanhã, mais `minutos`.
 */
export function diaUtilAs(hora: number, fuso = "America/Sao_Paulo", minutos = 0, de = new Date()): Date {
  for (let d = 1; d <= 7; d++) {
    const dia = dataCivilInstitucional(new Date(de.getTime() + d * 86_400_000), fuso);
    const inicio = inicioDoDiaCivil(dia, fuso);
    if ([1, 2, 3, 4, 5].includes(horaEDiaInstitucional(inicio, fuso).diaSemana)) {
      return new Date(inicio.getTime() + hora * 3_600_000 + minutos * 60_000);
    }
  }
  throw new Error("Sem dia útil na semana.");
}
