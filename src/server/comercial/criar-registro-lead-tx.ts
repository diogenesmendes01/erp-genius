// Registro interno na transação do caller; normalização, código e autorização ficam fora.
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { LeadSchema } from "./schema";
import type { MarcaIdempotencia } from "@/server/_shared/idempotencia";
import { registrarEvento } from "@/server/_shared/evento";
export interface RegistroLeadTx {
 dados: z.output<typeof LeadSchema>; codigo: string; telefoneE164: string|null; pessoaId: string|null;
 empresaId: string|null; donoId: string|null; autorId: string; marca: MarcaIdempotencia|null;
}
export async function criarRegistroLeadTx(tx: Prisma.TransactionClient, entrada: RegistroLeadTx): Promise<string> {
 const { dados, codigo, telefoneE164, pessoaId, empresaId, donoId, autorId, marca } = entrada;
 const lead = await tx.oportunidade.create({
   data: {
     codigo,
     nome: dados.nome,
     telefoneE164,
     pessoaId,
     origemCanal: dados.origemCanal ?? null,
     empresaId,
     paisId: dados.paisId || null,
     segmento: dados.segmento,
     temperatura: dados.temperatura,
     b2b: dados.criarEmpresa || dados.b2b,
     vendedorDonoId: donoId,
     origemCampanha: dados.origemCampanha || null,
     origemConjunto: dados.origemConjunto || null,
     origemAnuncio: dados.origemAnuncio || null,
     origemPalavra: dados.origemPalavra || null,
     valorPrevisto: dados.valorPrevisto ?? null,
     planoPrevisto: dados.planoPrevisto || null,
     comissaoPrevista: dados.comissaoPrevista ?? null,
   },
 });
 await registrarEvento(tx, {
   tipo: "LeadCriado",
   agregadoTipo: "Lead",
   agregadoId: lead.id,
   autorId: autorId,
   payload: { codigo, nome: lead.nome, segmento: lead.segmento, b2b: lead.b2b, pessoaId, empresaId, ...marca },
 });
 if (donoId) {
   await registrarEvento(tx, {
     tipo: "LeadAtribuido",
     agregadoTipo: "Lead",
     agregadoId: lead.id,
     autorId: autorId,
     payload: { de: null, para: donoId },
   });
 }
 return lead.id;
}
