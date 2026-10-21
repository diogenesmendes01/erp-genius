import { describe, expect, it } from "vitest";
import { destinatariosAlertaSla, GERENTE_DO_SETOR, JANELA_ALERTA_SLA_MS } from "./alertas-sla";

const base = { responsavelId: "v1", alertarResponsavel: true, alertarGerente: false, gerentesIds: ["g1"], adminsIds: ["ad"] };

describe("destinatariosAlertaSla", () => {
  it("responsavel_e_gerente", () => expect(destinatariosAlertaSla({ ...base, alertarGerente: true })).toEqual(["v1", "g1"]));
  it("so_o_responsavel_por_padrao", () => expect(destinatariosAlertaSla(base)).toEqual(["v1"]));
  it("sem_responsavel_cai_no_gerente", () => expect(destinatariosAlertaSla({ ...base, responsavelId: null })).toEqual(["g1"]));
  it("sem_responsavel_e_sem_gerente_cai_no_admin", () => expect(destinatariosAlertaSla({ ...base, responsavelId: null, gerentesIds: [] })).toEqual(["ad"]));
  it("gerente_que_e_o_responsavel_recebe_uma_vez", () => expect(destinatariosAlertaSla({ ...base, responsavelId: "g1", alertarGerente: true, adminsIds: [] })).toEqual(["g1"]));
  it("alertas_desligados_ninguem", () => expect(destinatariosAlertaSla({ ...base, alertarResponsavel: false })).toEqual([]));
  it("so_gerente_sem_gerente_vai_ao_admin", () => expect(destinatariosAlertaSla({ ...base, alertarResponsavel: false, alertarGerente: true, gerentesIds: [] })).toEqual(["ad"]));
  it("gerente_de_financeiro_e_secretaria_e_o_admin", () => {
    expect(GERENTE_DO_SETOR.FINANCEIRO).toEqual(["ADMINISTRADOR"]);
    expect(GERENTE_DO_SETOR.SECRETARIA).toEqual(["ADMINISTRADOR"]);
    expect(GERENTE_DO_SETOR.COMERCIAL).toEqual(["GERENTE_COMERCIAL"]);
    expect(GERENTE_DO_SETOR.PEDAGOGICO).toEqual(["GERENTE_PEDAGOGICO"]);
  });
  it("janela_de_24h", () => expect(JANELA_ALERTA_SLA_MS).toBe(86_400_000));
});
