import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ganchos sem DOM (src/test/tela-sem-dom.ts): estado e refs vivem entre renders, como no React. Os refs
// do componente (emEnvio, tentativa) ficam em `m.refs`, na ordem em que foram criados.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  refs: [] as { current: unknown }[],
  preparar: vi.fn(), decidir: vi.fn(), aplicar: vi.fn(), atualizar: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => {
      const ref = m.ganchos!.useRef(inicial);
      if (!m.refs.includes(ref)) m.refs.push(ref);
      return ref;
    }) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.atualizar, push: vi.fn() }) }));
vi.mock("@/server/contratos/moeda-aditivo", () => ({ proporMoedaAditivo: m.preparar, decidirMoedaAditivo: m.decidir, aplicarMoedaAditivo: m.aplicar }));

import { MoedaFormulario } from "./Formulario";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { adiada, anuncios, novosAnuncios, type Adiada } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

const props = { modo: "preparar" as const, matriculaId: "m", versaoCondicoesId: "v", revisaoHash: "hash" };
const tela = () => m.ganchos!.renderizar(MoedaFormulario, props);
const fieldset = () => elementos(tela()).find((n) => n.type === "fieldset")!;
const rotuloDoBotao = () => texto(elementos(tela()).find((n) => n.type === "button")!.props.children);

