import { z } from "zod";
import { modeloPermitido } from "../provedor/custo";
import { ErroProvedorIA,type PedidoIA,type RespostaIA } from "../provedor/tipos";

const tokens = z.number().finite().int().min(0).max(2_147_483_647);
export const UsoInsightSchema = z.object({
  tokensEntrada: tokens,
  tokensSaida: tokens,
  tokensCache: tokens,
  tokensEscritaCache: tokens,
}).strict();
export type UsoConhecidoInsight = z.infer<typeof UsoInsightSchema>;

const MetadadosInsightSchema = z.object({
  modelo: z.string(),
  provedor: z.enum(["anthropic", "simulado"]),
  latenciaMs: tokens,
}).strict().refine(m => m.provedor === "simulado" ? m.modelo === "simulado" : modeloPermitido(m.modelo));
export type MetadadosInsight = z.infer<typeof MetadadosInsightSchema>;

export type EnvelopeInsight =
  | (MetadadosInsight & { tipo: "resposta"; fase: "enviado"; texto: string; recusa: boolean; uso: UsoConhecidoInsight })
  | (Omit<MetadadosInsight, "modelo"> & { modelo: string | null; tipo: "incerto"; fase: "possivelmente-enviado";
      codigo: "USO_DESCONHECIDO" | "CORPO_INVALIDO" | "TRANSPORTE" | "DEADLINE" | "ABORTADO_APOS_ENVIO" | "MODELO_DESCONHECIDO" | "MODELO_DIVERGENTE"; uso: UsoConhecidoInsight | null })
  | { tipo: "nao-enviada"; fase: "nao-enviado"; codigo: "ABORTADO_ANTES_ENVIO" | "PROVEDOR_INDISPONIVEL" | "CONFIG_INVALIDA" };

/** Porta local; usa o controle opt-in sem mudar os defaults de outros consumidores. */
export interface PortaGeradorInsight {
  gerar(pedido: PedidoIA, controle: { signal?: AbortSignal; deadlineMs: 30000; maxRetries: 0 }): Promise<EnvelopeInsight>;
}

/** Metadados devem representar modelo observado e validado; nunca vêm do browser. Usage parcial não significa zero. */
export function envelopeRespostaInsight(metadados: MetadadosInsight, resposta: unknown): EnvelopeInsight {
  const meta = MetadadosInsightSchema.parse(metadados);
  const corpo = typeof resposta === "object" && resposta !== null && !Array.isArray(resposta)
    ? resposta as Record<string, unknown> : {};
  const uso = UsoInsightSchema.safeParse(corpo.uso);
  if (!uso.success) return { ...meta, tipo: "incerto", fase: "possivelmente-enviado", codigo: "USO_DESCONHECIDO", uso: null };
  if (typeof corpo.texto !== "string" || typeof corpo.recusa !== "boolean") {
    return { ...meta, tipo: "incerto", fase: "possivelmente-enviado", codigo: "CORPO_INVALIDO", uso: uso.data };
  }
  return { ...meta, tipo: "resposta", fase: "enviado", texto: corpo.texto, recusa: corpo.recusa, uso: uso.data };
}

/** Só o diagnóstico opt-in prova usage; campos legados com defaults não o completam. */
export function envelopeRespostaControladaInsight(r: RespostaIA, modeloEsperado: string): EnvelopeInsight {
  const diagnostico = r.diagnostico;
  const observado = diagnostico?.modeloObservado;
  const modelo = typeof observado === "string" && modeloPermitido(observado) ? observado : null;
  const conhecido = UsoInsightSchema.safeParse(diagnostico?.uso);
  const uso = conhecido.success ? conhecido.data : null;
  const meta = { modelo, provedor: r.provedor, latenciaMs: tokens.parse(r.latenciaMs) };
  if (!diagnostico) return { ...meta, tipo: "incerto", fase: "possivelmente-enviado", codigo: "USO_DESCONHECIDO", uso: null };
  if (!modelo) return { ...meta, tipo: "incerto", fase: "possivelmente-enviado", codigo: "MODELO_DESCONHECIDO", uso };
  if (modelo !== modeloEsperado) return { ...meta, tipo: "incerto", fase: "possivelmente-enviado", codigo: "MODELO_DIVERGENTE", uso };
  if (!uso) return { ...meta, tipo: "incerto", fase: "possivelmente-enviado", codigo: "USO_DESCONHECIDO", uso: null };
  if (diagnostico.fase !== "enviado") return { ...meta, tipo: "incerto", fase: "possivelmente-enviado", codigo: "TRANSPORTE", uso };
  return envelopeRespostaInsight({ modelo, provedor: r.provedor, latenciaMs: r.latenciaMs }, { texto: r.texto, recusa: r.recusa, uso });
}
/** Também cobre uma rejeição excepcional da porta sem apagar diagnóstico conhecido. */
export function envelopeErroInsight(erro:unknown,modeloEsperado:string,latenciaMs:number):EnvelopeInsight {
  const d=erro instanceof ErroProvedorIA?erro.diagnostico:undefined;
  if(d?.fase==="nao-enviado")return {tipo:"nao-enviada",fase:"nao-enviado",codigo:erro instanceof ErroProvedorIA&&erro.codigo==="ABORTADO_ANTES_ENVIO"?"ABORTADO_ANTES_ENVIO":"CONFIG_INVALIDA"};
  const modelo=d?.modeloObservado&&modeloPermitido(d.modeloObservado)?d.modeloObservado:null;
  const uso=UsoInsightSchema.safeParse(d?.uso);
  const c=erro instanceof ErroProvedorIA?erro.codigo:null;
  const codigo=modelo&&modelo!==modeloEsperado?"MODELO_DIVERGENTE":c==="CORPO_INVALIDO"||c==="DEADLINE"||c==="ABORTADO_APOS_ENVIO"||c==="MODELO_DESCONHECIDO"?c:"TRANSPORTE";
  return {tipo:"incerto",fase:"possivelmente-enviado",modelo,provedor:"anthropic",latenciaMs:tokens.parse(latenciaMs),codigo,uso:uso.success?uso.data:null};
}