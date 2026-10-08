import { beforeEach, describe, expect, it, vi } from "vitest";
import { EtapaLead, Segmento, Temperatura } from "@prisma/client";

// docs/43 §6 item 3 (docs/42 L2202 e L2203): a ficha do lead acompanha o servidor depois de cada router.refresh().
// - Resumo: a leitura mostra o valor persistido (não o rascunho de um save recusado ou cancelado).
// - Próximos passos: os campos não editados seguem o servidor — agendar a experimental pela barra e depois
//   "Salvar datas" não sobrescreve mais a data nova com a antiga; o que a pessoa editou não se perde no refresh.
// Sem DOM: ganchos de src/test/tela-sem-dom.ts; o mesmo jogo de ganchos é o mesmo componente recebendo o lead novo.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  resumo: vi.fn(), datas: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/comercial/acoes", () => ({ anexarDocumentoLead: vi.fn(), arquivarDocumentoLead: vi.fn(), moverEtapa: vi.fn(), registrarInteracao: vi.fn(), agendarExperimental: vi.fn(), enviarProposta: vi.fn(), marcarPerdido: vi.fn(), atualizarResumo: m.resumo, atualizarDatas: m.datas }));

import type { ReactNode } from "react";
import { ProximosPassos, Resumo, type LeadFicha } from "./FichaLead";
import { clicar, criarGanchos, elementos, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); });

const lead = (extra: Partial<LeadFicha> = {}): LeadFicha => ({
  id: "lead", codigo: "L-1", nome: "Ana", telefoneE164: null, etapa: EtapaLead.NOVO, segmento: Segmento.ADULTO, temperatura: Temperatura.MORNO, b2b: false,
  criadoEm: "2026-01-01T02:30:00.000Z", pais: null, vendedor: null, origemCampanha: null, origemAnuncio: null,
  interesse: "Inglês", objetivo: null, urgencia: null, orcamento: null, objecao: null, proximaAcao: null,
  proximoFollowUp: "2026-01-10", dataExperimental: "2026-01-02T10:30:00.000Z", dataProposta: "2026-01-11", motivoPerda: null,
  matricula: null, valorPrevisto: null, planoPrevisto: null, comissaoPrevista: null, documentos: [], professorExperimentalId: null,
  ...extra,
} as LeadFicha);

/** O valor do datetime-local no fuso de quem roda o teste (como a ficha mostra). */
const campoLocal = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const input = (t: ReactNode, id: string) => elementos(t).find((n) => n.type === "input" && n.props.id === id)!;
const digitar = (t: ReactNode, id: string, valor: string) => (input(t, id).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
const leitura = (t: ReactNode) => elementos(t).filter((n) => n.type === "dd").map((n) => texto(n.props.children));

describe("Resumo — leitura do persistido", () => {
  const tela = (l = lead()) => m.ganchos!.renderizar(Resumo, { lead: l });

  it("Cancelar descarta o rascunho: a leitura mostra o persistido e Editar recomeça dele", () => {
    clicar(tela(), "Editar");
    digitar(tela(), "ficha-lead-resumo-interesse", "Espanhol");
    clicar(tela(), "Cancelar");
    expect(leitura(tela())[0]).toBe("Inglês");
    clicar(tela(), "Editar");
    expect(input(tela(), "ficha-lead-resumo-interesse").props.value).toBe("Inglês");
  });

  it("save recusado não aparece como salvo; com sucesso, a leitura mostra o confirmado e depois acompanha o servidor", async () => {
    clicar(tela(), "Editar");
    digitar(tela(), "ficha-lead-resumo-interesse", "Espanhol");
    m.resumo.mockResolvedValueOnce({ ok: false, erro: "Recusado." });
    await clicar(tela(), "Salvar resumo");
    expect(texto(elementos(tela()).find((n) => n.type === "button" && ["Cancelar", "Editar"].includes(texto(n.props.children)))!.props.children)).toBe("Cancelar");
    m.resumo.mockResolvedValueOnce({ ok: true });
    await clicar(tela(), "Salvar resumo");
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(leitura(tela())[0]).toBe("Espanhol"); // confirmado pelo servidor, antes do refresh chegar
    expect(leitura(tela(lead({ interesse: "Espanhol" })))[0]).toBe("Espanhol");
    expect(leitura(tela(lead({ interesse: "Francês" })))[0]).toBe("Francês"); // outra atualização depois
  });
});

describe("ProximosPassos — os campos acompanham o servidor depois do refresh", () => {
  const tela = (l = lead()) => m.ganchos!.renderizar(ProximosPassos, { lead: l });

  it("agendar pela barra (refresh com outra experimental) e depois Salvar datas envia a data NOVA", async () => {
    expect(input(tela(), "ficha-lead-data-experimental").props.value).toBe(campoLocal("2026-01-02T10:30:00.000Z"));
    const agendada = lead({ dataExperimental: "2026-01-05T14:00:00.000Z" });
    expect(input(tela(agendada), "ficha-lead-data-experimental").props.value).toBe(campoLocal("2026-01-05T14:00:00.000Z"));
    m.datas.mockResolvedValueOnce({ ok: true });
    await clicar(tela(agendada), "Salvar datas");
    expect(m.datas).toHaveBeenCalledWith("lead", { proximoFollowUp: "2026-01-10", dataExperimental: campoLocal("2026-01-05T14:00:00.000Z"), dataProposta: "2026-01-11" });
  });

  it("o que a pessoa editou sobrevive ao refresh; os outros campos seguem o servidor", () => {
    digitar(tela(), "ficha-lead-follow-up", "2026-02-01");
    const depois = tela(lead({ dataExperimental: "2026-01-05T14:00:00.000Z", dataProposta: "2026-01-20" }));
    expect(input(depois, "ficha-lead-follow-up").props.value).toBe("2026-02-01");
    expect(input(depois, "ficha-lead-data-experimental").props.value).toBe(campoLocal("2026-01-05T14:00:00.000Z"));
    expect(input(depois, "ficha-lead-data-proposta").props.value).toBe("2026-01-20");
  });

  it("depois de salvar, mostra o confirmado até o refresh e então volta a seguir o servidor", async () => {
    digitar(tela(), "ficha-lead-data-proposta", "2026-03-01");
    m.datas.mockResolvedValueOnce({ ok: true });
    await clicar(tela(), "Salvar datas");
    expect(input(tela(), "ficha-lead-data-proposta").props.value).toBe("2026-03-01");
    expect(input(tela(lead({ dataProposta: "2026-03-01" })), "ficha-lead-data-proposta").props.value).toBe("2026-03-01");
    expect(input(tela(lead({ dataProposta: "2026-04-01" })), "ficha-lead-data-proposta").props.value).toBe("2026-04-01");
  });

  it("save recusado mantém a edição e não faz refresh", async () => {
    digitar(tela(), "ficha-lead-follow-up", "2026-02-01");
    m.datas.mockResolvedValueOnce({ ok: false, erro: "Data inválida." });
    await clicar(tela(), "Salvar datas");
    expect(m.refresh).not.toHaveBeenCalled();
    expect(input(tela(), "ficha-lead-follow-up").props.value).toBe("2026-02-01");
  });
});
