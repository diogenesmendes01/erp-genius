import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento, type No } from "@/test/dom-minimo";

// Revisão da #249, C1: no fluxo "confirma no ConfirmarAcao → fecha → FeedbackAcao da página mostra o
// resultado", o texto entra na região role="status" no MESMO commit em que o Modal desmonta. Se o fundo só
// fosse solto na limpeza do useEffect (passiva, numa tarefa depois do commit), a região ainda estaria
// dentro de um ancestral `inert` quando o texto chega — fora da árvore de acessibilidade, sem anúncio.
// Aqui o React DOM roda de verdade sobre um DOM mínimo (src/test/dom-minimo.ts), e um MutationObserver
// confere, quando os registros da mutação são entregues (microtask logo depois do commit, antes de
// qualquer tarefa seguinte — como o navegador entrega ao leitor de tela), que a região já não está inert.
// O Scheduler do React roda os efeitos passivos na mesma tarefa do commit enquanto a fatia de 5 ms não
// acaba; numa página real o commit costuma passar disso, e aí eles ficam para outra tarefa. O teste força
// esse caso avançando o relógio do Scheduler (`performance.now`) 3 ms a cada leitura: a fatia começa com
// folga para um trabalho e se esgota logo depois dele, e o navegador (aqui, a microtask do observador) vê o DOM entre o commit e os efeitos passivos.

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
    // Mesmo com o teste falhando no meio: nada do React pode rodar depois de o DOM sair do escopo global.
    desmontar?.();
    for (let i = 0; i < 20; i++) await proximaTarefa();
    desligarObservadores();
    vi.unstubAllGlobals();
  });

  it("fechar o modal e publicar o sucesso no mesmo lote: a região status já não está inert quando o texto chega", async () => {
    // react-dom decide `canUseDOM` ao carregar: só depois de instalar o DOM.
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
      // O `aoConcluir` típico das telas: fecha a confirmação e anuncia o resultado na própria página.
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
    // Quem abriu o modal tem o foco antes de ele abrir.
    doc.getElementById("abridor")!.focus();
    abrir!();
    await ate(() => container.inert, "fundo isolado com o modal aberto");

    const regiao = container.querySelector("[role='status']")!;
    expect(regiao).not.toBeNull();
    expect(regiao.textContent).toBe("");
    expect(dentroDeInert(regiao)).toBe(true); // enquanto o modal está aberto, a página fica fora da árvore
    expect(doc.activeElement.textContent).toBe("Voltar"); // foco entrou antes do inert

    const anuncios: { texto: string; inert: boolean }[] = [];
    const observador = new MutationObserver(() => {
      if (regiao.textContent) anuncios.push({ texto: regiao.textContent, inert: dentroDeInert(regiao) });
    });
    observador.observe(regiao as unknown as Node, { subtree: true, childList: true, characterData: true });

    // Depois do `await` da ação (sem evento em andamento): prioridade padrão, como no ConfirmarAcao.
    await Promise.resolve();
    // Revisão da #250, C1: este passo depende de detalhes internos do Scheduler do React (pacote `scheduler`,
    // 0.23.2 com react-dom 18.3.1): `frameYieldMs = 5` e `shouldYieldToHost()` medindo o tempo por
    // `performance.now()` (lido no objeto global, por isso o spy funciona). Se o teste quebrar, ou passar
    // trivialmente, depois de um upgrade do React, confira em node_modules/scheduler/cjs/scheduler.development.js:
    // (1) se a fatia ainda é de 5 ms e o passo de 3 ms ainda cabe uma vez nela e a esgota na leitura seguinte;
    // (2) se o relógio ainda vem de `performance.now` (e não de `Date.now` ou de uma referência guardada à função);
    // (3) se os efeitos passivos ainda ficam para outra tarefa quando a fatia acaba. Para saber se o caso ainda
    // é exercitado, troque o `useEfeitoDeLayout` de `useDialogo` por `useEffect`: o teste tem de falhar.
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
    // A limpeza passiva devolve o foco a quem abriu, com o fundo já solto (num fundo inert o focus() falharia).
    await ate(() => doc.activeElement.id === "abridor", "foco devolvido a quem abriu");
  });
});
