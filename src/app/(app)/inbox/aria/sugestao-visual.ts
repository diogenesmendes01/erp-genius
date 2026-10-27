import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";
import { ACAO_AGENTE_IA_LABEL, ETAPA_LABEL } from "@/lib/labels";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { ordenarPorAplicacao } from "@/server/aria/ordem-turno";

export interface VisualSugestao {
 cabecalho:string; titulo:string;
 linhas:{icone:"enviar"|"agendar"|"etapa"|"tarefa"|"tag"|"campo"|"perdido"|"nota"|"condicao";texto:string}[];
 textoProposto:string|null; avisoEnvio:boolean; rotuloAprovar:string; rotuloRejeitar:string;
 pendente:boolean; decidido:{tom:"brand"|"neutro";texto:string}|null; expira:string|null;
}
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
  const desfeita=s.status==="DESFEITA";
  const nome=(desfeita?s.desfeitaPorNome:s.decididaPorNome)?.trim().split(/\s+/)[0];
  const autor=(desfeita?s.desfeitaPorId:s.decididaPorId)===o.usuarioId?"você":nome;
  const texto=s.status==="APROVADA"?"Aprovado"+(autor?" por "+autor:""):s.status==="REJEITADA"?"Rejeitado":s.status==="EXECUTADA"?"Executado":desfeita?"Desfeito"+(autor?" por "+autor:""):"Expirou";
  decidido={tom:s.status==="APROVADA"?"brand":"neutro",texto:texto+((desfeita?s.desfeitaEm:s.decididaEm)?" · "+hora((desfeita?s.desfeitaEm:s.decididaEm)!):"")};
 }
 return {cabecalho:pendente?"Aria sugere · aguardando aprovação":"Aria sugeriu",titulo,linhas,
  textoProposto:d.tipo==="enviar"||d.tipo==="agendar"||d.tipo==="nota"?s.texto:null,
  avisoEnvio:pendente&&d.tipo==="enviar",rotuloAprovar:d.tipo==="enviar"?"Aprovar e enviar":d.tipo==="agendar"?"Agendar":"Aprovar",
  rotuloRejeitar:d.tipo==="agendar"?"Ignorar":"Rejeitar",pendente,decidido,expira:pendente&&s.expiraEm?"Expira às "+hora(s.expiraEm):null};
}

export interface VisualPacote {
 cabecalho:string; titulo:string; justificativa:string|null;
 itens:{s:SugestaoAriaThread;v:VisualSugestao;linha:VisualSugestao["linhas"][number]}[];
 avisoEnvio:boolean; rotuloAprovar:string; rotuloRejeitar:string; expira:string|null;
}
export function visualPacote(pacote:readonly SugestaoAriaThread[],o:{usuarioId:string;fuso:string|null}):VisualPacote {
 const itens=ordenarPorAplicacao(pacote).map(s=>{const v=visualSugestao(s,o);return {s,v,linha:v.linhas[0]??{icone:"nota" as const,texto:v.titulo}};});
 const titulos=itens.map((x,i)=>i===0?x.v.titulo:x.v.titulo.charAt(0).toLocaleLowerCase("pt-BR")+x.v.titulo.slice(1));
 const titulo=titulos.length>1?titulos.slice(0,-1).join(", ")+" e "+titulos.at(-1):titulos[0]??"";
 const expiracoes=pacote.flatMap(s=>s.expiraEm&&Number.isFinite(Date.parse(s.expiraEm))?[s.expiraEm]:[]).sort((a,b)=>Date.parse(a)-Date.parse(b));
 const envia=itens.some(x=>x.v.avisoEnvio);
 return {cabecalho:"Aria sugere "+pacote.length+" ações · aguardando aprovação",titulo,
  justificativa:pacote.find(s=>s.justificativa?.trim())?.justificativa??null,itens,avisoEnvio:envia,
  rotuloAprovar:envia?"Aprovar tudo e enviar":"Aprovar tudo",rotuloRejeitar:"Rejeitar tudo",
  expira:expiracoes[0]?"Expira às "+formatarInstanteExibicao(expiracoes[0],o.fuso,"UTC","hora").texto:null};
}
