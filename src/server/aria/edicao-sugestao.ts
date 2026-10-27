import { TituloTarefaHumanaSchema, TextoNotaInternaSchema } from "../_shared/efeitos-humanos-schema";
import { z } from "zod";
import { EnviarMidiaInboxSchema, EnviarTextoInboxSchema } from "../whatsapp/schema";

const objeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const titulo = TituloTarefaHumanaSchema;
const nota = TextoNotaInternaSchema;
const instante = z.string().datetime({ offset: true }).transform(v => new Date(v).toISOString());

export function compilarEdicaoSugestao(tipo: string, payload: unknown, edicao: unknown): { payload: Record<string, unknown>; saidaHumana: boolean; camposEditados: string[] } {
 if (!objeto(payload) || !objeto(edicao)) throw new z.ZodError([{code:"custom",path:[],message:"Confira a edição da sugestão."}]);
 const texto = typeof payload.documentoId === "string" && payload.documentoId ? EnviarMidiaInboxSchema.shape.legenda : EnviarTextoInboxSchema.shape.texto;
 const campos: z.ZodRawShape | null = (tipo === "RESPONDER" || tipo === "ENVIAR_DOCUMENTO") ? { texto } : tipo === "AGENDAR_MENSAGEM" ? { texto: EnviarTextoInboxSchema.shape.texto, agendadaPara: instante } : tipo === "NOTA_INTERNA" ? { texto: nota } : tipo === "CRIAR_TAREFA" ? { titulo, venceEmISO: instante } : null;
 if (!campos) throw new z.ZodError([{code:"custom",path:[],message:"Esta sugestão não permite edição."}]);
 const chaves = Object.keys(edicao).sort();
 if (!chaves.length || chaves.some(k => !Object.hasOwn(campos, k) || edicao[k] === undefined)) throw new z.ZodError([{code:"custom",path:[],message:"Confira os campos da edição."}]);
 const patch = z.object(campos).partial().strict().parse(edicao);
 const efeito = z.object(campos).passthrough().parse({ ...payload, ...patch });
 return { payload: efeito, saidaHumana: tipo === "RESPONDER" || tipo === "ENVIAR_DOCUMENTO" || tipo === "AGENDAR_MENSAGEM", camposEditados: chaves };
}
export function normalizarEdicaoFornecida(edicao:Record<string,unknown>):Record<string,unknown>{
 return Object.fromEntries(Object.entries(edicao).sort(([a],[b])=>a.localeCompare(b)).map(([campo,valor])=>{
  if(typeof valor!=="string")return [campo,valor];
  const texto=valor.trim();
  if(campo==="agendadaPara"||campo==="venceEmISO"){const r=instante.safeParse(texto);return [campo,r.success?r.data:texto];}
  return [campo,texto];
 }));
}