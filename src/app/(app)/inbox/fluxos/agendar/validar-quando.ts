import {instanteDoCampoLocal} from "@/server/operacao/fuso-entrada";
export function validarQuando(quando:string,fuso:string,agora:Date=new Date()):string|null{
 if(!quando)return "Escolha o dia e a hora do envio.";
 const r=instanteDoCampoLocal(quando,fuso);if(!r.ok)return r.erro;
 if(!Number.isFinite(agora.getTime()))return "Não foi possível conferir o horário atual. Tente novamente.";
 return r.instante.getTime()<=agora.getTime()?"Esse horário já passou. Escolha uma data e hora no futuro.":null;
}