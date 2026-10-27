import {DataCivilSchema} from "@/server/matricula/cobertura";
export const NascimentoCivilSchema=DataCivilSchema.refine(v=>v.slice(0,4)!=="0000","Informe uma data de nascimento válida.");