import type { PedidoIA, ProvedorIA, RespostaIA } from "./tipos";

const PEDIDO_HUMANO = ["humano", "atendente", "pessoa"];

const SETORES: [string, string[]][] = [
  ["FINANCEIRO", ["boleto", "pagamento", "segunda via", "fatura", "pix"]],
  ["PEDAGOGICO", ["professor", "nota", "prova", "frequência", "turma"]],
  ["SECRETARIA", ["declaração", "certificado", "documento"]],
  [
    "COMERCIAL",
    ["quanto custa", "preço", "valor", "curso", "aula experimental", "matricular"],
  ],
];

function ultimaFalaUsuario(p: PedidoIA): string {
  for (let i = p.mensagens.length - 1; i >= 0; i--) {
    if (p.mensagens[i].papel === "usuario") return p.mensagens[i].texto.toLowerCase();
  }
  return "";
}

function montarTexto(p: PedidoIA): string {
  const fala = ultimaFalaUsuario(p);
  switch (p.tarefa) {
    case "classificacao": {
      const achado = SETORES.find(([, palavras]) => palavras.some((w) => fala.includes(w)));
      return JSON.stringify(
        achado ? { setor: achado[0], confianca: 90 } : { setor: null, confianca: 0 },
      );
    }
    case "extracao":
      return JSON.stringify({ texto: "" });
    case "resumo":
      return JSON.stringify({ resumo: "" });
    default: {
      const humano = PEDIDO_HUMANO.some((w) => fala.includes(w));
      return JSON.stringify({
        resposta: humano
          ? "Certo, vou chamar um atendente para continuar com você."
          : "Obrigada pela mensagem! Vou verificar e já te respondo.",
        acoes: [],
        confianca: humano ? 20 : 60,
        handoff: humano ? { motivo: "PEDIDO_HUMANO" } : null,
        fontes: [],
      });
    }
  }
}

export const provedorSimulado: ProvedorIA = {
  nome: "simulado",
  async gerar(p: PedidoIA): Promise<RespostaIA> {
    return {
      texto: montarTexto(p),
      modelo: "simulado",
      provedor: "simulado",
      recusa: false,
      tokensEntrada: 0,
      tokensSaida: 0,
      tokensCache: 0,
      latenciaMs: 0,
    };
  },
};
