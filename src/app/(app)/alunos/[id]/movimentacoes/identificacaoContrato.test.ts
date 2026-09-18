import { describe, expect, it } from "vitest";
import { identificacaoContrato, idsAposSelecaoMatricula } from "./identificacaoContrato";

describe("identificação de contratos legados nas movimentações", () => {
  it("distingue dois contratos do mesmo aluno e produto quando os códigos não foram migrados", () => {
    const primeira = identificacaoContrato(null, "matricula-legada-1");
    const segunda = identificacaoContrato("   ", "matricula-legada-2");

    expect(primeira).toBe("ID matricula-legada-1");
    expect(segunda).toBe("ID matricula-legada-2");
    expect(primeira).not.toBe(segunda);
  });

  it("mantém seleção explícita: escolher uma matrícula não inclui a outra no payload", () => {
    const selecionadas = idsAposSelecaoMatricula([], "matricula-legada-1", true);

    expect(selecionadas).toEqual(["matricula-legada-1"]);
    expect(selecionadas).not.toContain("matricula-legada-2");
    expect(idsAposSelecaoMatricula(selecionadas, "matricula-legada-1", false)).toEqual([]);
  });
});
