import { expect, it } from "vitest";
import { participacaoParaRegistro } from "./participacao";
import { DiarioSchema } from "./schema";

it("novo registro captura contrato sem inventar classificação; legado não ganha vínculo silenciosamente", () => {
  expect(participacaoParaRegistro({ presente: false }, "m1")).toEqual({ matriculaId: "m1", participacao: null });
  expect(participacaoParaRegistro({ presente: false }, "m1", { presente: false })).toEqual({ matriculaId: null, participacao: null });
  expect(participacaoParaRegistro({ presente: false, participacao: "FALTA" }, "m1", { presente: false })).toEqual({ matriculaId: "m1", participacao: "FALTA" });
});
it("preserva classificação omitida e recusa contrato substituído ou não identificado", () => {
  const antigo = { matriculaId: "m1", presente: false, participacao: "IMPEDIDO_POR_RESTRICAO" as const };
  expect(participacaoParaRegistro({ presente: false }, "m1", antigo).participacao).toBe("IMPEDIDO_POR_RESTRICAO");
  expect(() => participacaoParaRegistro({ presente: false }, "m2", antigo)).toThrow();
  expect(() => participacaoParaRegistro({ presente: false, participacao: "FALTA" }, null)).toThrow();
});
it("exige presença coerente e descrição do impedimento", () => {
  const esquema = DiarioSchema.innerType().shape.registros.element;
  expect(esquema.safeParse({ alunoId: "a", presente: true, participacao: "FALTA" }).success).toBe(false);
  expect(esquema.safeParse({ alunoId: "a", presente: false, participacao: "IMPEDIDO_POR_RESTRICAO" }).success).toBe(false);
  expect(esquema.safeParse({ alunoId: "a", presente: false, participacao: "IMPEDIDO_POR_RESTRICAO", observacao: "Acesso à aula estava restrito" }).success).toBe(true);
});
