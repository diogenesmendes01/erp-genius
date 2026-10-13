import { ConfirmarAcao, type PropsConfirmarAcao } from "@/components/ConfirmarAcao";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { criarGanchos, elementos, texto, type Ganchos, type No } from "./tela-sem-dom";

// Apoio dos testes de confirmação das telas (fatia B do ConfirmarAcao, issue #169). A tela é testada sem
// DOM (src/test/tela-sem-dom.ts): o <ConfirmarAcao> que ela devolve não é chamado, só as props dele são
// lidas. Para provar que o erro e o resultado incerto aparecem DENTRO do diálogo, este apoio roda o próprio
// componente com as props que a tela montou, em ganchos separados dos da tela, e clica "Confirmar …".
//
// `usar` troca os ganchos que o `vi.mock("react", …)` do teste consulta (m.ganchos) e devolve os anteriores;
// o mock precisa ligar useState, useCallback, useRef e useId aos ganchos (o diálogo usa os quatro).

export type TrocaDeGanchos = (g: Ganchos) => Ganchos;

/** Props do ConfirmarAcao que a tela entregou. */
export const propsDaConfirmacao = (c: No): PropsConfirmarAcao<unknown> => c.props as unknown as PropsConfirmarAcao<unknown>;

/**
 * Confirma no diálogo de verdade e devolve o que ele mostra depois: o erro do FeedbackAcao (null quando não
 * há) e se o botão de confirmação voltou a ficar disponível (o diálogo continua aberto para nova tentativa).
 */
export async function confirmarNoDialogo(confirmacao: No, usar: TrocaDeGanchos): Promise<{ erro: unknown; confirmarDisponivel: boolean }> {
  const g = criarGanchos();
  const anterior = usar(g);
  try {
    const props = propsDaConfirmacao(confirmacao);
    const render = () => g.renderizar(ConfirmarAcao<unknown>, props);
    const botaoConfirmar = (arvore: ReturnType<typeof render>) =>
      elementos(arvore).find((n: No) => n.type === Botao && texto(n.props.children).trim().startsWith("Confirmar "));
    const antes = botaoConfirmar(render());
    if (!antes) throw new Error("o ConfirmarAcao não tem o botão \"Confirmar …\"");
    await (antes.props.onClick as () => Promise<void>)();
    const depois = render();
    const feedback = elementos(depois).find((n: No) => n.type === FeedbackAcao);
    return { erro: feedback?.props.erro ?? null, confirmarDisponivel: botaoConfirmar(depois)?.props.disabled === false };
  } finally {
    usar(anterior);
  }
}
