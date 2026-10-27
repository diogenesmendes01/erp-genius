import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, type Mock } from "vitest";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { elementos, texto } from "@/test/tela-sem-dom";

export type Anuncios = { alerta: string[]; status: string[] };

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#x27;": "'", "&#39;": "'", "&nbsp;": "\u00a0" };
const decodifica = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|nbsp|#x27|#39);/g, (e) => ENTIDADES[e]);

export function regioesDoHtml(html: string): Anuncios {
  const saida: Anuncios = { alerta: [], status: [] };
  for (const m of html.matchAll(/<(\w+)\b[^>]*\brole="(alert|status)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const t = decodifica(m[3]).trim();
    if (t) (m[2] === "alert" ? saida.alerta : saida.status).push(t);
  }
  return saida;
}

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

export function novosAnuncios(antes: Anuncios, depois: Anuncios): Anuncios {
  const tira = (de: string[], base: string[]) => {
    const resto = [...base];
    return de.filter((t) => { const i = resto.indexOf(t); if (i < 0) return true; resto.splice(i, 1); return false; });
  };
  return { alerta: tira(depois.alerta, antes.alerta), status: tira(depois.status, antes.status) };
}

export type Adiada<T> = { promessa: Promise<T>; resolver: (v: T) => void; rejeitar: (e: unknown) => void };

export function adiada<T>(): Adiada<T> {
  let resolver!: (v: T) => void, rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => { resolver = res; rejeitar = rej; });
  return { promessa, resolver, rejeitar };
}

export type CenarioFeedback = {
  nome: string;
  preparar?: () => void | Promise<void>;
  tela: () => ReactNode;
  acionar: () => unknown;
  action: Mock;
  respostaOk?: unknown;
  sucesso: string;
  incerto: string;
  ocupado: () => boolean;
};

const ERRO_DO_SERVIDOR = "Recusado pelo servidor: revise a proposta.";

async function anunciadoApos(c: CenarioFeedback, desfecho: () => void) {
  await c.preparar?.();
  const antes = anuncios(c.tela());
  desfecho();
  await c.acionar();
  return novosAnuncios(antes, anuncios(c.tela()));
}

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
