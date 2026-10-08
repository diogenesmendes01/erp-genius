import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, type Mock } from "vitest";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { elementos, texto } from "@/test/tela-sem-dom";

// O que a tela ANUNCIA depois de uma ação (docs/42-auditoria-frontend-ux.md, E3; docs/43, §6 item 2):
// erro em role="alert" (anunciado na hora, em vermelho), sucesso em role="status" (região polite) —
// nunca os dois na mesma região. Lido sem DOM: a árvore do componente (chamado com os ganchos de
// src/test/tela-sem-dom.ts) é percorrida; cada <FeedbackAcao>/<MensagemStatus> é renderizado à parte
// com renderToStaticMarkup (é o HTML que vai para a tela), e os elementos nativos com `role` são lidos
// direto. Só texto não vazio entra.

export type Anuncios = { alerta: string[]; status: string[] };

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#x27;": "'", "&#39;": "'", "&nbsp;": "\u00a0" };
const decodifica = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|nbsp|#x27|#39);/g, (e) => ENTIDADES[e]);

/** Textos em role="alert" e role="status" de um trecho de HTML (o conteúdo de cada região). */
export function regioesDoHtml(html: string): Anuncios {
  const saida: Anuncios = { alerta: [], status: [] };
  for (const m of html.matchAll(/<(\w+)\b[^>]*\brole="(alert|status)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const t = decodifica(m[3]).trim();
    if (t) (m[2] === "alert" ? saida.alerta : saida.status).push(t);
  }
  return saida;
}

/** O que a árvore anuncia agora: FeedbackAcao/MensagemStatus renderizados e elementos nativos com role. */
export function anuncios(raiz: ReactNode): Anuncios {
  const saida: Anuncios = { alerta: [], status: [] };
  for (const n of elementos(raiz)) {
    if (n.type === FeedbackAcao || n.type === MensagemStatus) {
      const r = regioesDoHtml(renderToStaticMarkup(createElement(n.type as FunctionComponent<Record<string, unknown>>, n.props)));
      saida.alerta.push(...r.alerta);
      saida.status.push(...r.status);
    } else if (typeof n.type === "string" && (n.props.role === "alert" || n.props.role === "status")) {
      const t = texto(n.props.children).trim();
      if (t) (n.props.role === "alert" ? saida.alerta : saida.status).push(t);
    }
  }
  return saida;
}

/** O que passou a ser anunciado entre duas leituras (multiconjunto: textos fixos da tela se cancelam). */
export function novosAnuncios(antes: Anuncios, depois: Anuncios): Anuncios {
  const tira = (de: string[], base: string[]) => {
    const resto = [...base];
    return de.filter((t) => { const i = resto.indexOf(t); if (i < 0) return true; resto.splice(i, 1); return false; });
  };
  return { alerta: tira(depois.alerta, antes.alerta), status: tira(depois.status, antes.status) };
}

/** Promessa controlada: a action fica pendente até o teste decidir o desfecho. */
export type Adiada<T> = { promessa: Promise<T>; resolver: (v: T) => void; rejeitar: (e: unknown) => void };

export function adiada<T>(): Adiada<T> {
  let resolver!: (v: T) => void, rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => { resolver = res; rejeitar = rej; });
  return { promessa, resolver, rejeitar };
}

export type CenarioFeedback = {
  /** Nome curto do fluxo (entra no título de cada teste). */
  nome: string;
  /** Prepara a tela antes de cada caso (montar ganchos, preencher campos…). Opcional. */
  preparar?: () => void | Promise<void>;
  /** Render atual da tela (o componente chamado com os ganchos). */
  tela: () => ReactNode;
  /** Dispara a ação a partir da tela atual (clique ou submit); devolve a promessa do handler. */
  acionar: () => unknown;
  /** A server action (mock) que o fluxo chama. */
  action: Mock;
  /** Resposta de sucesso da action (padrão `{ ok: true }`). */
  respostaOk?: unknown;
  /** Texto de sucesso que a tela anuncia em role="status". */
  sucesso: string;
  /** Mensagem da falha de transporte (resultado incerto), anunciada em role="alert". */
  incerto: string;
  /** A tela mostra que está ocupada (rótulo de progresso, botão ou fieldset travado pela ação)? */
  ocupado: () => boolean;
};

const ERRO_DO_SERVIDOR = "Recusado pelo servidor: revise a proposta.";

/** Aciona com a action num desfecho e devolve o que passou a ser anunciado. */
async function anunciadoApos(c: CenarioFeedback, desfecho: () => void) {
  await c.preparar?.();
  const antes = anuncios(c.tela());
  desfecho();
  await c.acionar();
  return novosAnuncios(antes, anuncios(c.tela()));
}

/**
 * Os quatro casos do contrato de feedback separado, para um fluxo de uma tela:
 * - erro do servidor: só em role="alert" (nada novo em role="status");
 * - sucesso: só em role="status" (nenhum alerta novo);
 * - falha de rede/exceção: a mensagem de resultado incerto, em role="alert";
 * - ocupado durante a action e liberado depois de cada desfecho (erro, falha e sucesso, nesta ordem).
 */
export function contratoFeedbackSeparado(c: CenarioFeedback) {
  it(`${c.nome}: erro do servidor sai em role="alert", não em role="status"`, async () => {
    const novos = await anunciadoApos(c, () => c.action.mockResolvedValueOnce({ ok: false, erro: ERRO_DO_SERVIDOR }));
    expect(novos).toEqual({ alerta: [ERRO_DO_SERVIDOR], status: [] });
  });

  it(`${c.nome}: sucesso sai em role="status", sem alerta`, async () => {
    const novos = await anunciadoApos(c, () => c.action.mockResolvedValueOnce(c.respostaOk ?? { ok: true }));
    expect(novos).toEqual({ alerta: [], status: [c.sucesso] });
  });

  it(`${c.nome}: falha de rede vira resultado incerto em role="alert"`, async () => {
    const novos = await anunciadoApos(c, () => c.action.mockRejectedValueOnce(new TypeError("Failed to fetch")));
    expect(novos).toEqual({ alerta: [c.incerto], status: [] });
  });

  it(`${c.nome}: ocupado enquanto a action roda; sai do ocupado depois de erro, falha e sucesso`, async () => {
    await c.preparar?.();
    expect(c.ocupado(), "antes de acionar").toBe(false);
    const desfechos: [string, (p: Adiada<unknown>) => void][] = [
      ["erro", (p) => p.resolver({ ok: false, erro: ERRO_DO_SERVIDOR })],
      ["falha", (p) => p.rejeitar(new TypeError("Failed to fetch"))],
      ["sucesso", (p) => p.resolver(c.respostaOk ?? { ok: true })],
    ];
    for (const [nome, concluir] of desfechos) {
      const pendente = adiada<unknown>();
      c.action.mockReturnValueOnce(pendente.promessa);
      const execucao = c.acionar();
      expect(c.ocupado(), `durante (${nome})`).toBe(true);
      concluir(pendente);
      await execucao;
      expect(c.ocupado(), `depois (${nome})`).toBe(false);
    }
  });
}
