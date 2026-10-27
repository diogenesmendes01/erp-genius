import { z } from "zod";
import { CACHE_CONTROL_SISTEMA, LIMITE_PROMPT_HAIKU_FAIXA_BAIXA, fatorEscritaCache, modeloPermitido, precoPorMilhao } from "../provedor/custo";
import { UsoInsightSchema, type EnvelopeInsight } from "./envelope";

const preco = z.object({entrada:z.number().finite().min(0),cache:z.number().finite().min(0),saida:z.number().finite().min(0)}).strict();
export const PrecosInsightSchema = z.object({
  versao:z.literal(1),modelo:z.string().refine(m=>m==="simulado"||modeloPermitido(m)),
  limitePromptFaixaBaixa:z.number().int().min(0),base:preco,promptLongo:preco,
  fatorEscritaCache:z.number().finite().positive(),
}).strict();
export type PrecosInsight = z.infer<typeof PrecosInsightSchema>;

export function capturarPrecosInsight(modelo:string):PrecosInsight {
  const zero={entrada:0,cache:0,saida:0};
  return PrecosInsightSchema.parse({versao:1,modelo,limitePromptFaixaBaixa:LIMITE_PROMPT_HAIKU_FAIXA_BAIXA,
    base:modelo==="simulado"?zero:{...precoPorMilhao(modelo,0)},
    promptLongo:modelo==="simulado"?zero:{...precoPorMilhao(modelo,LIMITE_PROMPT_HAIKU_FAIXA_BAIXA+1)},
    fatorEscritaCache:fatorEscritaCache(CACHE_CONTROL_SISTEMA.ttl)});
}

export function usoParaRegistroInsight(snapshot:unknown,envelope:EnvelopeInsight) {
  const s=PrecosInsightSchema.parse(snapshot);
  if(envelope.tipo==="nao-enviada"||!envelope.modelo||envelope.modelo!==s.modelo)return null;
  if((s.modelo==="simulado")!==(envelope.provedor==="simulado"))return null;
  const u=UsoInsightSchema.safeParse(envelope.uso);
  if(!u.success||!Number.isInteger(envelope.latenciaMs)||envelope.latenciaMs<0||envelope.latenciaMs>2_147_483_647)return null;
  if(s.modelo==="simulado"&&Object.values(u.data).some(n=>n!==0))return null;
  const t=u.data;
  const p=t.tokensEntrada+t.tokensCache+t.tokensEscritaCache>s.limitePromptFaixaBaixa?s.promptLongo:s.base;
  const custoMicroUsd=Math.round(t.tokensEntrada*p.entrada+t.tokensCache*p.cache+t.tokensSaida*p.saida+t.tokensEscritaCache*p.entrada*s.fatorEscritaCache);
  if(!Number.isSafeInteger(custoMicroUsd)||custoMicroUsd<0||custoMicroUsd>2_147_483_647)return null;
  return {...t,modelo:envelope.modelo,provedor:envelope.provedor,custoMicroUsd,latenciaMs:envelope.latenciaMs,
    resultado:envelope.tipo==="resposta"?(envelope.recusa?"RECUSA":"OK"):`INCERTO:${envelope.codigo}`};
}
