import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): na nova reserva particular, consulta de
// professores, revisão e confirmação dividiam um só estado de mensagem. Agora cada grupo tem o seu
// feedback junto do próprio botão: erros (do servidor, de consulta/revisão indisponível e de transporte)
// em role="alert"; a confirmação anuncia o sucesso em role="status" antes de abrir a preparação.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  consultar: vi.fn(), revisar: vi.fn(), confirmar: vi.fn(), refresh: vi.fn(), push: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }) }));
vi.mock("@/server/matricula/nova-reserva-particular", () => ({
  consultarFormularioNovaReserva: m.consultar,
  revisarNovaReservaParticular: m.revisar,
  confirmarNovaReservaParticular: m.confirmar,
}));

import { NovaReservaFormulario } from "./Formulario";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { clicar, criarGanchos, elementos } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); });
afterEach(() => { vi.unstubAllGlobals(); });

const base = {
  matriculaId: "matricula-1", anteriorId: "reserva-0", ofertaId: "oferta-1", versaoOferta: 3, formaAgenda: "PARTICULAR_GRADE_FIXA",
  fuso: "America/Sao_Paulo", professores: [{ id: "prof-1", nome: "Ana Professora" }], pagina: 1, temProxima: true,
} as never;
const revisaoOk = {
  ok: true,
  dado: {
    revisaoHash: "a".repeat(64),
    aluno: { primeiroNome: "Bia", sobrenome: "Lima", documento: null, email: "bia@exemplo.test", telefoneE164: "+5511999990000", rua: null, numero: null, cidade: "São Paulo", regiao: null, cep: null, paisResidencia: "BR" },
    pagador: { tipo: "ALUNO", versao: 1, dados: { nome: "Bia Lima", documento: null, email: null, telefoneE164: null, endereco: null } },
    versaoCondicoes: 2, plano: [], cobrancas: [],
    agenda: { forma: "PARTICULAR_GRADE_FIXA", fuso: "America/Sao_Paulo", encontros: [] },
  },
};
const tela = () => m.ganchos!.renderizar(NovaReservaFormulario, { base });
/** O fieldset externo travado é o sinal do ocupado desta tela (os botões não trocam de rótulo). */
const ocupado = (t: ReactNode) => elementos(t).find((n) => n.type === "fieldset")?.props.disabled === true;
const chamarOnChange = (no: { props: Record<string, unknown> } | undefined, evento: unknown) => (no!.props.onChange as (e: unknown) => void)(evento);

/** Revisa com sucesso, marca a conferência e escreve o motivo: o botão "Confirmar nova reserva" fica pronto. */
async function revisarEConferir() {
  m.revisar.mockResolvedValueOnce(revisaoOk);
  await clicar(tela(), "Revisar horários e condições");
  chamarOnChange(elementos(tela()).find((n) => n.type === "input" && n.props.type === "checkbox"), { target: { checked: true } });
  chamarOnChange(elementos(tela()).find((n) => n.type === CampoTexto), { target: { value: "Retomada combinada com o aluno" } });
}

describe("NovaReservaFormulario — confirmação", () => {
  contratoFeedbackSeparado({
    nome: "confirmar nova reserva", tela, action: m.confirmar, preparar: revisarEConferir,
    acionar: () => clicar(tela(), "Confirmar nova reserva"),
    respostaOk: { ok: true, dado: { id: "reserva-1" } },
    sucesso: "Nova reserva confirmada. Abrindo a preparação da matrícula.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => ocupado(tela()),
  });

  it("reenvio depois de falha de rede usa a mesma chave; sucesso abre a preparação", async () => {
    await revisarEConferir();
    m.confirmar.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, dado: { id: "reserva-1" } });
    await clicar(tela(), "Confirmar nova reserva");
    await clicar(tela(), "Confirmar nova reserva");
    const [primeira, segunda] = m.confirmar.mock.calls.map((c) => c[0] as { chaveIdempotencia: string; revisaoHash: string; motivo: string });
    expect(primeira.chaveIdempotencia).toBeTruthy();
    expect(segunda.chaveIdempotencia).toBe(primeira.chaveIdempotencia);
    expect(segunda).toMatchObject({ revisaoHash: "a".repeat(64), motivo: "Retomada combinada com o aluno", dadosConferidos: true });
    expect(m.push).toHaveBeenCalledWith("/matriculas/matricula-1/preparacao");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("NovaReservaFormulario — consulta de professores e revisão", () => {
  async function anunciadoAposClique(rotulo: string, desfecho: () => void) {
    const antes = anuncios(tela());
    desfecho();
    await clicar(tela(), rotulo);
    return novosAnuncios(antes, anuncios(tela()));
  }

  it.each([
    ["erro do servidor", () => m.consultar.mockResolvedValueOnce({ ok: false, erro: "Sem permissão para consultar." }), "Sem permissão para consultar."],
    ["consulta sem dado", () => m.consultar.mockResolvedValueOnce({ ok: true }), "Consulta indisponível."],
    ["preparação mudou", () => m.consultar.mockResolvedValueOnce({ ok: true, dado: { ...(base as object), versaoOferta: 4 } }), "A preparação mudou. Atualize a página."],
    ["falha de rede", () => m.consultar.mockRejectedValueOnce(new TypeError("Failed to fetch")), "Não foi possível consultar professores."],
  ])("buscar professores — %s sai em role=\"alert\"", async (_caso, desfecho, mensagem) => {
    expect(await anunciadoAposClique("Buscar", desfecho)).toEqual({ alerta: [mensagem], status: [] });
    expect(ocupado(tela())).toBe(false);
  });

  it("buscar professores com sucesso não anuncia nada e troca a lista", async () => {
    const novos = await anunciadoAposClique("Buscar", () => m.consultar.mockResolvedValueOnce({ ok: true, dado: { ...(base as object), professores: [{ id: "prof-2", nome: "Caio Professor" }], temProxima: false } }));
    expect(novos).toEqual({ alerta: [], status: [] });
    expect(elementos(tela()).some((n) => n.type === "option" && n.props.value === "prof-2")).toBe(true);
  });

  it.each([
    ["erro do servidor", () => m.revisar.mockResolvedValueOnce({ ok: false, erro: "Horário indisponível." }), "Horário indisponível."],
    ["revisão sem dado", () => m.revisar.mockResolvedValueOnce({ ok: true }), "Revisão indisponível."],
    ["falha de rede", () => m.revisar.mockRejectedValueOnce(new TypeError("Failed to fetch")), "Não foi possível revisar a reserva."],
  ])("revisar — %s sai em role=\"alert\"", async (_caso, desfecho, mensagem) => {
    expect(await anunciadoAposClique("Revisar horários e condições", desfecho)).toEqual({ alerta: [mensagem], status: [] });
    expect(ocupado(tela())).toBe(false);
  });

  it("um novo envio limpa o erro de outro grupo", async () => {
    m.consultar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await clicar(tela(), "Buscar");
    m.revisar.mockResolvedValueOnce(revisaoOk);
    await clicar(tela(), "Revisar horários e condições");
    expect(anuncios(tela())).toEqual({ alerta: [], status: [] });
  });
});
