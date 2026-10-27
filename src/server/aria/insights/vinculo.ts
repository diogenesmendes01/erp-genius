import { createHash } from "node:crypto";
import { z } from "zod";
const id=z.string().min(1);
const VinculoInsightSchema=z.object({
  atendimentoId:id,conversaId:id,numeroId:id,contatoId:id.nullable(),finalidade:id.nullable(),
  leadId:id.nullable(),leadContatoId:id.nullable(),pessoaContatoId:id.nullable(),pessoaLeadId:id.nullable(),
  alunoId:id.nullable(),matriculaId:id.nullable(),turmaId:id.nullable(),grupoId:id.nullable(),
});
export type VinculoInsight=z.infer<typeof VinculoInsightSchema>;
export function hashVinculoInsight(vinculo:unknown):string {
  return createHash("sha256").update(JSON.stringify(VinculoInsightSchema.parse(vinculo))).digest("hex");
}
export function pessoasCompativeisInsight(contato:string|null,lead:string|null):boolean {
  return contato===null||lead===null||contato===lead;
}
