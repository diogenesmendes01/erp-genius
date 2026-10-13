import { formatarDataCivil } from "@/lib/data-civil";
import { tokenPagamentoBemFormado } from "@/lib/token-pagamento";
import type { CobrancaPublica } from "@/server/financeiro/gateway";

// O que a página pública de pagamento diz em cada situação do link e da cobrança (docs/42 /pagar #2 e #3;
// docs/43 §6 item 8). Antes só havia "pago" ou "aberto": cancelada e vencida apareciam como em aberto, e o link
// inválido era uma linha vermelha sem saída. Cada caso tem título, explicação e o que fazer agora; só a cobrança
// pendente ou vencida mantém o caminho de pagamento, e só a que ainda está a pagar mostra o valor.

export type TomQuadro = "neutro" | "sucesso" | "aviso" | "erro";

export type QuadroPagamento = {
  /** Identifica o caso para a página e os testes (nunca vai para a tela). */
  caso: "link-invalido" | "link-expirado" | "paga" | "cancelada" | "vencida" | "pendente";
  tom: TomQuadro;
  titulo: string;
  texto: string;
  /** O que a pessoa faz agora. */
  saida: string;
  /** Mostra descrição, valor e vencimento (só quando ainda há algo a pagar). */
  mostraValor: boolean;
  /** Mantém o caminho de pagamento (botão no ambiente de teste, orientação fora dele). */
  podePagar: boolean;
};

const PROCURE_A_SECRETARIA = "Para pedir um novo link, fale com a Secretaria da escola pelo canal em que recebeu este.";

const LINK_INVALIDO: QuadroPagamento = {
  caso: "link-invalido", tom: "erro", mostraValor: false, podePagar: false,
  titulo: "Link de pagamento inválido",
  texto: "Este endereço não é um link de pagamento da escola. Ele pode ter sido cortado ao copiar.",
  saida: `Abra de novo o link inteiro que você recebeu. ${PROCURE_A_SECRETARIA}`,
};

const LINK_EXPIRADO: QuadroPagamento = {
  caso: "link-expirado", tom: "aviso", mostraValor: false, podePagar: false,
  titulo: "Link de pagamento expirado",
  texto: "Este link não está mais ligado a nenhuma cobrança: ele expirou ou foi substituído por um mais novo.",
  saida: `Use o link mais recente que a escola enviou. ${PROCURE_A_SECRETARIA}`,
};

const PAGA: QuadroPagamento = {
  caso: "paga", tom: "sucesso", mostraValor: false, podePagar: false,
  titulo: "Pagamento confirmado",
  texto: "Esta cobrança já está paga. Não é preciso pagar de novo.",
  saida: "Você pode fechar esta janela. Se precisar do comprovante, fale com a Secretaria da escola.",
};

const CANCELADA: QuadroPagamento = {
  caso: "cancelada", tom: "neutro", mostraValor: false, podePagar: false,
  titulo: "Cobrança cancelada",
  texto: "Esta cobrança foi cancelada pela escola e não deve ser paga.",
  saida: "Se você recebeu outra cobrança no lugar desta, use o link dela. Em caso de dúvida, fale com a Secretaria da escola.",
};

const PENDENTE: QuadroPagamento = {
  caso: "pendente", tom: "neutro", mostraValor: true, podePagar: true,
  titulo: "Pagamento em aberto",
  texto: "Confira a descrição, o valor e o vencimento acima antes de pagar.",
  saida: "Dúvidas sobre esta cobrança? Fale com a Secretaria da escola.",
};

/** O quadro da página para o token pedido e a cobrança que ele encontrou (null: nenhuma). */
export function quadroDoPagamento(token: string, cobranca: CobrancaPublica | null): QuadroPagamento {
  if (!cobranca) return tokenPagamentoBemFormado(token) ? LINK_EXPIRADO : LINK_INVALIDO;
  if (cobranca.status === "PAGO") return PAGA;
  if (cobranca.status === "CANCELADA") return CANCELADA;
  if (cobranca.status === "ATRASADO") {
    return {
      caso: "vencida", tom: "aviso", mostraValor: true, podePagar: true,
      titulo: "Cobrança vencida",
      texto: `O vencimento era ${formatarDataCivil(cobranca.vencimentoISO.slice(0, 10))}. Antes de pagar, confirme com a escola o valor atualizado.`,
      saida: "Fale com a Secretaria da escola para confirmar o valor e a forma de pagamento.",
    };
  }
  return PENDENTE;
}
