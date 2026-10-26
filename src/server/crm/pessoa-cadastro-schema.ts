import {z} from "zod";
import {codigoISO,validarDocumento} from "@/server/_shared/validacao";
import {NascimentoCivilSchema} from "@/lib/nascimento-civil";
const vazioParaNull=(v:unknown)=>typeof v==="string"?(v.trim()||null):v;
const texto=z.preprocess(vazioParaNull,z.string().nullable()).optional();
/** Contrato puro reutilizado pelo writer CRM; fronteiras Inbox/DTO/UI têm autorização própria. */
export const PessoaCadastroPatchSchema=z.object({
 documento:texto,
 tipoDocumentoId:texto,
 documentoPaisEmissor:z.preprocess(vazioParaNull,codigoISO.nullable()).optional(),
 nascimento:z.preprocess(vazioParaNull,NascimentoCivilSchema.nullable()).optional(),
}).strict();
export type CadastroPessoa={documento:string|null;tipoDocumentoId:string|null;documentoPaisEmissor:string|null;nascimento:string|null};
export type PessoaCadastroPatch=z.input<typeof PessoaCadastroPatchSchema>;
const CAMPOS=["documento","tipoDocumentoId","documentoPaisEmissor","nascimento"] as const;
/** Omissão preserva; null limpa só o campo explícito. Nenhuma cópia de outros modelos/campos raw. */
export function aplicarCadastroPessoa(atual:CadastroPessoa,input:PessoaCadastroPatch):CadastroPessoa{
 const patch=PessoaCadastroPatchSchema.parse(input);
 const novo:CadastroPessoa={documento:atual.documento,tipoDocumentoId:atual.tipoDocumentoId,documentoPaisEmissor:atual.documentoPaisEmissor,nascimento:atual.nascimento};
 for(const k of CAMPOS)if(patch[k]!==undefined)novo[k]=patch[k];
 return novo;
}
export type TipoDocumentoPessoa={id:string;paisId:string;validador:string};
/** Coerência do catálogo/FK é distinta de formato: formato inválido NÃO veta o número. */
export function avaliarDocumentoPessoa(c:CadastroPessoa,tipo:TipoDocumentoPessoa|null,paisCatalogoEsperado?:string):{coerente:boolean;validado:boolean}{
 if(!c.tipoDocumentoId)return {coerente:true,validado:false};
 if(!tipo||tipo.id!==c.tipoDocumentoId||paisCatalogoEsperado!==undefined&&tipo.paisId!==paisCatalogoEsperado)return {coerente:false,validado:false};
 return {coerente:true,validado:!!c.documento&&validarDocumento(tipo.validador,c.documento)};
}
export function camposCadastroAlterados(antes:CadastroPessoa,depois:CadastroPessoa){return CAMPOS.filter(k=>antes[k]!==depois[k]);}
/** Payload cadastral do writer: só presença/alteração; nunca número, data, idade ou hash de PII. */
export function auditoriaCadastroPessoa(antes:CadastroPessoa,depois:CadastroPessoa){
 const campos=camposCadastroAlterados(antes,depois);
 const payload:Partial<Record<"documento"|"nascimento",{de:"definido"|null;para:"definido"|null}>>={};
 if(campos.some(c=>c!=="nascimento"))payload.documento={de:antes.documento?"definido":null,para:depois.documento?"definido":null};
 if(campos.includes("nascimento"))payload.nascimento={de:antes.nascimento?"definido":null,para:depois.nascimento?"definido":null};
 return payload;
}
