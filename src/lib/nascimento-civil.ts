import {DataCivilSchema} from "@/server/matricula/cobertura";
/** DOB em SQL DATE e contrato YYYY: limite de representação, não política etária. */
export const NascimentoCivilSchema=DataCivilSchema.refine(v=>v.slice(0,4)!=="0000","Informe uma data de nascimento válida.");