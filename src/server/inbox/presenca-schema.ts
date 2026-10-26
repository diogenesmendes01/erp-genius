import {z} from "zod";
const contador=z.string().regex(/^(0|[1-9][0-9]{0,18})$/).refine(s=>BigInt(s)<=9223372036854775807n).transform(s=>BigInt(s));
const geracao=contador.refine(n=>n>=1n);
const id=z.string().min(1).max(128);
const consulta=z.object({atendimentoId:id,tokenModal:z.string().min(1).max(128)}).strict();
export const EntradaPresencaSchema=z.discriminatedUnion("modo",[
 z.object({modo:z.literal("resolver"),abaId:z.string().uuid()}).strict(),
 z.object({modo:z.literal("abrir"),abaId:z.string().uuid(),aberturaId:z.string().uuid(),geracaoEsperada:geracao.nullable(),inscricaoEsperada:id.nullable(),causa:z.enum(["entrada","reconexao"])}).strict(),
 z.object({modo:z.literal("pulso"),id,geracao,seq:contador,consulta:consulta.optional()}).strict(),
 z.object({modo:z.literal("interacao"),id,geracao,seq:contador}).strict(),
 z.object({modo:z.literal("fechar"),id,geracao,seq:contador}).strict(),
 z.object({modo:z.literal("ler"),consulta}).strict(),
]).superRefine((e,ctx)=>{
 if(e.modo==="abrir"&&((e.geracaoEsperada===null)!==(e.inscricaoEsperada===null)||(e.causa==="reconexao"&&e.inscricaoEsperada===null)))ctx.addIssue({code:"custom",message:"Binding de abertura inválido."});
});
export type EntradaPresenca=z.infer<typeof EntradaPresencaSchema>;
export type ConsultaPresenca=z.infer<typeof consulta>;
/** Origin obrigatório e header custom não simples: não aceita form CSRF nem fallback por Host. */
export function origemPresencaValida(req:Request,origem:string|undefined):boolean {
 try {
  if(!origem)return false;const esperada=new URL(origem).origin;
  return req.headers.get("origin")===esperada&&req.headers.get("sec-fetch-site")==="same-origin"&&req.headers.get("x-inbox-presenca")==="1"&&req.headers.get("content-type")?.split(";")[0].trim().toLowerCase()==="application/json";
 }catch{return false;}
}
