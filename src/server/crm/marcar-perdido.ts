import {EtapaLead,Papel,type Prisma} from "@prisma/client";
import {ErroPermissao,exigirPapel,registrarEvento,type UsuarioSessao} from "@/server/_shared";
import {escopoComercialAtual} from "@/server/_shared/escopo-comercial";
import {ultimoEventoDoAutor} from "@/server/_shared/idempotencia";
import {PerdaSchema,type PerdaInput} from "@/server/comercial/schema";

/** Núcleo interno: nenhuma sessão, cliente global, revalidação de rota ou transação própria. */
export async function marcarPerdidoTx(tx:Prisma.TransactionClient,autor:UsuarioSessao,id:string,input:PerdaInput,revalidar?:()=>Promise<void>):Promise<boolean>{
  const dados=PerdaSchema.parse(input);
  await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${id} FOR UPDATE`;
  await revalidar?.();
  exigirPapel(autor,Papel.VENDEDOR,Papel.GERENTE_COMERCIAL);
  const atual=await tx.oportunidade.findFirst({where:{AND:[{id},await escopoComercialAtual(autor,tx)]},select:{etapa:true}});
  if(!atual)throw new ErroPermissao("Oportunidade fora da sua carteira.");
  if(atual.etapa===EtapaLead.PERDIDO){
    const p=await ultimoEventoDoAutor(tx,{tipo:"LeadPerdido",agregadoTipo:"Lead",agregadoId:id,autorId:autor.id});
    if(p&&p.motivoPerda===dados.motivoPerda&&p.observacao===(dados.observacao||null))return false;
  }
  await tx.oportunidade.update({where:{id},data:{etapa:EtapaLead.PERDIDO,motivoPerda:dados.motivoPerda}});
  await registrarEvento(tx,{tipo:"LeadPerdido",agregadoTipo:"Lead",agregadoId:id,autorId:autor.id,payload:{motivoPerda:dados.motivoPerda,observacao:dados.observacao||null}});
  return true;
}