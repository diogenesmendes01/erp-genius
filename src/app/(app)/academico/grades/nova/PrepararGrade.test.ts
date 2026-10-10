import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 6 (docs/42 L1126): o "Fuso de origem da turma" começava vazio, num <input> com <datalist> de
// três sugestões. PrepararGrade (servidor) resolve o fuso inicial e o formulário usa o CampoFuso.
const m = vi.hoisted(() => ({ fuso: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: m.fuso }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: m.preferencia }));
vi.mock("@/server/agenda/grade-proposta", () => ({ prepararGradeInicialTurma: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { PrepararGrade } from "./PrepararGrade";

const turmas = [{ id: "t1", codigo: "T-1", versao: 0, dataInicio: "2026-10-01", horario: "19:00", dias: [1], quantidade: 10, duracao: 60, frequencia: "SEMANAL", professor: "Ana" }];
const campoFuso = (html: string) => /<label[^>]*>Fuso de origem da turma<input[^>]*>/.exec(html)?.[0] ?? "";

beforeEach(() => {
  vi.clearAllMocks();
  m.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
});

describe("PrepararGrade — fuso de origem da turma", () => {
  it("começa no fuso da escola, num CampoFuso (lista de sugestões própria)", async () => {
    m.fuso.mockResolvedValue("America/Sao_Paulo");
    const html = renderToStaticMarkup(await PrepararGrade({ turmas, turmaInicialId: "t1" }));
    expect(campoFuso(html)).toContain('value="America/Sao_Paulo"');
    expect(campoFuso(html)).toMatch(/list="fusos-/);
    expect(html).toContain('<option value="UTC">UTC — horário universal</option>');
  });

  it("sem fuso da escola, a preferência; sem nenhum, vazio — nunca UTC presumido", async () => {
    m.fuso.mockResolvedValue(null);
    expect(campoFuso(renderToStaticMarkup(await PrepararGrade({ turmas })))).toContain('value="America/Costa_Rica"');
    m.preferencia.mockResolvedValue({ ok: false, erro: "Sessão expirada." });
    const vazio = campoFuso(renderToStaticMarkup(await PrepararGrade({ turmas })));
    expect(vazio).toContain('value=""');
    expect(vazio).not.toContain('value="UTC"');
  });
});
