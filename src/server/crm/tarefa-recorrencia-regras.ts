import { z } from "zod";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { candidatosDaGrade } from "@/server/agenda/grade";
import { ErroRegra } from "@/server/_shared/sessao";

export type RecorrenciaTarefaD10 = "NAO_REPETE" | "DIARIA" | "SEMANAL" | "MENSAL";
export interface PedidoRecorrenciaTarefa {
  recorrencia: RecorrenciaTarefaD10;
  ancora: { dataCivil: string | null; hora: string | null; fusoOrigem: string };
  corteEm: Date;
  indiceAtual: number;
}
export interface OcorrenciaTarefaD10 {
  dataCivil: string;
  hora: string | null;
  inicioEm: Date | null;
  ajuste: "NENHUM" | "GAP_AVANCADO" | "FOLD_PRIMEIRO";
  solicitado: string | null;
  resolvido: string | null;
  politicaVersao: 1;
  indice: number;
}
const Entrada = z.object({
  recorrencia: z.enum(["NAO_REPETE", "DIARIA", "SEMANAL", "MENSAL"]),
  indiceAtual: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  ancora: z.object({ dataCivil: DataCivilSchema.nullable(), hora: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(), fusoOrigem: FusoInstitucionalSchema }).strict(),
  corteEm: z.date(),
}).strict();
const DIA = 86_400_000;
const foraDoCalendario = () => new ErroRegra("A próxima ocorrência excede o calendário suportado.");
function dataDaOcorrencia(ancora: Date, indice: number, recorrencia: RecorrenciaTarefaD10): string {
  const data = new Date(ancora.getTime());
  if (recorrencia === "MENSAL") {
    data.setUTCDate(1); data.setUTCMonth(data.getUTCMonth() + indice);
    const ultimo = new Date(data.getTime()); ultimo.setUTCMonth(ultimo.getUTCMonth() + 1, 0);
    data.setUTCDate(Math.min(ancora.getUTCDate(), ultimo.getUTCDate()));
  } else data.setUTCDate(data.getUTCDate() + indice * (recorrencia === "SEMANAL" ? 7 : 1));
  if (!Number.isFinite(data.getTime()) || data.getUTCFullYear() < 1 || data.getUTCFullYear() > 9999) throw foraDoCalendario();
  return data.toISOString().slice(0, 10);
}
/** Política D10 local; os conversores globais de entrada continuam estritos. */
function resolverHorario(data: string, hora: string, fuso: string) {
  const solicitado = `${data}T${hora}`, candidatos = candidatosDaGrade(data, hora, fuso);
  if (candidatos.length) return { inicioEm: candidatos[0], ajuste: candidatos.length > 1 ? "FOLD_PRIMEIRO" as const : "NENHUM" as const, solicitado, resolvido: solicitado };
  // Um dia civil inteiro também pode ser omitido. A busca é por minutos civis,
  // limitada a48h por resolução, nunca pelos anos/ocorrências vencidas da série.
  const nominal = Date.parse(`${solicitado}:00Z`);
  for (let minutos = 1; minutos <= 2880; minutos++) {
    const civil = new Date(nominal + minutos * 60_000);
    if (civil.getUTCFullYear() > 9999) throw foraDoCalendario();
    const resolvido = civil.toISOString().slice(0, 16), encontrados = candidatosDaGrade(resolvido.slice(0, 10), resolvido.slice(11), fuso);
    if (encontrados.length) return { inicioEm: encontrados[0], ajuste: "GAP_AVANCADO" as const, solicitado, resolvido };
  }
  throw new ErroRegra("Não foi possível resolver o horário da próxima ocorrência.");
}
/** Sem relógio/DB/efeitos. Corte e índice vêm do snapshot durável da conclusão. */
export function proximaOcorrenciaTarefa(pedido: PedidoRecorrenciaTarefa): OcorrenciaTarefaD10 | null {
  const validado = Entrada.safeParse(pedido);
  if (!validado.success) throw new ErroRegra("Dados de recorrência inválidos. Confira data, horário, fuso e índice.");
  const p = validado.data;
  if (p.recorrencia === "NAO_REPETE") return null;
  if (!p.ancora.dataCivil) throw new ErroRegra("A recorrência exige uma data.");
  const ancora = new Date(`${p.ancora.dataCivil}T00:00:00Z`), corteCivil = dataCivilInstitucional(p.corteEm, p.ancora.fusoOrigem);
  const dataCorte = new Date(`${corteCivil}T00:00:00Z`);
  if (!Number.isFinite(dataCorte.getTime())) throw foraDoCalendario();
  const estimativa = p.recorrencia === "MENSAL"
    ? (dataCorte.getUTCFullYear() - ancora.getUTCFullYear()) * 12 + dataCorte.getUTCMonth() - ancora.getUTCMonth()
    : Math.floor((dataCorte.getTime() - ancora.getTime()) / DIA / (p.recorrencia === "SEMANAL" ? 7 : 1));
  const primeiroIndice = Math.max(p.indiceAtual + 1, estimativa);
  dataDaOcorrencia(ancora, primeiroIndice, p.recorrencia);
  const inicioAtual = p.ancora.hora === null ? null : resolverHorario(dataDaOcorrencia(ancora, p.indiceAtual, p.recorrencia), p.ancora.hora, p.ancora.fusoOrigem).inicioEm;
  const limite = Math.max(p.corteEm.getTime(), inicioAtual?.getTime() ?? -Infinity);
  // O salto civil evita varrer o atraso. Nunca volta à ocorrência atual, mesmo
  // quando uma pessoa a conclui antes do seu prazo.
  for (let indice = primeiroIndice; ; indice++) {
    const data = dataDaOcorrencia(ancora, indice, p.recorrencia);
    if (p.ancora.hora === null) {
      if (data <= corteCivil) continue;
      return { dataCivil: data, hora: null, inicioEm: null, ajuste: "NENHUM", solicitado: null, resolvido: null, politicaVersao: 1, indice };
    }
    const r = resolverHorario(data, p.ancora.hora, p.ancora.fusoOrigem);
    // Na dobra, só o primeiro instante pode representar esta ocorrência.
    if (r.inicioEm.getTime() <= limite) continue;
    return { ...r, dataCivil: r.resolvido.slice(0, 10), hora: r.resolvido.slice(11), politicaVersao: 1, indice };
  }
}