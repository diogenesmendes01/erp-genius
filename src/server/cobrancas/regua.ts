import type { ModeloWhatsapp } from "@/server/financeiro/schema";
import { dataCivilInstitucional, diaCivilGravado, diasCivisDesde } from "@/server/operacao/fuso";

export type PassoRegua = "D-7" | "D-3" | "D0" | "D+3" | "D+7" | "D+15";
export type TipoAcao = "lembrar" | "cobrar" | "bloquear";

export interface DegrauRegua {
  passo: PassoRegua;
  offsetDias: number;
  tipo: TipoAcao;
  template: ModeloWhatsapp;
  rotulo: string;
}

export const REGUA: readonly DegrauRegua[] = [
  { passo: "D-7", offsetDias: -7, tipo: "lembrar", template: "amigavel", rotulo: "Lembrete · 7 dias antes" },
  { passo: "D-3", offsetDias: -3, tipo: "lembrar", template: "amigavel", rotulo: "Lembrete · 3 dias antes" },
  { passo: "D0", offsetDias: 0, tipo: "cobrar", template: "dados", rotulo: "Cobrança no vencimento" },
  { passo: "D+3", offsetDias: 3, tipo: "cobrar", template: "vencida", rotulo: "Cobrança · 3 dias de atraso" },
  { passo: "D+7", offsetDias: 7, tipo: "cobrar", template: "vencida", rotulo: "Cobrança · 7 dias de atraso" },
  { passo: "D+15", offsetDias: 15, tipo: "cobrar", template: "firme", rotulo: "Cobrança final · 15 dias de atraso" },
] as const;

export const ORDEM_PASSOS: readonly PassoRegua[] = ["D-7", "D-3", "D0", "D+3", "D+7", "D+15"];

export type EstadoCobranca =
  | "em_conferencia"
  | "quitada"
  | "promessa"
  | "futuro"
  | "acao_devida"
  | "concluida";

export interface ResultadoRegua {
  estado: EstadoCobranca;
  degrau: DegrauRegua | null;
  atrasadaNaAcao: boolean;
  diasAtraso: number;
  prioridade: number;
  promessaAte: Date | null;
}

export interface EntradaRegua {
  vencimento: Date;
  quitada: boolean;
  passosFeitos: PassoRegua[];
  promessaAte?: Date | null;
}

export { diaCivilGravado, diasCivisDesde };

export function promessaNoPassado(ate: string, agora: Date, fuso: string): boolean {
  return ate < dataCivilInstitucional(agora, fuso);
}

function prioridadeDe(d: DegrauRegua): number {
  if (d.tipo === "bloquear") return 0;
  if (d.tipo === "cobrar") return 10 - d.offsetDias;
  return 20 - d.offsetDias;
}

export type EstadoDegrau = "futuro" | "acao_devida" | "concluida";

export interface SelecaoDegrau<D> {
  estado: EstadoDegrau;
  degrau: D | null;
  atrasada: boolean;
}

export function selecionarDegrau<D extends { offset: number; chave: string }>(
  posicao: number,
  degraus: readonly D[],
  feitos: ReadonlySet<string>,
  ordem?: readonly string[],
): SelecaoDegrau<D> {
  const ultimoOffset = degraus.length ? degraus[degraus.length - 1].offset : Infinity;

  const ordemEfetiva = ordem ?? degraus.map((d) => d.chave);
  const indice = new Map(ordemEfetiva.map((chave, i) => [chave, i]));
  let corte = -1;
  for (const chave of feitos) {
    const i = indice.get(chave);
    if (i !== undefined && i > corte) corte = i;
  }

  const devidos = degraus.filter(
    (d) => d.offset <= posicao && (indice.get(d.chave) ?? Infinity) > corte && !feitos.has(d.chave),
  );
  if (devidos.length === 0) {
    if (posicao >= ultimoOffset) return { estado: "concluida", degrau: null, atrasada: false };
    return { estado: "futuro", degrau: null, atrasada: false };
  }
  const degrau = devidos[devidos.length - 1];
  return { estado: "acao_devida", degrau, atrasada: posicao > degrau.offset };
}

export function proximaAcao(
  entrada: EntradaRegua,
  hoje: Date,
  fuso: string,
  politica: readonly DegrauRegua[] = REGUA,
): ResultadoRegua {
  const diasAtraso = diasCivisDesde(hoje, entrada.vencimento, fuso);
  const promessaAte = entrada.promessaAte ?? null;

  if (entrada.quitada) {
    return { estado: "quitada", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 999, promessaAte };
  }
  if (promessaAte && diasCivisDesde(hoje, promessaAte, fuso) <= 0) {
    return { estado: "promessa", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 900, promessaAte };
  }

  const sel = selecionarDegrau(
    diasAtraso,
    politica.map((d) => ({ offset: d.offsetDias, chave: d.passo, orig: d })),
    new Set(entrada.passosFeitos),
    ORDEM_PASSOS,
  );

  if (sel.estado === "concluida") {
    return { estado: "concluida", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 800, promessaAte };
  }
  if (sel.estado === "futuro") {
    return { estado: "futuro", degrau: null, atrasadaNaAcao: false, diasAtraso, prioridade: 700, promessaAte };
  }

  const degrau = sel.degrau!.orig;
  return {
    estado: "acao_devida",
    degrau,
    atrasadaNaAcao: sel.atrasada,
    diasAtraso,
    prioridade: prioridadeDe(degrau),
    promessaAte,
  };
}

export interface DegrauAncora {
  passo: string;
  offsetMinutos: number;
}

export interface EntradaAncora {
  ancoraEm: Date;
  encerrada: boolean;
  passosFeitos: readonly string[];
}

export interface ResultadoAncora {
  estado: "encerrada" | "futuro" | "acao_devida" | "concluida";
  passo: string | null;
  atrasada: boolean;
  minutosDesdeAncora: number;
}

export function proximaAcaoAncora(
  entrada: EntradaAncora,
  agora: Date,
  degraus: readonly DegrauAncora[],
  ordem?: readonly string[],
): ResultadoAncora {
  const minutosDesdeAncora = Math.floor((agora.getTime() - entrada.ancoraEm.getTime()) / 60_000);
  if (entrada.encerrada) {
    return { estado: "encerrada", passo: null, atrasada: false, minutosDesdeAncora };
  }
  const sel = selecionarDegrau(
    minutosDesdeAncora,
    degraus.map((d) => ({ offset: d.offsetMinutos, chave: d.passo })),
    new Set(entrada.passosFeitos),
    ordem,
  );
  return {
    estado: sel.estado,
    passo: sel.degrau?.chave ?? null,
    atrasada: sel.atrasada,
    minutosDesdeAncora,
  };
}
