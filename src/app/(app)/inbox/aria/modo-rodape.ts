import type {EstadoAria} from "@/server/inbox/estado-aria-valores";
export function modoRodape(estado:EstadoAria|null,nota:boolean):"travado"|"compositor" {return !nota&&(estado==="ia"||estado==="aprovacao"||estado==="handoff")?"travado":"compositor";}
export function textoTravado(estado:"ia"|"aprovacao"|"handoff"):string {return {ia:"Aria está respondendo esta conversa.",aprovacao:"Aria aguarda aprovação da sugestão acima.",handoff:"Aria parou de responder e aguarda um humano."}[estado];}
