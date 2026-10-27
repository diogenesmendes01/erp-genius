export interface ControleExecucaoIA {
  signal?: AbortSignal;
  deadlineMs: number;
  maxRetries: 0;
}
export interface UsoChamadaIA {
  tokensEntrada: number;
  tokensSaida: number;
  tokensCache: number;
  tokensEscritaCache: number;
}
export interface DiagnosticoChamadaIA {
  fase: "nao-enviado" | "possivelmente-enviado" | "enviado";
  modeloObservado: string | null;
  uso: UsoChamadaIA | null;
  codigo?: string;
}
export type TarefaIA = "conversa" | "classificacao" | "resumo" | "extracao";

export interface PedidoIA {
  tarefa: TarefaIA;
  controle?: ControleExecucaoIA;
  sistema: string;
  mensagens: { papel: "usuario" | "assistente"; texto: string }[];
  maxTokens: number;
  esquemaSaida?: Record<string, unknown>;
  pdfBase64?: string;
}

export interface RespostaIA {
  diagnostico?: DiagnosticoChamadaIA;
  texto: string;
  modelo: string;
  provedor: "anthropic" | "simulado";
  recusa: boolean;
  tokensEntrada: number;
  tokensSaida: number;
  tokensCache: number;
  tokensEscritaCache: number;
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
  declare diagnostico?: DiagnosticoChamadaIA;
  constructor(codigo: string, mensagem?: string, diagnostico?: DiagnosticoChamadaIA) {
    super(mensagem ?? codigo);
    this.name = "ErroProvedorIA";
    this.codigo = codigo;
    if (diagnostico) this.diagnostico = diagnostico;
  }
}
