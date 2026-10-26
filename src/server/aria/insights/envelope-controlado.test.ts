import { expect,it } from "vitest";
import type { RespostaIA } from "../provedor/tipos";
import { envelopeRespostaControladaInsight } from "./envelope";
const uso={tokensEntrada:10,tokensSaida:5,tokensCache:0,tokensEscritaCache:0};
const resposta=():RespostaIA=>({texto:'{"fake":true}',modelo:"claude-sonnet-5-5",provedor:"anthropic",recusa:false,...uso,latenciaMs:10});
async function adaptar(r:RespostaIA){return envelopeRespostaControladaInsight(r,"claude-sonnet-5-5");}
it("resposta legada sem diagnóstico não prova tokens/custo conhecidos",async()=>{expect(await adaptar(resposta())).toMatchObject({tipo:"incerto",modelo:null,uso:null,codigo:"USO_DESCONHECIDO"});});
it("modelo ausente preserva uso mas não inventa modelo pedido",async()=>{expect(await adaptar({...resposta(),diagnostico:{fase:"enviado",modeloObservado:null,uso,codigo:"MODELO_DESCONHECIDO"}})).toMatchObject({tipo:"incerto",modelo:null,uso,codigo:"MODELO_DESCONHECIDO"});});
it("modelo divergente é incerto mesmo que canônico",async()=>{expect(await adaptar({...resposta(),diagnostico:{fase:"enviado",modeloObservado:"claude-haiku-5-5",uso,codigo:"MODELO_DIVERGENTE"}})).toMatchObject({tipo:"incerto",modelo:"claude-haiku-5-5",uso,codigo:"MODELO_DIVERGENTE"});});
it("diagnóstico completo e modelo esperado produzem envelope conhecido",async()=>{expect(await adaptar({...resposta(),diagnostico:{fase:"enviado",modeloObservado:"claude-sonnet-5-5",uso}})).toMatchObject({tipo:"resposta",modelo:"claude-sonnet-5-5",uso,recusa:false});});
it("tokens legacy não completam usage parcial do diagnóstico",async()=>{expect(await adaptar({...resposta(),diagnostico:{fase:"enviado",modeloObservado:"claude-sonnet-5-5",uso:null}})).toMatchObject({tipo:"incerto",uso:null,codigo:"USO_DESCONHECIDO"});});
