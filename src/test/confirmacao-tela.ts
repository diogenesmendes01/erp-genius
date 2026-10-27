import { ConfirmarAcao, type PropsConfirmarAcao } from "@/components/ConfirmarAcao";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { criarGanchos, elementos, texto, type Ganchos, type No } from "./tela-sem-dom";

export type TrocaDeGanchos = (g: Ganchos) => Ganchos;

export const propsDaConfirmacao = (c: No): PropsConfirmarAcao<unknown> => c.props as unknown as PropsConfirmarAcao<unknown>;

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
