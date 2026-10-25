import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import { ACAO_AGENTE_IA_LABEL, ETAPA_LABEL } from "@/lib/labels";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

export interface VisualSugestao {
 cabecalho:string; titulo:string;
 linhas:{icone:"enviar"|"agendar"|"etapa"|"tarefa"|"tag"|"campo"|"perdido"|"nota"|"condicao";texto:string}[];
 textoProposto:string|null; avisoEnvio:boolean; rotuloAprovar:string; rotuloRejeitar:string;
 pendente:boolean; decidido:{tom:"brand"|"neutro";texto:string}|null; expira:string|null;
}
/** Descrição de dados já autorizados/decodificados; não executa nem reinterpreta payload. */
export function visualSugestao(s:SugestaoAriaThread,o:{usuarioId:string;fuso:string|null}):VisualSugestao {
 const hora=(iso:string)=>formatarInstanteExibicao(iso,o.fuso,"UTC","hora").texto;
 const dataHora=(iso:string)=>formatarInstanteExibicao(iso,o.fuso,"UTC","dataHora").texto;
 const pendente=s.status==="SUGERIDA",d=s.detalhe;
 let titulo=ACAO_AGENTE_IA_LABEL[s.acao];const linhas:VisualSugestao["linhas"]=[];
 switch(d.tipo){
  case "enviar":titulo=d.documento?"Enviar documento ao contato":"Responder ao contato";linhas.push({icone:"enviar",texto:"Enviar a mensagem acima"});break;
  case "agendar":titulo="Agendar mensagem";linhas.push({icone:"agendar",texto:"Agendar a mensagem acima · "+dataHora(d.agendadaPara)});break;
  case "etapa":titulo="Mover para "+ETAPA_LABEL[d.para];linhas.push({icone:"etapa",texto:titulo});break;
  case "tarefa":titulo="Criar tarefa";linhas.push({icone:"tarefa",texto:"Criar tarefa: "+d.titulo+" · "+dataHora(d.venceEm)});break;
  case "tag":titulo="Aplicar a tag "+d.nome;linhas.push({icone:"tag",texto:"Adicionar a tag "+d.nome});break;
  case "campo":titulo="Preencher "+d.nome;linhas.push({icone:"campo",texto:d.nome+": "+d.valor});break;
  case "perdido":titulo="Marcar como perdido";linhas.push({icone:"perdido",texto:"Motivo: "+d.motivo});break;
  case "nota":titulo="Nota interna";break;
  case "condicao":titulo="Condição comercial";linhas.push({icone:"condicao",texto:d.descontoPct+"% de desconto em "+d.parcelas+"x"});break;
 }
 let decidido:VisualSugestao["decidido"]=null;
 if(!pendente){
  const nome=s.decididaPorNome?.trim().split(/\s+/)[0];
  const autor=s.decididaPorId===o.usuarioId?"você":nome;
  const texto=s.status==="APROVADA"?"Aprovado"+(autor?" por "+autor:""):s.status==="REJEITADA"?"Rejeitado":"Expirou";
  decidido={tom:s.status==="APROVADA"?"brand":"neutro",texto:texto+(s.decididaEm?" · "+hora(s.decididaEm):"")};
 }
 return {cabecalho:pendente?"Aria sugere · aguardando aprovação":"Aria sugeriu",titulo,linhas,
  textoProposto:d.tipo==="enviar"||d.tipo==="agendar"||d.tipo==="nota"?s.texto:null,
  avisoEnvio:pendente&&d.tipo==="enviar",rotuloAprovar:d.tipo==="enviar"?"Aprovar e enviar":d.tipo==="agendar"?"Agendar":"Aprovar",
  rotuloRejeitar:d.tipo==="agendar"?"Ignorar":"Rejeitar",pendente,decidido,expira:pendente&&s.expiraEm?"Expira às "+hora(s.expiraEm):null};
}
