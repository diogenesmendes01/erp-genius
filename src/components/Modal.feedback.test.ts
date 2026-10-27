import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento, type No } from "@/test/dom-minimo";

const proximaTarefa = () => new Promise<void>((r) => setImmediate(r));

async function ate(condicao: () => boolean, descricao: string) {
  for (let i = 0; i < 50; i++) {
    if (condicao()) return;
    await proximaTarefa();
  }
  throw new Error(`não aconteceu: ${descricao}`);
}

function dentroDeInert(no: No | null): boolean {
  for (let n = no; n; n = n.parentNode) if ((n as Elemento).inert) return true;
  return false;
}

describe("Modal em portal: o fundo é solto antes de o resultado entrar na região da página (#249 C1)", () => {
  let doc: Documento;
  let desmontar: (() => void) | undefined;
  beforeAll(() => {
    const dom = criarDomMinimo();
    doc = dom.documento;
    vi.stubGlobal("window", dom.janela);
    vi.stubGlobal("document", dom.documento);
    vi.stubGlobal("MutationObserver", dom.MutationObserver);
  });
  afterAll(async () => {
    desmontar?.();
    for (let i = 0; i < 20; i++) await proximaTarefa();
    desligarObservadores();
    vi.unstubAllGlobals();
  });

  it("fechar o modal e publicar o sucesso no mesmo lote: a região status já não está inert quando o texto chega", async () => {
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { Modal } = await import("@/components/Modal");
    const { FeedbackAcao } = await import("@/components/FeedbackAcao");
    const h = React.createElement;

    let abrir: (() => void) | null = null;
    let concluir: (() => void) | null = null;
    function Pagina(): ReactNode {
      const [confirmando, setConfirmando] = React.useState(false);
      abrir = () => setConfirmando(true);
      const [sucesso, setSucesso] = React.useState<string | null>(null);
      concluir = () => { setConfirmando(false); setSucesso("Cobrança enviada para Ana."); };
      return h("main", null,
        h("button", { type: "button", id: "abridor" }, "Enviar cobrança"),
        h(FeedbackAcao, { erro: null, sucesso }),
        confirmando && h(Modal, { titulo: "Enviar a cobrança?", papel: "alertdialog", aoFechar: () => setConfirmando(false) },
          h("button", { type: "button" }, "Voltar")));
    }

    const container = doc.createElement("div");
    doc.body.appendChild(container);
    const root = createRoot(container as unknown as HTMLElement);
    desmontar = () => root.unmount();
    root.render(h(Pagina));
    await ate(() => doc.getElementById("abridor") !== null, "página montada");
    doc.getElementById("abridor")!.focus();
    abrir!();
    await ate(() => container.inert, "fundo isolado com o modal aberto");

    const regiao = container.querySelector("[role='status']")!;
    expect(regiao).not.toBeNull();
    expect(regiao.textContent).toBe("");
    expect(dentroDeInert(regiao)).toBe(true);
    expect(doc.activeElement.textContent).toBe("Voltar");

    const anuncios: { texto: string; inert: boolean }[] = [];
    const observador = new MutationObserver(() => {
      if (regiao.textContent) anuncios.push({ texto: regiao.textContent, inert: dentroDeInert(regiao) });
    });
    observador.observe(regiao as unknown as Node, { subtree: true, childList: true, characterData: true });

    await Promise.resolve();
    let relogio = performance.now();
    const fatiaEsgotada = vi.spyOn(performance, "now").mockImplementation(() => (relogio += 3));
    try {
      concluir!();
      await ate(() => anuncios.length > 0, "texto entrou na região status");
    } finally {
      fatiaEsgotada.mockRestore();
      observador.disconnect();
    }

    expect(anuncios[0]).toEqual({ texto: "Cobrança enviada para Ana.", inert: false });
    await ate(() => doc.body.querySelector("[role='alertdialog']") === null, "modal desmontado");
    expect(container.inert).toBe(false);
    await ate(() => doc.activeElement.id === "abridor", "foco devolvido a quem abriu");
  });
});
