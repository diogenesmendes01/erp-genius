import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Lote 2 do fuso pessoal: prazo e novo prazo são publicados no fuso da reserva (o novo prazo é digitado nele) e
// mantêm esse fuso; registro e decisão da proposta são instantes e seguem a preferência (sem ela, o da reserva).
// Expectativas fixas: passam em TZ=UTC e America/Sao_Paulo.
const mocks = vi.hoisted(() => ({
  turma: vi.fn(),
  particular: vi.fn(),
  preferencia: vi.fn(async () => ({ ok: true, dado: { fusoExibicao: null as string | null } })),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: async () => ({ id: "u1", papeis: ["SECRETARIA_ACADEMICA"] }) }));
vi.mock("@/server/matricula/reserva-resolucao", () => ({ consultarResolucoesReserva: mocks.turma }));
vi.mock("@/server/matricula/reserva-particular-resolucao", () => ({ consultarResolucoesParticulares: mocks.particular }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formularios", () => ({ PrepararResolucao: () => null, DecidirResolucao: () => null }));
vi.mock("@/components/VoltarPara", () => ({ VoltarPara: () => null }));

import PaginaTurma from "./page";
import PaginaParticular from "../particulares/[id]/page";

const proposta = {
  id: "p1", versao: 1, tipo: "PRORROGAR", preparador: { nome: "Ana" }, criadaEm: new Date("2026-10-21T02:30:00Z"),
  novoPrazo: new Date("2026-10-25T21:00:00Z"), motivo: "m", tratamentoContratacao: "t", podeDecidir: false, podeAprovar: false,
  decisao: { aprovada: true, decisor: { nome: "Bia" }, decididaEm: new Date("2026-10-21T03:15:00Z"), motivo: "ok" },
};
const base = { versaoAtual: 1, podePreparar: false, pagina: 1, possuiMais: false, registros: [proposta], pendenciaProrrogacao: null };
const reservaTurma = { status: "ATIVA", matriculaId: "m1", expiraEm: new Date("2026-10-24T21:00:00Z"), turma: { codigo: "T1", nome: "T" }, janela: { fusoAdmissao: "America/Sao_Paulo" } };
const reservaParticular = { status: "ATIVA", matriculaId: "m1", expiraEm: new Date("2026-10-24T21:00:00Z"), horarios: [{ id: "h1", fusoOrigem: "America/Sao_Paulo", professor: { nome: "Prof" }, inicio: new Date("2026-10-26T13:00:00Z"), fim: new Date("2026-10-26T14:00:00Z") }] };

async function render(particular: boolean, fusoExibicao: string | null) {
  mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao } });
  const props = { params: Promise.resolve({ id: "r1" }), searchParams: Promise.resolve({}) };
  if (particular) {
    mocks.particular.mockResolvedValue({ ok: true, dado: { ...base, reserva: reservaParticular } });
    return renderToStaticMarkup(await PaginaParticular(props));
  }
  mocks.turma.mockResolvedValue({ ok: true, dado: { ...base, reserva: reservaTurma } });
  return renderToStaticMarkup(await PaginaTurma(props));
}

describe("Secretaria › Reservas › resolução: instante no fuso pessoal, prazo no fuso da reserva", () => {
  beforeEach(() => { mocks.turma.mockReset(); mocks.particular.mockReset(); });

  for (const particular of [false, true]) {
    const nome = particular ? "particular" : "turma";
    it(`${nome}: registro e decisão no fuso pessoal; prazo, novo prazo (e horários) no fuso da reserva`, async () => {
      const html = await render(particular, "Asia/Tokyo");
      expect(html).toContain("Preparada por Ana em 21/10/2026, 11:30 (Asia/Tokyo)");
      expect(html).toContain("por Bia em 21/10/2026, 12:15 (Asia/Tokyo)");
      expect(html).toContain("24/10/2026, 18:00 · America/Sao_Paulo");
      expect(html).toContain("Novo prazo proposto: 25/10/2026, 18:00 · America/Sao_Paulo");
      if (particular) expect(html).toContain("26/10/2026, 10:00 — 26/10/2026, 11:00 · America/Sao_Paulo");
    });

    it(`${nome}: sem preferência, os instantes saem no fuso da reserva`, async () => {
      const html = await render(particular, null);
      expect(html).toContain("Preparada por Ana em 20/10/2026, 23:30 (America/Sao_Paulo)");
      expect(html).toContain("por Bia em 21/10/2026, 00:15 (America/Sao_Paulo)");
    });
  }
});
