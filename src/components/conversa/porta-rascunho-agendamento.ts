import type {Resultado} from "@/server/_shared/resultado";
export interface PortaRascunhoAgendamento {atendimentoId:string;textoAtual:string;revisao:string;salvar(pedido:{texto:string;revisaoEsperada:string}):Resultado;}
export type PublicarPortaRascunhoAgendamento=(porta:PortaRascunhoAgendamento|null)=>void;