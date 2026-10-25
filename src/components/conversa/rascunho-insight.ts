import type { Resultado } from "@/server/_shared/resultado";
/** Porta local opt-in #377; não envia, assume, agenda ou altera outra modalidade. */
export interface PortaRascunhoInsight {
  atendimentoId:string;
  textoAtual:string;
  revisao:string;
  podeUsar:boolean;
  usar(pedido:{texto:string;geracaoId:string;revisaoEsperada:string}):Promise<Resultado>;
}
export type PublicarPortaRascunhoInsight=(porta:PortaRascunhoInsight|null)=>void;
