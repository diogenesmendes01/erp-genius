import { expect,it } from "vitest";
import { envelopeRespostaInsight } from "./envelope";
async function envelope(resposta:unknown){return envelopeRespostaInsight({modelo:"claude-sonnet-5-5",provedor:"anthropic",latenciaMs:12},resposta);}
const uso={tokensEntrada:10,tokensSaida:20,tokensCache:0,tokensEscritaCache:0};
it("resposta com uso explícito preserva todos os tokens, inclusive zeros reais",async()=>{expect(await envelope({texto:'{"analise":"fake"}',recusa:false,uso})).toEqual({tipo:"resposta",fase:"enviado",modelo:"claude-sonnet-5-5",provedor:"anthropic",latenciaMs:12,texto:'{"analise":"fake"}',recusa:false,uso});});
it.each([undefined,null,{}, {...uso,tokensEntrada:undefined},{...uso,tokensSaida:-1},{...uso,tokensCache:NaN},{...uso,tokensEscritaCache:0.5},{...uso,tokensEntrada:Infinity}])("uso ausente/parcial/inválido permanece desconhecido %j",async(u)=>{expect(await envelope({texto:"texto",recusa:false,uso:u})).toMatchObject({tipo:"incerto",fase:"possivelmente-enviado",codigo:"USO_DESCONHECIDO",uso:null});});
it("recusa com uso conhecido continua contabilizável",async()=>{expect(await envelope({texto:"",recusa:true,uso})).toMatchObject({tipo:"resposta",recusa:true,uso});});
it("corpo inválido conserva uso conhecido sem inventar análise",async()=>{expect(await envelope({texto:{malformado:true},recusa:false,uso})).toMatchObject({tipo:"incerto",codigo:"CORPO_INVALIDO",uso});});
it("erro de transporte sem corpo não vira resposta de custo zero",async()=>{const e=await envelope(new Error("rede"));expect(e).toMatchObject({tipo:"incerto",uso:null});expect(JSON.stringify(e)).not.toContain("tokensEntrada");});
it("metadados extras não atravessam o envelope",async()=>{const e=await envelope({texto:"texto",recusa:false,uso,prompt:"segredo",chave:"segredo"});expect(JSON.stringify(e)).not.toContain("segredo");});
