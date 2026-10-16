import { expect, it, vi } from "vitest";
import { destinoPrepararGrade, submeterTurma } from "./TurmaFormulario";
import type { TurmaInput } from "@/server/turmas/schema";

const input: TurmaInput = {
  modalidadeId: "modalidade", nivelId: "nivel", diasSemana: [1], horarioInicio: "22:00", horarioFim: "01:00", dataInicio: "2099-10-12", capacidade: 12,
};

it("encaminha a turma recém-criada ao preparador com o identificador codificado", async () => {
  expect(destinoPrepararGrade("turma/ nova")).toBe("/academico/grades/nova?turmaId=turma%2F%20nova");
  const criar = vi.fn().mockResolvedValue({ ok: true, dado: { id: "turma/ nova" } });
  const editar = vi.fn();
  await expect(submeterTurma(undefined, input, { criar, editar })).resolves.toEqual({ ok: true, destino: "/academico/grades/nova?turmaId=turma%2F%20nova" });
  expect(criar).toHaveBeenCalledWith(input);
  expect(editar).not.toHaveBeenCalled();
});

it("preserva o caminho de edição e devolve o erro para o diálogo", async () => {
  const criar = vi.fn();
  const editar = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, erro: "Conflito de agenda" });
  await expect(submeterTurma("turma-1", input, { criar, editar })).resolves.toEqual({ ok: true });
  await expect(submeterTurma("turma-1", input, { criar, editar })).resolves.toEqual({ ok: false, erro: "Conflito de agenda" });
  expect(editar).toHaveBeenNthCalledWith(1, "turma-1", input);
  expect(criar).not.toHaveBeenCalled();
});

it("diálogo de turma é camada elevada do DS e os dias da semana são chips em pílula (DS-C)", async () => {
  const { readFileSync } = await import("node:fs");
  const dir = "src/app/(app)/configuracao/turmas/";
  const formulario = readFileSync(dir + "TurmaFormulario.tsx", "utf8");
  const painel = readFileSync(dir + "TurmasPainel.tsx", "utf8");
  expect(formulario).toContain('"rounded-dialog border border-gray-200 bg-surface-raised p-5"');
  expect(formulario).toContain('"rounded-full border px-3 py-1.5 text-sm max-sm:min-h-11 "');
  expect(painel).toContain("bg-black/60");
  expect(painel).toContain('"my-8 w-full max-w-3xl rounded-dialog shadow-dialog"');
});
