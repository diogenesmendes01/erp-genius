import type { StatusIntencao } from "@prisma/client";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { somarDiasDataCivil, grupoDaTarefa, type GrupoTarefa } from "@/server/crm/tarefas-regras";
import type { ItemAgenda } from "@/server/crm/mensagens-agendadas";

export type Visao = "lista" | "dia" | "semana" | "mes";
export const VISOES: { id: Visao; rotulo: string }[] = [
  { id: "lista", rotulo: "Lista" },
  { id: "dia", rotulo: "Dia" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
];

export const ROTULO_GRUPO: Record<GrupoTarefa, string> = {
  ATRASADAS: "Atrasadas",
  HOJE: "Hoje",
  AMANHA: "Amanhã",
  PROXIMOS_7: "Próximos 7 dias",
  DEPOIS: "Mais adiante",
  SEM_DATA: "Sem data",
  CONCLUIDAS: "Concluídas",
};
export const ORDEM_GRUPOS: GrupoTarefa[] = ["ATRASADAS", "HOJE", "AMANHA", "PROXIMOS_7", "DEPOIS", "SEM_DATA", "CONCLUIDAS"];

const MENSAGEM_ENCERRADA: StatusIntencao[] = ["DESPACHADA", "CANCELADA", "SIMULADA"];

export const chaveItem = (i: ItemAgenda) => (i.tipo === "tarefa" ? `t${i.tarefa.id}` : `m${i.id}`);

/** Concluir em lote vale só para tarefas (chave "t…"); mensagens ficam de fora e são contadas. */
export function acoesLote(chaves: string[]): { concluir: string[]; ignoradas: number } {
  const concluir = chaves.filter((c) => c.startsWith("t"));
  return { concluir, ignoradas: chaves.length - concluir.length };
}

export function grupoDoItem(i: ItemAgenda, agora: Date, fusoEscola: string): GrupoTarefa {
  if (i.tipo === "tarefa") return grupoDaTarefa(i.tarefa, agora, fusoEscola);
  return grupoDaTarefa(
    { dataCivil: dataCivilInstitucional(new Date(i.agendadaPara), fusoEscola), inicioEm: new Date(i.agendadaPara), status: MENSAGEM_ENCERRADA.includes(i.status) ? "CONCLUIDA" : "ABERTA" },
    agora,
    fusoEscola,
  );
}

export function dataCivilDoItem(i: ItemAgenda, fusoEscola: string): string | null {
  return i.tipo === "tarefa" ? i.tarefa.dataCivil : dataCivilInstitucional(new Date(i.agendadaPara), fusoEscola);
}

export function instanteDoItem(i: ItemAgenda): Date | null {
  return i.tipo === "tarefa" ? (i.tarefa.inicioEm ? new Date(i.tarefa.inicioEm) : null) : new Date(i.agendadaPara);
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const dataValida = (v: string) => DATA.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const diaSemana = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

/** Segunda-feira da semana da data. */
export function inicioDaSemana(d: string): string {
  return somarDiasDataCivil(d, -((diaSemana(d) + 6) % 7));
}
export function diasDaSemana(d: string): string[] {
  const ini = inicioDaSemana(d);
  return Array.from({ length: 7 }, (_, i) => somarDiasDataCivil(ini, i));
}
/** Grade do mês: semanas completas (segunda a domingo) que cobrem o mês da data. */
export function diasDoMes(d: string): string[] {
  const primeiro = `${d.slice(0, 7)}-01`;
  const proximo = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const ultimo = somarDiasDataCivil(proximo, -1);
  const ini = inicioDaSemana(primeiro);
  const fim = somarDiasDataCivil(inicioDaSemana(ultimo), 6);
  const dias: string[] = [];
  for (let x = ini; x <= fim; x = somarDiasDataCivil(x, 1)) dias.push(x);
  return dias;
}

export function intervaloDaVisao(visao: Visao, data: string, hoje: string): { de: string; ate: string } {
  if (visao === "dia") return { de: data, ate: data };
  if (visao === "semana") { const s = diasDaSemana(data); return { de: s[0], ate: s[6] }; }
  if (visao === "mes") { const m = diasDoMes(data); return { de: m[0], ate: m[m.length - 1] }; }
  return { de: somarDiasDataCivil(hoje, -30), ate: somarDiasDataCivil(hoje, 365) };
}

export function deslocarData(visao: Visao, data: string, sentido: 1 | -1): string {
  if (visao === "dia") return somarDiasDataCivil(data, sentido);
  if (visao === "semana") return somarDiasDataCivil(data, 7 * sentido);
  const [a, m] = [Number(data.slice(0, 4)), Number(data.slice(5, 7))];
  return new Date(Date.UTC(a, m - 1 + sentido, 1)).toISOString().slice(0, 10);
}

export type ParamsTarefas = { visao?: Visao; data?: string; escopo?: string; t?: string };
export function hrefTarefas(p: ParamsTarefas): string {
  const q = new URLSearchParams();
  if (p.visao && p.visao !== "lista") q.set("visao", p.visao);
  if (p.data) q.set("data", p.data);
  if (p.escopo === "equipe") q.set("escopo", "equipe");
  if (p.t) q.set("t", p.t);
  const s = q.toString();
  return s ? `/tarefas?${s}` : "/tarefas";
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const rotuloDia = (d: string) => `${DIAS[diaSemana(d)]}, ${Number(d.slice(8))} de ${MESES[Number(d.slice(5, 7)) - 1]}`;
export const rotuloDiaCurto = (d: string) => `${DIAS[diaSemana(d)].slice(0, 3)} ${d.slice(8)}`;
export const rotuloMes = (d: string) => `${MESES[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`;
export const dataCurta = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

/** Hora (HH:MM) do instante num fuso. */
export function horaNoFuso(instante: Date | string, fuso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: fuso }).format(new Date(instante));
}

/** Hora no fuso do usuário; quando ele difere da escola, devolve também a hora no fuso da escola (a dica). */
export function textoHora(instante: Date | string, fusoExibicao: string, fusoEscola: string): { hora: string; dica: string | null } {
  const hora = horaNoFuso(instante, fusoExibicao);
  if (fusoExibicao === fusoEscola) return { hora, dica: null };
  return { hora, dica: `${horaNoFuso(instante, fusoEscola)} no fuso da escola` };
}
