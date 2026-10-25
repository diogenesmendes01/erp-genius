import {instanteDoCampoLocal} from "@/server/operacao/fuso-entrada";
export function validarTarefaModal(i:{titulo:string;descricao?:string;dataCivil:string|null;hora:string|null;lembreteAntecedenciaMin:number|null;fusoEscola:string}):string|null{
 if(!i.titulo.trim())return "Dê um título para a tarefa.";
 if(i.titulo.trim().length>200)return "O título deve ter até 200 caracteres.";
 if((i.descricao??"").trim().length>2000)return "A descrição deve ter até 2000 caracteres.";
 if(!i.dataCivil&&i.hora)return "Informe a data para definir o horário.";
 if(i.lembreteAntecedenciaMin!==null&&!(i.dataCivil&&i.hora))return "O lembrete exige data e horário.";
 if(i.dataCivil){const d=new Date(i.dataCivil+"T00:00:00Z");if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==i.dataCivil)return "Informe uma data válida.";}
 if(i.dataCivil&&i.hora){const r=instanteDoCampoLocal(i.dataCivil+"T"+i.hora,i.fusoEscola);if(!r.ok)return r.erro;}
 return null;
}
