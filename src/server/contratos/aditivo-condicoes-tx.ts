import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { PrepararAditivoContratualSchema } from "./aditivo-schema";
import { conferirAutor } from "./modelos-tx";
import { hashSubstituicao } from "./substituicao-estado";
import { representarValorAlteracaoAditivo, validarValorAlteracaoAditivo } from "./aditivo-valores";

const Entrada=z.object({matriculaId:z.string().min(1),propostaId:z.string().min(1),conclusaoId:z.string().min(1),revisaoHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.JsonObject;
export async function registrarCondicoesFormalizadasAditivoTx(tx:Prisma.TransactionClient,autorId:string,input:unknown){
 const d=Entrada.parse(input);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
 const e=await carregarEstadoConferenciaFinalAditivoTx(tx,d);if(e.dados.ambiente!=="PRODUCAO")throw new ErroRegra("Condições formalizadas exigem conclusão em produção.");
 await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${d.matriculaId} FOR UPDATE`;await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaAditivo" WHERE id=${e.dados.processoId} FOR UPDATE`;await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autorId} FOR SHARE`;await conferirAutor(tx,autorId);
 if(d.revisaoHash!==e.revisaoHash)throw new ErroRegra("A conferência final mudou.");const final=await tx.conferenciaFinalAditivo.findUnique({where:{conclusaoId:d.conclusaoId}});if(!final||final.revisaoHash!==e.revisaoHash||hashSubstituicao(final.snapshot)!==final.revisaoHash)throw new ErroRegra("A conferência final exata é obrigatória.");
 const proposta=await tx.propostaAditivoContratual.findUniqueOrThrow({where:{id:d.propostaId}}),entrada=PrepararAditivoContratualSchema.parse((proposta.snapshot as {entrada:unknown}).entrada),alteradas:Record<string,unknown>={};
 for(const a of entrada.alteracoes){if(!a.valorEstruturado)throw new ErroRegra("Toda alteração precisa de valor estruturado antes da formalização.");const v=validarValorAlteracaoAditivo(a.origem,a.valorEstruturado);if(v.tipo==="AGENDA")throw new ErroRegra("A agenda ainda exige integração própria.");if(a.novo!==representarValorAlteracaoAditivo(v))throw new ErroRegra("Texto da alteração diverge do valor estruturado.");alteradas[a.origem]=v;}
 const existente=await tx.versaoCondicoesAditivo.findUnique({where:{propostaId:d.propostaId}});const anterior=existente ? (existente.anteriorId ? await tx.versaoCondicoesAditivo.findUnique({where:{id:existente.anteriorId}}) : null) : await tx.versaoCondicoesAditivo.findFirst({where:{matriculaId:d.matriculaId},orderBy:{versao:"desc"}});
 if(anterior&&hashSubstituicao(anterior.condicoes)!==anterior.condicoesHash)throw new ErroRegra("A versão anterior das condições diverge de sua integridade.");const condicoes=json({...((anterior?.condicoes as object)??{}),...alteradas}),condicoesHash=hashSubstituicao(condicoes);
 if(existente){if(existente.conferenciaFinalId!==final.id||existente.autorId!==autorId||existente.condicoesHash!==condicoesHash)throw new ErroRegra("A proposta já formalizou outras condições.");return{id:existente.id,versao:existente.versao};}
 if(anterior&&e.dados.vigenciaInicio<=anterior.vigenciaInicio.toISOString())throw new ErroRegra("A vigência precisa ser posterior à versão formalizada anterior.");const v=await tx.versaoCondicoesAditivo.create({data:{matriculaId:d.matriculaId,propostaId:d.propostaId,conferenciaFinalId:final.id,autorId,versao:(anterior?.versao??0)+1,anteriorId:anterior?.id,condicoes,condicoesHash,vigenciaInicio:new Date(e.dados.vigenciaInicio)}});await registrarEvento(tx,{tipo:"CondicoesAditivoFormalizadas",agregadoTipo:"Matricula",agregadoId:d.matriculaId,autorId,payload:{propostaId:d.propostaId,versao:v.versao,condicoesHash}});return{id:v.id,versao:v.versao};
}
