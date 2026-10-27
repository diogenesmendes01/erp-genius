import { dataCivilInstitucional, horaEDiaInstitucional, inicioDoDiaCivil } from "@/server/operacao/fuso";

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
