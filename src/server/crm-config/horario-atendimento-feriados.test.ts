import { describe, expect, it, vi } from "vitest";
import { dentroDoHorario, feriadosDoCalendarioEscolar, prazoVenceEm, type FeriadoEscola, type HorarioAtendimento } from "./horario-atendimento";

const d = (s: string) => new Date(s);
const sp = "America/Sao_Paulo";
const util: HorarioAtendimento = { intervalos: [1, 2, 3, 4, 5].map((dia) => ({ dia, inicio: "08:00", fim: "18:00" })), feriados: [] };
const dia = (data: string): FeriadoEscola => ({ inicio: data, fim: data });

describe("prazoVenceEm com feriados da escola", () => {
  it("prazo_que_cruza_feriado_da_escola_pula_o_dia", () => {
    expect(prazoVenceEm(d("2026-11-19T17:00-03:00"), 120, util, sp, [dia("2026-11-20")])).toEqual(d("2026-11-23T09:00-03:00"));
  });

  it("sem_feriado_o_mesmo_prazo_vence_na_sexta", () => {
    expect(prazoVenceEm(d("2026-11-19T17:00-03:00"), 120, util, sp, [])).toEqual(d("2026-11-20T09:00-03:00"));
  });

  it("periodo_de_varios_dias_pula_todos", () => {
    expect(prazoVenceEm(d("2026-12-23T17:00-03:00"), 120, util, sp, [{ inicio: "2026-12-24", fim: "2026-12-25" }])).toEqual(d("2026-12-28T09:00-03:00"));
  });

  it("inicio_dentro_do_feriado_comeca_no_proximo_dia_util", () => {
    expect(prazoVenceEm(d("2026-11-20T10:00-03:00"), 30, util, sp, [dia("2026-11-20")])).toEqual(d("2026-11-23T08:30-03:00"));
  });

  it("feriado_no_fim_de_semana_nao_muda_o_prazo", () => {
    const sem = prazoVenceEm(d("2026-10-16T17:30-03:00"), 60, util, sp, []);
    expect(prazoVenceEm(d("2026-10-16T17:30-03:00"), 60, util, sp, [dia("2026-10-17")])).toEqual(sem);
    expect(sem).toEqual(d("2026-10-19T08:30-03:00"));
  });

  it("feriado_no_fim_de_semana_conta_se_o_setor_atende_no_sabado", () => {
    const comSabado: HorarioAtendimento = { ...util, intervalos: [...util.intervalos, { dia: 6, inicio: "09:00", fim: "13:00" }] };
    expect(prazoVenceEm(d("2026-10-16T17:30-03:00"), 60, comSabado, sp, [])).toEqual(d("2026-10-17T09:30-03:00"));
    expect(prazoVenceEm(d("2026-10-16T17:30-03:00"), 60, comSabado, sp, [dia("2026-10-17")])).toEqual(d("2026-10-19T08:30-03:00"));
  });

  it("feriado_do_setor_e_feriado_da_escola_somam", () => {
    const setor: HorarioAtendimento = { ...util, feriados: ["2026-11-23"] };
    expect(prazoVenceEm(d("2026-11-20T17:00-03:00"), 120, setor, sp, [])).toEqual(d("2026-11-24T09:00-03:00"));
    expect(prazoVenceEm(d("2026-11-19T17:00-03:00"), 120, util, sp, [dia("2026-11-20")])).toEqual(d("2026-11-23T09:00-03:00"));
    expect(prazoVenceEm(d("2026-11-19T17:00-03:00"), 120, setor, sp, [dia("2026-11-20")])).toEqual(d("2026-11-24T09:00-03:00"));
    expect(prazoVenceEm(d("2026-11-19T17:00-03:00"), 120, { ...util, feriados: ["2026-11-20"] }, sp, [dia("2026-11-20")])).toEqual(d("2026-11-23T09:00-03:00"));
  });

  it("sem_horario_conta_corrido_e_ignora_feriados", () => {
    expect(prazoVenceEm(d("2026-11-20T10:00-03:00"), 60, null, sp, [dia("2026-11-20")])).toEqual(d("2026-11-20T11:00-03:00"));
  });

  it("feriado_vale_no_dia_civil_da_escola_em_america_sao_paulo", () => {
    expect(prazoVenceEm(d("2026-11-20T01:00:00Z"), 30, util, sp, [dia("2026-11-20")])).toEqual(d("2026-11-23T08:30-03:00"));
    expect(prazoVenceEm(d("2026-11-21T02:30:00Z"), 30, util, sp, [dia("2026-11-20")])).toEqual(d("2026-11-23T08:30-03:00"));
  });

  it("feriado_vale_no_dia_civil_da_escola_em_utc", () => {
    expect(prazoVenceEm(d("2026-11-19T17:00:00Z"), 120, util, "UTC", [dia("2026-11-20")])).toEqual(d("2026-11-23T09:00:00Z"));
    expect(prazoVenceEm(d("2026-11-19T23:00:00Z"), 30, util, "UTC", [dia("2026-11-20")])).toEqual(d("2026-11-23T08:30:00Z"));
  });

  it("o_mesmo_feriado_desloca_instantes_diferentes_conforme_o_fuso", () => {
    expect(prazoVenceEm(d("2026-11-19T17:00-03:00"), 120, util, sp, [dia("2026-11-20")]).toISOString()).toBe("2026-11-23T12:00:00.000Z");
    expect(prazoVenceEm(d("2026-11-19T17:00:00Z"), 120, util, "UTC", [dia("2026-11-20")]).toISOString()).toBe("2026-11-23T09:00:00.000Z");
  });
});

