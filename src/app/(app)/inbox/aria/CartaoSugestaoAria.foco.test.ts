// #350: reprodução versionada da prova TESTER84bc7e; os comentários de RED/privado no bloco original abaixo são históricos.
import { act, createElement, useState } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import type { Resultado } from "@/server/_shared/resultado";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";

// Privado TESTER: candidato RED ainda NÃO executado. Fonte nominal b0be613d.
// ReactDOM, cartão, Botao, useAcaoCliente e FeedbackAcao são reais.
const acoes = vi.hoisted(() => ({
  aprovar: vi.fn<() => Promise<Resultado>>(),
  rejeitar: vi.fn<() => Promise<Resultado>>(),
}));
vi.mock("@/server/aria/acoes", () => ({ aprovarAcaoAria: acoes.aprovar, rejeitarAcaoAria: acoes.rejeitar }));
// Apenas glifos: o DOM mínimo compartilhado não implementa namespace SVG.
vi.mock("@tabler/icons-react", async () => {
  const { createElement: el } = await import("react");
  const Icone = () => el("span", { "aria-hidden": true });
  return { IconSparkles: Icone, IconSend: Icone, IconClock: Icone, IconArrowRight: Icone,
    IconListCheck: Icone, IconTag: Icone, IconForms: Icone, IconX: Icone, IconNote: Icone,
    IconPercentage: Icone, IconAlertTriangle: Icone };
});

let Cartao: typeof import("@/app/(app)/inbox/aria/CartaoSugestaoAria").CartaoSugestaoAria;
let root: Root, host: Elemento, doc: Documento;
const ouvintes: { tipo: string; callback: (e: Event) => void; captura: boolean }[] = [];
const callback = vi.fn();
const sugestao = (id = "a"): SugestaoAriaThread => ({ id, turnoId: "turno-" + id,
  acao: "RESPONDER", status: "SUGERIDA", criadoEm: "2026-10-23T13:42:00Z", expiraEm: null,
  justificativa: "Dado fictício do contrafactual", texto: "Resposta fictícia", detalhe: { tipo: "enviar", documento: false },
  decididaPorId: null, decididaPorNome: null, decididaEm: null });
