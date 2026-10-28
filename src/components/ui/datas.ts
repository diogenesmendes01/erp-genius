import type { ChangeEvent } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

export function eventoCampo(valor: string, name?: string) {
  const alvo = { value: valor, name: name ?? "" };
  return { target: alvo, currentTarget: alvo } as ChangeEvent<HTMLInputElement>;
}

export function partirData(valor: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? "");
  if (!m) return undefined;
  const data = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(data.getTime()) ? undefined : data;
}

export function partirHora(valor: string | null | undefined) {
  const m = /T(\d{2}):(\d{2})/.exec(valor ?? "") ?? /^(\d{2}):(\d{2})$/.exec(valor ?? "");
  if (!m) return { hora: "00", minuto: "00" };
  return { hora: m[1], minuto: m[2] };
}

export function isoData(data: Date) {
  return format(data, "yyyy-MM-dd");
}

export function textoData(data: Date) {
  return format(data, "dd/MM/yyyy", { locale: ptBR });
}

export function textoDataHora(data: Date, hora: string, minuto: string) {
  return `${textoData(data)}, ${hora}:${minuto}`;
}

export function isoDataHora(data: Date, hora: string, minuto: string) {
  return `${isoData(data)}T${hora}:${minuto}`;
}

export function partirMes(valor: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})$/.exec(valor ?? "");
  if (!m) return undefined;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return undefined;
  return { ano, mes };
}

export function isoMes(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function nomeMes(mes: number) {
  const nome = format(new Date(2020, mes - 1, 1), "MMMM", { locale: ptBR });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
export const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
