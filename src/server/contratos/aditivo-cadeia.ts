import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { hashSubstituicao } from "./substituicao-estado";
import { OrigemCampoSchema } from "./campos";
import { validarValorAlteracaoAditivo } from "./aditivo-valores";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { OrigemCampo } from "./campos";
import type { ValorAlteracaoAditivo } from "./aditivo-valores";

type Elo = { id:string; matriculaId:string; propostaId:string; versao:number; anteriorId:string|null; vigenciaInicio:Date; condicoes:Prisma.JsonValue; condicoesHash:string; conferenciaFinal:{ conclusao:{ originalHash:string;pdfHash:string;pdfAssinado:Buffer; processo:{ ambiente:string; proposta:{id:string;matriculaId:string}; artefato:{id:string;pdfHash:string} } } } };
/** Valida fatos já carregados e produz a cadeia documental sem efeitos. */
export function validarCadeiaAditivo(elos: readonly Elo[]) {
 const vistos=new Set<string>();let anterior:Elo|undefined;
 const referencias=elos.map(elo=>{if(elo.matriculaId!==elos[0].matriculaId||vistos.has(elo.id)||hashSubstituicao(elo.condicoes)!==elo.condicoesHash||(!anterior&&(elo.versao!==1||elo.anteriorId!==null))||(anterior&&(elo.versao!==anterior.versao+1||elo.anteriorId!==anterior.id||elo.vigenciaInicio<=anterior.vigenciaInicio))||elo.conferenciaFinal.conclusao.processo.proposta.matriculaId!==elo.matriculaId||elo.conferenciaFinal.conclusao.processo.proposta.id!==elo.propostaId||elo.conferenciaFinal.conclusao.processo.ambiente!=="PRODUCAO"||elo.conferenciaFinal.conclusao.originalHash!==elo.conferenciaFinal.conclusao.processo.artefato.pdfHash||createHash("sha256").update(elo.conferenciaFinal.conclusao.pdfAssinado).digest("hex")!==elo.conferenciaFinal.conclusao.pdfHash)throw new ErroRegra("A cadeia de condições do aditivo diverge de sua integridade.");vistos.add(elo.id);anterior=elo;return{documentoId:elo.conferenciaFinal.conclusao.processo.artefato.id,pdfHash:elo.conferenciaFinal.conclusao.pdfHash};});
 const condicoes:Partial<Record<OrigemCampo,ValorAlteracaoAditivo>>={};for(const elo of elos)for(const [campo,valor] of Object.entries(z.record(z.unknown()).parse(elo.condicoes))){const origem=OrigemCampoSchema.parse(campo);condicoes[origem]=validarValorAlteracaoAditivo(origem,valor);}return{referencias,ids:elos.map(r=>r.id),condicoes,ultimaVigencia:anterior?.vigenciaInicio??null};
}
export async function carregarCadeiaAditivoTx(tx:Prisma.TransactionClient,entrada:{matriculaId:string;antesDaVersao?:number}){
 const elos=await tx.versaoCondicoesAditivo.findMany({where:{matriculaId:entrada.matriculaId,...(entrada.antesDaVersao?{proposta:{versao:{lt:entrada.antesDaVersao}}}:{})},orderBy:{versao:"asc"},include:{conferenciaFinal:{include:{conclusao:{include:{processo:{include:{proposta:{select:{id:true,matriculaId:true}},artefato:{select:{id:true,pdfHash:true}}}}}}}}}});
 return validarCadeiaAditivo(elos as Elo[]);
}