function deferred<T>() {
  let resolve!: (valor: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const botao = (texto: string) => host.querySelectorAll("button").find(b => b.textContent === texto)!;
async function clicar(alvo: Elemento) {
  await act(async () => {
    let parou = false;
    const e = { type: "click", target: alvo, button: 0, bubbles: true,
      preventDefault() {}, stopPropagation() { parou = true; } };
    for (const captura of [true, false]) for (const l of [...ouvintes]) {
      if (!parou && l.tipo === "click" && l.captura === captura) l.callback(e as unknown as Event);
    }
  });
}
function acessivel(no: Elemento): boolean {
  for (let atual: Elemento | null = no; atual; atual = atual.parentElement) {
    if (atual.hasAttribute("hidden") || atual.hasAttribute("inert") || atual.getAttribute("aria-hidden") === "true") return false;
  }
  return true;
}
function focoSignificativoDentro(cartao: Elemento): boolean {
  const ativo = doc.activeElement;
  if (!ativo || !ativo.isConnected || !cartao.contains(ativo) || !acessivel(ativo) || ativo.hasAttribute("disabled")) return false;
  // Não escolhe heading, article, botão ou live-region como destino obrigatório.
  return !!(ativo.textContent.trim() || ativo.getAttribute("aria-label")?.trim() || ativo.getAttribute("aria-labelledby")?.trim());
}
const regioes = () => host.querySelectorAll('[role="status"],[role="alert"],[aria-live="polite"],[aria-live="assertive"]');
function anuncioDecisao(status: "APROVADA" | "REJEITADA", anteriores: Set<Elemento>): boolean {
  const esperado = status === "APROVADA" ? /aprovad[oa]/i : /rejeitad[oa]/i;
  return regioes().some(no => no.isConnected && acessivel(no) && esperado.test(no.textContent)
    // Status/polite precisa existir antes do texto; alert tem semântica assertiva própria.
    && (anteriores.has(no) || no.getAttribute("role") === "alert"));
}
function conferir(cartao: Elemento, status: "APROVADA" | "REJEITADA", anteriores: Set<Elemento>, fase: string) {
  expect(host.querySelector("article"), "mesmo nó do cartão em " + fase).toBe(cartao);
  expect(cartao.isConnected, "cartão conectado em " + fase).toBe(true);
  expect(cartao.textContent).toMatch(status === "APROVADA" ? /aprovad[oa]/i : /rejeitad[oa]/i);
  expect.soft(focoSignificativoDentro(cartao), "foco conectado significativo no mesmo cartão em " + fase).toBe(true);
  expect.soft(anuncioDecisao(status, anteriores), "anúncio real do estado decidido em " + fase).toBe(true);
}

beforeEach(async () => {
  const dom = criarDomMinimo(); doc = dom.documento;
  vi.stubGlobal("document", doc); vi.stubGlobal("window", dom.janela); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  ouvintes.length = 0; host = doc.createElement("div"); doc.body.appendChild(host);
  Object.assign(host, { addEventListener(tipo: string, f: (e: Event) => void, captura = false) {
    ouvintes.push({ tipo, callback: f, captura });
  } });
  const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
  ({ CartaoSugestaoAria: Cartao } = await import("@/app/(app)/inbox/aria/CartaoSugestaoAria"));
  acoes.aprovar.mockReset(); acoes.rejeitar.mockReset(); callback.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });

describe("350: retorno autoritativo do pai no mesmo ID", () => {
  it.each([
    ["APROVADA", "ACK"], ["REJEITADA", "ACK"], ["APROVADA", "SSE antes do ACK"], ["REJEITADA", "SSE antes do ACK"],
  ] as const)("%s via %s conserva foco significativo e anuncia decisão", async (status, via) => {
    const fim = deferred<Resultado>();
    const executar = status === "APROVADA" ? acoes.aprovar : acoes.rejeitar;
    executar.mockReturnValue(fim.promise);
    let emitirStatus!: () => void;
    function Pai() {
      const [s, setS] = useState(() => sugestao("a"));
      const receberPainel = () => setS(ant => ({ ...ant, status, decididaPorId: "u", decididaPorNome: "Usuário fictício", decididaEm: "2026-10-23T13:50:00Z" }));
      emitirStatus = receberPainel;
      return createElement(Cartao, { s, usuarioId: "u", fuso: "UTC", aoDecidir() { callback(s.id); receberPainel(); } });
    }
    await act(async () => root.render(createElement(Pai)));
    const card = host.querySelector("article")!, liveAntes = new Set(regioes());
    const alvo = botao(status === "APROVADA" ? "Aprovar e enviar" : "Rejeitar");
    alvo.focus(); expect(doc.activeElement).toBe(alvo); expect(alvo.isConnected).toBe(true);
    await clicar(alvo); expect(executar).toHaveBeenCalledExactlyOnceWith("a");
    expect(callback).not.toHaveBeenCalled();
    if (via === "SSE antes do ACK") {
      await act(async () => emitirStatus());
      // Emulação apenas do dado autoritativo do mesmo GET/painel, sem simular o algoritmo do cartão.
      conferir(card, status, liveAntes, "SSE antes do ACK");
    }
    await act(async () => fim.resolve({ ok: true }));
    expect(callback).toHaveBeenCalledExactlyOnceWith("a");
    conferir(card, status, liveAntes, "após ACK");
  });
});

it("controle: erro mantém decisão pendente, alert real e foco conectado no contexto", async () => {
  const fim = deferred<Resultado>(); acoes.aprovar.mockReturnValue(fim.promise);
  await act(async () => root.render(createElement(Cartao, { s: sugestao(), usuarioId: "u", fuso: "UTC", aoDecidir: callback })));
  const alvo = botao("Aprovar e enviar"), card = host.querySelector("article")!;
  alvo.focus(); await clicar(alvo);
  await act(async () => fim.resolve({ ok: false, erro: "Esta sugestão expirou." }));
  const alert = host.querySelector('[role="alert"]')!;
  expect(alert.textContent).toContain("Esta sugestão expirou.");
  expect(botao("Aprovar e enviar").hasAttribute("disabled")).toBe(false);
  expect(botao("Rejeitar").isConnected).toBe(true); expect(callback).not.toHaveBeenCalled();
  expect(doc.activeElement?.isConnected).toBe(true); expect(card.contains(doc.activeElement)).toBe(true);
  // Preserva erro/alert real; aceita foco no disparador ou no próprio feedback, sem impor novo destino.
  expect(doc.activeElement === alvo || alert.contains(doc.activeElement)).toBe(true);
});

it("controle: ACK antigo desmontado não chama callback nem rouba foco do cartão B", async () => {
  const fim = deferred<Resultado>(); acoes.aprovar.mockReturnValue(fim.promise);
  let selecionar!: (id: string) => void;
  function Pai() {
    const [s, setS] = useState(() => sugestao("a")); selecionar = id => setS(sugestao(id));
    return createElement(Cartao, { s, usuarioId: "u", fuso: "UTC", aoDecidir() { callback(s.id); } });
  }
  await act(async () => root.render(createElement(Pai)));
  const antigo = botao("Aprovar e enviar"); antigo.focus(); await clicar(antigo);
  await act(async () => selecionar("b"));
  const novo = botao("Aprovar e enviar"); novo.focus(); expect(novo.isConnected).toBe(true);
  await act(async () => fim.resolve({ ok: true }));
  expect(callback).not.toHaveBeenCalled(); expect(doc.activeElement).toBe(novo);
  expect(novo.isConnected).toBe(true); expect(novo.hasAttribute("disabled")).toBe(false);
});
// DEV: controles adicionais sem substituir os quatro oráculos causais independentes acima.
it.each(["APROVADA","REJEITADA"] as const)("SSE %s sem nossa ação/ACK também restaura foco e anuncia",async status=>{
 let emitir!:()=>void;function Pai(){const [s,setS]=useState(()=>sugestao());emitir=()=>setS(a=>({...a,status,decididaEm:"2026-10-23T13:50Z",decididaPorId:"u"}));return createElement(Cartao,{s,usuarioId:"u",fuso:"UTC",aoDecidir:callback});}
 await act(async()=>root.render(createElement(Pai)));const card=host.querySelector("article")!,antes=new Set(regioes());botao("Aprovar e enviar").focus();await act(async()=>emitir());conferir(card,status,antes,"SSE remoto sem ACK");expect(acoes.aprovar).not.toHaveBeenCalled();expect(acoes.rejeitar).not.toHaveBeenCalled();expect(callback).not.toHaveBeenCalled();
});
it.each(["ACK","SSE"] as const)("%s respeita foco externo movido durante espera",async via=>{
 const fim=deferred<Resultado>();acoes.aprovar.mockReturnValue(fim.promise);let emitir!:()=>void;
 function Pai(){const [s,setS]=useState(()=>sugestao());emitir=()=>setS(a=>({...a,status:"APROVADA",decididaEm:"2026-10-23T13:50Z",decididaPorId:"u"}));return createElement(Cartao,{s,usuarioId:"u",fuso:"UTC",aoDecidir(){callback();emitir();}});}
 await act(async()=>root.render(createElement(Pai)));const antes=new Set(regioes());botao("Aprovar e enviar").focus();if(via==="ACK")await clicar(botao("Aprovar e enviar"));const fora=doc.createElement("button");fora.textContent="Foco fora";doc.body.appendChild(fora);fora.focus();if(via==="ACK")await act(async()=>fim.resolve({ok:true}));else await act(async()=>emitir());expect(doc.activeElement).toBe(fora);expect(anuncioDecisao("APROVADA",antes)).toBe(true);
});
it("perda nativa de foco ao desabilitar antes do ACK não apaga a origem",async()=>{
 const fim=deferred<Resultado>();acoes.aprovar.mockReturnValue(fim.promise);
 function Pai(){const [s,setS]=useState(()=>sugestao());return createElement(Cartao,{s,usuarioId:"u",fuso:"UTC",aoDecidir(){setS(a=>({...a,status:"APROVADA",decididaPorId:"u",decididaEm:"2026-10-23T13:50Z"}));}});}
 await act(async()=>root.render(createElement(Pai)));const card=host.querySelector("article")!,antes=new Set(regioes()),alvo=botao("Aprovar e enviar");alvo.focus();await clicar(alvo);alvo.blur();expect(doc.activeElement).toBe(doc.body);await act(async()=>fim.resolve({ok:true}));conferir(card,"APROVADA",antes,"blur nativo após disabled");
});
