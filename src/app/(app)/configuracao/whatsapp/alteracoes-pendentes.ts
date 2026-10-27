import type { DegrauConfig, NumeroConfig, PoliticaConfig } from "@/server/whatsapp/consultas";

export interface CamposNumero {
  id?: string;
  telefoneE164: string;
  rotulo: string;
  finalidade: string;
  donoId: string;
}

const NUMERO_VAZIO: CamposNumero = { telefoneE164: "", rotulo: "", finalidade: "COBRANCA", donoId: "" };

export function numeroAlterado(form: CamposNumero | null, numeros: readonly NumeroConfig[]): boolean {
  if (!form) return false;
  const salvo = form.id ? numeros.find((n) => n.id === form.id) : null;
  if (form.id && !salvo) return true;
  const origem: CamposNumero = salvo
    ? { telefoneE164: salvo.telefoneE164, rotulo: salvo.rotulo, finalidade: salvo.finalidade, donoId: salvo.donoId ?? "" }
    : NUMERO_VAZIO;
  return form.telefoneE164 !== origem.telefoneE164 || form.rotulo !== origem.rotulo || form.finalidade !== origem.finalidade
    || form.donoId !== origem.donoId;
}

const mesmoConjunto = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function setoresAlterados(
  setores: readonly string[],
  triagem: string,
  numero: Pick<NumeroConfig, "setores" | "triagemResponsavelId">,
): boolean {
  return !mesmoConjunto(setores, numero.setores) || triagem !== (numero.triagemResponsavelId ?? "");
}

export function avisosAgendaAlterados(
  numeroId: string,
  templateId: string,
  config: { numeroAvisosAgendaId: string | null; templateAvisosAgendaId: string | null },
): boolean {
  return numeroId !== (config.numeroAvisosAgendaId ?? "") || templateId !== (config.templateAvisosAgendaId ?? "");
}

export interface CamposPolitica {
  estado: string;
  janelaInicio: number;
  janelaFim: number;
  diasSemana: number[];
  tetoPorContatoDia: number;
  silencioPosInboundHoras: number;
  killSwitch: boolean;
  numeroRemetenteId: string;
  degraus: DegrauConfig[];
}

const degrauGravado = (d: DegrauConfig) => JSON.stringify([d.offsetDias, d.modo, d.ativo, d.templateId ?? null]);

function degrausAlterados(form: readonly DegrauConfig[], salvos: readonly DegrauConfig[]): boolean {
  if (form.length !== salvos.length) return true;
  const porPasso = new Map(salvos.map((d) => [d.passo, degrauGravado(d)]));
  if (porPasso.size !== salvos.length) return true;
  return form.some((d) => porPasso.get(d.passo) !== degrauGravado(d));
}

export function politicaAlterada(form: CamposPolitica, politica: PoliticaConfig): boolean {
  return form.estado !== politica.estado
    || form.janelaInicio !== politica.janelaInicio
    || form.janelaFim !== politica.janelaFim
    || !mesmoConjunto(form.diasSemana.map(String), politica.diasSemana.map(String))
    || form.tetoPorContatoDia !== politica.tetoPorContatoDia
    || form.silencioPosInboundHoras !== politica.silencioPosInboundHoras
    || form.numeroRemetenteId !== (politica.numeroRemetenteId ?? "")
    || degrausAlterados(form.degraus, politica.degraus);
}
