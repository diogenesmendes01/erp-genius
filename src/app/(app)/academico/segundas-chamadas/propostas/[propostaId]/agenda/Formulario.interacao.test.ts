import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L1761): a prévia conferida só é descartada quando muda um campo de que ela depende
// (professor, início, término, fuso) — e, quando é, a tela diz por quê. Antes, digitar uma letra no motivo ou na
// evidência apagava a prévia e o botão "Enviar proposta para decisão". Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  previa: vi.fn(), propor: vi.fn(), decidir: vi.fn(), refresh: vi.fn(),
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/avaliacoes/segunda-chamada-agenda-inicial-local", () => ({ consultarPreviaAgendaInicialSegundaChamadaLocal: m.previa, proporAgendaInicialSegundaChamadaLocal: m.propor }));
vi.mock("@/server/avaliacoes/segunda-chamada-agenda-inicial", () => ({ decidirAgendaInicialSegundaChamada: m.decidir }));

import { AVISO_PREVIA_DESCARTADA, CAMPOS_DA_PREVIA, Formulario } from "./Formulario";
import { anuncios } from "@/test/feedback-acao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { FormDataFalso, criarGanchos, elementos, formularios, submeter, temBotao } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const tela = () => m.ganchos!.renderizar(Formulario, { propostaSegundaChamadaId: "proposta", professores: [{ id: "prof", nome: "Professora" }], podePropor: true });
const mudou = (name: string) => (formularios(tela())[0].props.onChange as (e: { target: { name: string } }) => void)({ target: { name } });
const ENVIAR = "Enviar proposta para decisão";

async function conferir() {
  m.previa.mockResolvedValueOnce({ ok: true, dado: {
    estadoConferido: "estado", prazoAte: "2026-10-20T03:00:00.000Z", inicio: "2026-10-10T13:00:00.000Z", fim: "2026-10-10T14:00:00.000Z", fusoOrigem: "UTC",
    calendario: { versao: 1, fusoInstitucional: "UTC", periodos: [] },
  } });
  await submeter(tela());
  expect(temBotao(tela(), ENVIAR)).toBe(true);
}

describe("Formulario da agenda inicial — a prévia só cai pelo que ela usa", () => {
  it("digitar no motivo, na evidência ou na justificativa da exceção não apaga a prévia", async () => {
    await conferir();
    for (const nome of ["motivo", "evidencia", "motivoExcecaoNaoLetiva"]) {
      mudou(nome);
      expect(temBotao(tela(), ENVIAR), nome).toBe(true);
    }
    expect(anuncios(tela()).status).not.toContain(AVISO_PREVIA_DESCARTADA);
  });

  it("cada campo de que a prévia depende a descarta e avisa por quê (lista fechada, cópia literal)", async () => {
    expect(CAMPOS_DA_PREVIA).toEqual(["professorId", "inicioLocal", "fimLocal", "fusoOrigem"]);
    for (const nome of ["professorId", "inicioLocal", "fimLocal", "fusoOrigem"]) {
      await conferir();
      mudou(nome);
      expect(temBotao(tela(), ENVIAR), nome).toBe(false);
      expect(anuncios(tela()).status, nome).toContain(AVISO_PREVIA_DESCARTADA);
    }
  });

  it("conferir de novo tira o aviso", async () => {
    await conferir();
    mudou("fimLocal");
    await conferir();
    expect(anuncios(tela()).status).not.toContain(AVISO_PREVIA_DESCARTADA);
    // A região polite fica sempre montada (MensagemStatus) e volta a ficar vazia.
    expect(elementos(tela()).find((n) => n.type === MensagemStatus)!.props.texto).toBeNull();
  });
});