describe("dentroDoHorario com feriados da escola", () => {
  it("feriado_da_escola_fica_fora_do_horario", () => {
    expect(dentroDoHorario(d("2026-11-20T10:00-03:00"), util, sp, [dia("2026-11-20")])).toBe(false);
    expect(dentroDoHorario(d("2026-11-20T10:00-03:00"), util, sp, [])).toBe(true);
  });
});

describe("feriadosDoCalendarioEscolar", () => {
  const periodos = [
    { id: "p1", nome: "Proclamação da República", tipo: "FERIADO", inicio: "2026-11-15", fim: "2026-11-15" },
    { id: "p2", nome: "Recesso de fim de ano", tipo: "RECESSO", inicio: "2026-12-21", fim: "2027-01-08" },
    { id: "p3", nome: "Férias de julho", tipo: "FERIAS", inicio: "2026-07-06", fim: "2026-07-31" },
    { id: "p4", nome: "Natal e véspera", tipo: "FERIADO", inicio: "2026-12-24", fim: "2026-12-25" },
  ];

  it("so_feriado_entra_recesso_e_ferias_nao", () => {
    expect(feriadosDoCalendarioEscolar(periodos)).toEqual([{ inicio: "2026-11-15", fim: "2026-11-15" }, { inicio: "2026-12-24", fim: "2026-12-25" }]);
  });

  it("descarta_os_que_terminam_antes_do_dia_informado", () => {
    expect(feriadosDoCalendarioEscolar(periodos, "2026-11-16")).toEqual([{ inicio: "2026-12-24", fim: "2026-12-25" }]);
    expect(feriadosDoCalendarioEscolar(periodos, "2026-12-25")).toEqual([{ inicio: "2026-12-24", fim: "2026-12-25" }]);
  });

  it("periodos_invalidos_avisam_e_viram_lista_vazia", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(feriadosDoCalendarioEscolar([{ id: "x", tipo: "FERIADO" }])).toEqual([]);
      expect(feriadosDoCalendarioEscolar("x")).toEqual([]);
      expect(aviso).toHaveBeenCalledTimes(2);
    } finally {
      aviso.mockRestore();
    }
  });
});
