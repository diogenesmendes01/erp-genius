import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), turmas: vi.fn(), modalidades: vi.fn(), niveis: vi.fn(), professores: vi.fn(), painel: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/turmas/consultas", () => ({ listarTurmas: mocks.turmas, listarNiveis: mocks.niveis, listarProfessores: mocks.professores }));
vi.mock("@/server/catalogo/consultas", () => ({ listarModalidades: mocks.modalidades }));
vi.mock("./TurmasPainel", () => ({ TurmasPainel: (props: unknown) => { mocks.painel(props); return "painel-turmas"; } }));

import Page from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.sessao.mockResolvedValue({ papeis: ["GERENTE_PEDAGOGICO"] });
  mocks.turmas.mockResolvedValue([{ id: "turma-1", codigo: "T-1", nome: null, online: false, diasHorario: null, diasSemana: [1], horarioInicio: "22:00", horarioFim: "01:00", dataInicio: new Date("2099-10-12T12:00:00.000Z"), dataFim: new Date("2099-11-01T12:00:00.000Z"), capacidade: 12, rolling: false, status: "ABERTA", modalidadeId: "modalidade-1", nivelId: "nivel-1", modalidade: { nome: "Regular" }, nivel: { codigo: "A1", idioma: { nome: "Português" } }, professor: null, regraAvaliacao: null, _count: { alocacoes: 0, reservasMatricula: 0 } }]);
  mocks.modalidades.mockResolvedValue([{ id: "modalidade-1", nome: "Regular", frequencia: "1x/semana", horasAula: 3 }]);
  mocks.niveis.mockResolvedValue([{ id: "nivel-1", codigo: "A1", idioma: { nome: "Português" } }]);
  mocks.professores.mockResolvedValue([]);
});

it("guarda a página antes das consultas e projeta o status e duração da modalidade", async () => {
  mocks.sessao.mockRejectedValueOnce(new Error("Sem acesso"));
  await expect(Page()).rejects.toThrow("Sem acesso");
  expect(mocks.turmas).not.toHaveBeenCalled();
  expect(mocks.modalidades).not.toHaveBeenCalled();

  renderToStaticMarkup(await Page());
  expect(mocks.painel.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
    turmas: [expect.objectContaining({ status: "ABERTA" })],
    modalidades: [{ id: "modalidade-1", label: "Regular", frequencia: "1x/semana", horasAula: 3 }],
  }));
});
