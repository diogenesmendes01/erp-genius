import { act, createElement, StrictMode, useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import { useAbaPainel, urlAbaPainel } from "./useAbaPainel";
let root: Root, host: Elemento, montado = false;
let atual: ReturnType<typeof useAbaPainel<{ nome: string }>>;
type Props = { id: string | null; aba?: "detalhes" | "oportunidades"; versao?: number; ativo?: boolean };
function Tela({ id, aba = "detalhes", versao = 0, ativo = true }: Props) {
  const lido = useAbaPainel<{ nome: string }>(id, aba, versao, ativo);
  useEffect(() => { atual = lido; }, [lido]);
  return createElement("p", null, lido.erro ? "erro" : lido.dado?.nome ?? "sem dado");
}
const pedidos: { url: string; signal: AbortSignal; resolver(r: unknown): void; rejeitar(e: Error): void }[] = [];
const resposta = (nome: string, status = 200) => ({ ok: status === 200, status, json: async () => ({ nome }) });
const render = (props: Props, estrito = false) => act(async () => root.render(estrito ? createElement(StrictMode, null, createElement(Tela, props)) : createElement(Tela, props)));
beforeEach(async () => {
  pedidos.length = 0;
  const dom = criarDomMinimo(); vi.stubGlobal("window", dom.janela); vi.stubGlobal("document", dom.documento); vi.stubGlobal("MutationObserver", dom.MutationObserver); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn((url: string, opcoes: { signal: AbortSignal; cache: string; credentials: string }) => {
    expect(opcoes.cache).toBe("no-store"); expect(opcoes.credentials).toBe("same-origin");
    return new Promise((resolver, rejeitar) => pedidos.push({ url, signal: opcoes.signal, resolver, rejeitar }));
  }));
  host = dom.documento.createElement("div"); dom.documento.body.appendChild(host); const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement); montado = true;
});
afterEach(async () => { if (montado) await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("codifica id bruto no caminho fixo de uma aba", () => expect(urlAbaPainel("a?x&b /", "detalhes")).toBe("/api/inbox/atendimentos/a%3Fx%26b%20%2F/painel/detalhes"));
it("SSR é determinístico e não faz I/O; hook inativo/idnull também não buscam", async () => {
  expect(renderToStaticMarkup(createElement(Tela, { id: "A" }))).toContain("sem dado"); expect(fetch).not.toHaveBeenCalled();
  await render({ id: "A", ativo: false }); await render({ id: null }); expect(pedidos).toHaveLength(0);
});
it("um GET no-store por ativação entrega o DTO e render não repete a aquisição", async () => {
  await render({ id: "A" }); expect(pedidos).toHaveLength(1); expect(pedidos[0].url).toContain("/A/painel/detalhes");
  await act(async () => pedidos[0].resolver(resposta("PessoaA"))); expect(host.textContent).toBe("PessoaA");
  await render({ id: "A" }); expect(pedidos).toHaveLength(1);
});
it("A→B ignora resposta antiga mesmo quando transporte ignora AbortSignal e B→A não recicla snapshot", async () => {
  await render({ id: "A" }); await render({ id: "B" }); expect(pedidos[0].signal.aborted).toBe(true); expect(atual.dado).toBeNull();
  await act(async () => pedidos[1].resolver(resposta("PessoaB"))); await act(async () => pedidos[0].resolver(resposta("PessoaA antiga"))); expect(host.textContent).toBe("PessoaB");
  await render({ id: "A" }); expect(atual.dado).toBeNull(); await act(async () => pedidos[2].resolver(resposta("PessoaA nova"))); expect(host.textContent).toBe("PessoaA nova");
});
it("versão/retry e aba têm identidade própria; inativar aborta e não recebe resposta tardia", async () => {
  await render({ id: "A" }); await render({ id: "A", versao: 1 }); expect(pedidos[0].signal.aborted).toBe(true);
  await act(async () => atual.recarregar()); expect(pedidos[1].signal.aborted).toBe(true);
  await render({ id: "A", aba: "oportunidades", versao: 1 }); expect(pedidos[2].signal.aborted).toBe(true); expect(pedidos[3].url).toContain("/painel/oportunidades");
  await render({ id: "A", ativo: false }); expect(pedidos[3].signal.aborted).toBe(true); await act(async () => pedidos[3].resolver(resposta("inativa"))); expect(atual.dado).toBeNull(); expect(atual.erro).toBe(false);
});
it.each([404, 500, "json", "rede"])("erro %s não fabrica ausência legítima; retry atual volta a carregar", async tipo => {
  await render({ id: "A" }); await act(async () => { if (tipo === "rede") pedidos[0].rejeitar(Error("offline")); else pedidos[0].resolver(tipo === "json" ? { ok: true, json: async () => { throw Error("inválido"); } } : resposta("negada", tipo as number)); });
  expect(atual.dado).toBeNull(); expect(atual.erro).toBe(true); await act(async () => atual.recarregar()); expect(atual.erro).toBe(false);
  await act(async () => pedidos[1].resolver(resposta("recuperada"))); expect(host.textContent).toBe("recuperada");
});
it("StrictMode invalida cleanup real e desmontagem aborta autoridade da promise pendente", async () => {
  await render({ id: "A" }, true); expect(pedidos).toHaveLength(2); expect(pedidos[0].signal.aborted).toBe(true);
  await act(async () => pedidos[0].resolver(resposta("owner antigo"))); expect(atual.dado).toBeNull();
  await act(async () => root.unmount()); montado = false; expect(pedidos[1].signal.aborted).toBe(true); await act(async () => pedidos[1].resolver(resposta("desmontada"))); expect(host.textContent).toBe("");
});
it("reabrir a mesma chave depois de inativar exige leitura nova antes de reapresentar o DTO", async () => {
  await render({ id: "A" }); await act(async () => pedidos[0].resolver(resposta("snapshot antigo"))); expect(atual.dado?.nome).toBe("snapshot antigo");
  await render({ id: "A", ativo: false }); await render({ id: "A" }); expect(pedidos).toHaveLength(2); expect(atual.dado).toBeNull();
  await act(async () => pedidos[1].resolver(resposta("snapshot fresco"))); expect(atual.dado?.nome).toBe("snapshot fresco");
});