beforeEach(() => { vi.resetAllMocks(); m.ganchos = criarGanchos(); m.refs = []; vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

function montar() {
  let valores = { motivo: "Conferência financeira", evidencia: "Contrato assinado" };
  tela();
  const [envio, tentativa] = m.refs;
  return { enviar: () => submeter(tela(), valores), envio, tentativa, alterar: () => { valores = { motivo: "Dados corrigidos", evidencia: "Outra evidência" }; } };
}

it("preserva chave e entrada após resultado incerto, mesmo com campos alterados", async () => {
  m.preparar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce({ ok: true });
  const c = montar(); await c.enviar();
  // A tela mostra "Repetir mesma tentativa" e trava os campos pelo estado, não pelo ref (react-hooks/refs).
  expect(rotuloDoBotao()).toBe("Repetir mesma tentativa"); expect(fieldset().props.disabled).toBe(true);
  c.alterar(); await c.enviar();
  expect(m.preparar.mock.calls[0][0]).toEqual(m.preparar.mock.calls[1][0]);
  expect(rotuloDoBotao()).toBe("Registrado"); expect(c.tentativa.current).not.toBeNull();
  expect(fieldset().props.disabled).toBe(true);
  expect(m.atualizar).toHaveBeenCalledTimes(1);
});
// useChaveIdempotencia (#166): a recusa conhecida não grava nada no servidor, então a chave segue a mesma e só a
// entrada é refeita; a chave muda depois do sucesso, quando a próxima operação já é outra tentativa.
it("rejeição conhecida permite corrigir a entrada; a chave só muda depois do sucesso", async () => {
  m.preparar.mockResolvedValueOnce({ ok: false, erro: "Corrigir", podeRevisar: true }).mockResolvedValueOnce({ ok: true });
  const c = montar(); await c.enviar(); expect(c.tentativa.current).toBeNull();
  expect(fieldset().props.disabled).toBe(false); expect(rotuloDoBotao()).toBe("Preparar troca de moeda");
  expect(anuncios(tela()).alerta).toEqual(["Corrigir Corrija os dados antes de tentar novamente."]);
  c.alterar(); await c.enviar();
  expect(m.preparar.mock.calls[1][0].motivo).toBe("Dados corrigidos");
  expect(m.preparar.mock.calls[1][0].chaveIdempotencia).toBe(m.preparar.mock.calls[0][0].chaveIdempotencia);
  expect(m.preparar.mock.calls[0][0]).toMatchObject({ matriculaId: "m", versaoCondicoesId: "v", revisaoHash: "hash", evidencia: "Contrato assinado" });
});
it("não dispara submissão concorrente antes da próxima renderização", async () => {
  let concluir!: (valor: unknown) => void;
  m.preparar.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
  const c = montar(); const mesmoRender = tela();
  const primeira = submeter(mesmoRender, { motivo: "Conferência financeira", evidencia: "Contrato assinado" });
  await submeter(mesmoRender, { motivo: "Conferência financeira", evidencia: "Contrato assinado" });
  expect(m.preparar).toHaveBeenCalledTimes(1); concluir({ ok: true }); await primeira;
  expect(c.envio.current).toBe(false);
});

// Integração da #151 (B3): o que a tela mostra com a tentativa pendente vem do estado `temTentativa` — campos
// travados (fieldset) e "Repetir mesma tentativa" —, para a pessoa não editar e achar que reenviou outra coisa.
it("tentativa pendente: campos travados e \"Repetir mesma tentativa\"; sem tentativa, editáveis e \"Preparar troca de moeda\"", async () => {
  expect({ travado: fieldset().props.disabled, botao: rotuloDoBotao() }).toEqual({ travado: false, botao: "Preparar troca de moeda" });
  m.preparar.mockResolvedValueOnce({ ok: false, erro: "Em conferência", podeRevisar: false });
  await montar().enviar();
  expect({ travado: fieldset().props.disabled, botao: rotuloDoBotao() }).toEqual({ travado: true, botao: "Repetir mesma tentativa" });
});

// docs/43 §6 item 2: erro e sucesso separados. O erro do servidor chega composto com a orientação da
// tentativa (preservada ou a corrigir), por isso os casos ficam aqui em vez de contratoFeedbackSeparado.
describe("feedback separado", () => {
  const ERRO = "Recusado pelo servidor: revise a proposta.";
  async function anunciadoApos(desfecho: () => void) {
    const c = montar();
    const antes = anuncios(tela());
    desfecho();
    await c.enviar();
    return novosAnuncios(antes, anuncios(tela()));
  }
  it("erro do servidor sai em role=\"alert\", com a tentativa preservada, não em role=\"status\"", async () => {
    expect(await anunciadoApos(() => m.preparar.mockResolvedValueOnce({ ok: false, erro: ERRO, podeRevisar: false })))
      .toEqual({ alerta: [`${ERRO} A tentativa foi preservada; confira o histórico antes de iniciar outra operação.`], status: [] });
  });
  it("sucesso sai em role=\"status\", sem alerta", async () => {
    expect(await anunciadoApos(() => m.preparar.mockResolvedValueOnce({ ok: true }))).toEqual({ alerta: [], status: ["Operação registrada."] });
  });
  it("falha de rede vira resultado incerto em role=\"alert\"", async () => {
    expect(await anunciadoApos(() => m.preparar.mockRejectedValueOnce(new TypeError("Failed to fetch")))).toEqual({ alerta: [MSG_RESULTADO_INCERTO], status: [] });
  });
  it("ocupado enquanto a action roda; sai do ocupado depois de erro, falha e sucesso", async () => {
    const c = montar();
    expect(rotuloDoBotao(), "antes de enviar").toBe("Preparar troca de moeda");
    const desfechos: [string, (p: Adiada<unknown>) => void][] = [
      ["erro", (p) => p.resolver({ ok: false, erro: ERRO, podeRevisar: false })],
      ["falha", (p) => p.rejeitar(new TypeError("Failed to fetch"))],
      ["sucesso", (p) => p.resolver({ ok: true })],
    ];
    for (const [nome, concluir] of desfechos) {
      const pendente = adiada<unknown>();
      m.preparar.mockReturnValueOnce(pendente.promessa);
      const execucao = c.enviar();
      expect(rotuloDoBotao(), `durante (${nome})`).toBe("Processando…");
      concluir(pendente);
      await execucao;
      expect(rotuloDoBotao(), `depois (${nome})`).not.toBe("Processando…");
    }
    expect(rotuloDoBotao()).toBe("Registrado");
  });
});
