import {Papel,type FinalidadeAtendimentoWhatsApp} from "@prisma/client";
import {apenasPortal,type UsuarioSessao} from "@/server/_shared/sessao";
import {capacidadesCrm,setoresDoUsuario} from "./permissoes";

export type CandidatoNotificadoD10=UsuarioSessao&{ativo:boolean};
export type TarefaParaCandidatoD10={responsavelId:string|null;setor:FinalidadeAtendimentoWhatsApp;gerenteDoResponsavelId:string|null};
/**
 * Projeção pura da alçada própria já usada por tarefas.ver + escopoTarefas(equipe).
 * Os dados precisam vir frescos do servidor. Seleção não é grant; não consulta nem altera banco.
 * Prévia, writers, cron e sino fornecem dados atuais; esta projeção não consulta nem concede acesso.
 */
export function candidatoPodeLerTarefaD10(u:CandidatoNotificadoD10,t:TarefaParaCandidatoD10):boolean{
 if(!u.id||!u.ativo||apenasPortal(u))return false;
 const capacidades=capacidadesCrm(u.papeis);
 if(!capacidades.has("tarefas.ver"))return false;
 if(u.papeis.includes(Papel.ADMINISTRADOR))return true;
 if(t.responsavelId===u.id)return true;
 if(t.responsavelId===null&&setoresDoUsuario(u.papeis).includes(t.setor))return true;
 return t.responsavelId!==null&&capacidades.has("tarefas.equipe")&&t.gerenteDoResponsavelId===u.id;
}