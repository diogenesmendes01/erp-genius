import { describe, it, expect } from "vitest";
import { camposAlterados, type CamposFormulario } from "./edicao";

const lida: CamposFormulario = {
  titulo: "Ligar", tipo: "LIGACAO", descricao: "", duracaoMin: 30, prioridade: "NORMAL",
  dataCivil: "2026-10-15", hora: "10:00", lembreteAntecedenciaMin: 10,
};

describe("camposAlterados", () => {
  it("sem mudança não envia nada", () => {
    expect(camposAlterados(lida, { ...lida })).toEqual({});
  });
  it("mudar só o título ou a descrição não envia o agendamento", () => {
    expect(camposAlterados(lida, { ...lida, titulo: "Ligar de novo", descricao: "Pediu proposta" })).toEqual({ titulo: "Ligar de novo", descricao: "Pediu proposta" });
  });
  it("mudar a hora envia data, hora e lembrete juntos", () => {
    expect(camposAlterados(lida, { ...lida, hora: "11:00" })).toEqual({ dataCivil: "2026-10-15", hora: "11:00", lembreteAntecedenciaMin: 10 });
  });
  it("limpar a data vai com hora e lembrete limpos", () => {
    expect(camposAlterados(lida, { ...lida, dataCivil: null, hora: null, lembreteAntecedenciaMin: null })).toEqual({ dataCivil: null, hora: null, lembreteAntecedenciaMin: null });
  });
});
