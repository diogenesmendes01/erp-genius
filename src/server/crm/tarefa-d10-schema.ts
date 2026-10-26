import { RecorrenciaTarefaSchema } from "./tarefa-recorrencia-configuracao";
import {z} from "zod";

/** Contrato aditivo D10 usado pelos writers e formulários; omissão preserva valores anteriores. */
export const PrioridadeTarefaD10Schema=z.enum(["BAIXA","NORMAL","ALTA"]);
export const LembreteTarefaD10Schema=z.union([z.literal(0),z.literal(10),z.literal(15),z.literal(30),z.literal(60),z.literal(1440)]).nullable();
const notificados=z.array(z.string().trim().min(1,"Colega inválido.")).transform(ids=>[...new Set(ids)].sort()).refine(ids=>ids.length<=200,"Selecione no máximo 200 colegas.");
/** Ausência preserva; lista vazia limpa. Ordem da seleção não muda a intenção normalizada. */
export const CamposAdicionaisTarefaD10Schema=z.object({
 prioridade:PrioridadeTarefaD10Schema.optional(),
 recorrencia:RecorrenciaTarefaSchema.optional(),
 lembreteAntecedenciaMin:LembreteTarefaD10Schema.optional(),
 notificarUsuarioIds:notificados.optional(),
}).strict();
export type CamposAdicionaisTarefaD10=z.input<typeof CamposAdicionaisTarefaD10Schema>;