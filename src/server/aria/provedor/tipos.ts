export type TarefaIA = "conversa" | "classificacao" | "resumo" | "extracao";

export interface PedidoIA {
  tarefa: TarefaIA;
  sistema: string;
  mensagens: { papel: "usuario" | "assistente"; texto: string }[];
  maxTokens: number;
  esquemaSaida?: Record<string, unknown>;
  pdfBase64?: string;
}

export interface RespostaIA {
  texto: string;
  modelo: string;
  provedor: "anthropic" | "simulado";
  recusa: boolean;
  tokensEntrada: number;
  tokensSaida: number;
  tokensCache: number;
  latenciaMs: number;
}

export interface ProvedorIA {
  nome: "anthropic" | "simulado";
  gerar(p: PedidoIA): Promise<RespostaIA>;
}

export interface ModelosIA {
  conversa: string;
  classificacao: string;
}

export class ErroProvedorIA extends Error {
  codigo: string;
  constructor(codigo: string, mensagem?: string) {
    super(mensagem ?? codigo);
    this.name = "ErroProvedorIA";
    this.codigo = codigo;
  }
}
