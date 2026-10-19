import { describe, expect, it } from "vitest";
import { dentroDoHorario, HorarioAtendimentoSchema, prazoVenceEm, type HorarioAtendimento } from "./horario-atendimento";

const d = (s: string) => new Date(s);
const fuso = "America/Sao_Paulo";
const util: HorarioAtendimento = { intervalos: [1, 2, 3, 4, 5].map((dia) => ({ dia, inicio: "08:00", fim: "18:00" })), feriados: [] };
const comAlmoco: HorarioAtendimento = {
  intervalos: [1, 2, 3, 4, 5].flatMap((dia) => [{ dia, inicio: "08:00", fim: "12:00" }, { dia, inicio: "13:00", fim: "18:00" }]),
  feriados: [],
};

describe("prazoVenceEm", () => {
  it("sem_calendario_conta_corrido", () => expect(prazoVenceEm(d("2026-10-16T19:00-03:00"), 60, null, fuso)).toEqual(d("2026-10-16T20:00-03:00")));
  it("dentro_do_horario_soma_simples", () => expect(prazoVenceEm(d("2026-10-19T09:10-03:00"), 30, util, fuso)).toEqual(d("2026-10-19T09:40-03:00")));
  it("fora_do_horario_comeca_na_proxima_abertura", () => expect(prazoVenceEm(d("2026-10-16T19:00-03:00"), 60, util, fuso)).toEqual(d("2026-10-19T09:00-03:00")));
  it("atravessa_o_fechamento", () => expect(prazoVenceEm(d("2026-10-19T17:30-03:00"), 60, util, fuso)).toEqual(d("2026-10-20T08:30-03:00")));
  it("intervalo_de_almoco_pausa", () => expect(prazoVenceEm(d("2026-10-19T11:30-03:00"), 60, comAlmoco, fuso)).toEqual(d("2026-10-19T13:30-03:00")));
  it("feriado_pula_o_dia", () => expect(prazoVenceEm(d("2026-11-19T17:00-03:00"), 120, { ...util, feriados: ["2026-11-20"] }, fuso)).toEqual(d("2026-11-23T09:00-03:00")));
  it("1440_min_em_horario_comercial_sao_2_4_dias_uteis", () => expect(prazoVenceEm(d("2026-10-19T08:00-03:00"), 1440, util, fuso)).toEqual(d("2026-10-21T12:00-03:00")));
  it("outro_fuso", () => expect(prazoVenceEm(d("2026-10-19T07:30-06:00"), 30, util, "America/Costa_Rica")).toEqual(d("2026-10-19T08:30-06:00")));
  it("calendario_sem_intervalos_conta_corrido", () => expect(prazoVenceEm(d("2026-10-19T09:00-03:00"), 15, { intervalos: [], feriados: [] }, fuso)).toEqual(d("2026-10-19T09:15-03:00")));
  it("prazo_que_termina_no_fechamento_vence_no_fechamento", () => expect(prazoVenceEm(d("2026-10-19T17:00-03:00"), 60, util, fuso)).toEqual(d("2026-10-19T18:00-03:00")));
  it("inicio_antes_da_abertura_do_mesmo_dia", () => expect(prazoVenceEm(d("2026-10-19T06:00-03:00"), 15, util, fuso)).toEqual(d("2026-10-19T08:15-03:00")));
  it("horario_de_verao_inexistente_avanca_sem_erro", () => {
    // Nova York: 08/03/2026 02:00 não existe (pula para 03:00). Intervalo 02:00–04:00 vira 03:00–04:00.
    const cal: HorarioAtendimento = { intervalos: [{ dia: 0, inicio: "02:00", fim: "04:00" }], feriados: [] };
    expect(prazoVenceEm(d("2026-03-08T00:00-05:00"), 30, cal, "America/New_York")).toEqual(d("2026-03-08T03:30-04:00"));
  });
  it("horario_de_verao_ambiguo_usa_o_primeiro", () => {
    // Nova York: 01/11/2026 01:30 acontece duas vezes; vale a primeira (−04:00).
    const cal: HorarioAtendimento = { intervalos: [{ dia: 0, inicio: "01:30", fim: "05:00" }], feriados: [] };
    expect(prazoVenceEm(d("2026-11-01T00:00-04:00"), 10, cal, "America/New_York")).toEqual(d("2026-11-01T01:40-04:00"));
  });
  it("calendario_so_de_feriados_que_nunca_abre_lanca_erro", () => {
    const cal: HorarioAtendimento = { intervalos: [{ dia: 1, inicio: "08:00", fim: "09:00" }], feriados: [] };
    expect(() => prazoVenceEm(d("2026-10-19T08:00-03:00"), 60 * 24 * 400, cal, fuso)).toThrow(/400 dias/);
  });
  it("schema_rejeita_fim_antes_do_inicio_e_sobreposicao", () => {
    expect(HorarioAtendimentoSchema.safeParse({ intervalos: [{ dia: 1, inicio: "18:00", fim: "08:00" }] }).success).toBe(false);
    expect(HorarioAtendimentoSchema.safeParse({ intervalos: [{ dia: 1, inicio: "08:00", fim: "12:00" }, { dia: 1, inicio: "11:00", fim: "14:00" }] }).success).toBe(false);
  });
  it("schema_aceita_intervalos_encostados_e_feriados_padrao_vazio", () => {
    const r = HorarioAtendimentoSchema.safeParse({ intervalos: [{ dia: 1, inicio: "08:00", fim: "12:00" }, { dia: 1, inicio: "12:00", fim: "14:00" }] });
    expect(r.success && r.data.feriados).toEqual([]);
    expect(HorarioAtendimentoSchema.safeParse({ intervalos: [], extra: 1 }).success).toBe(false);
    expect(HorarioAtendimentoSchema.safeParse({ intervalos: [{ dia: 7, inicio: "08:00", fim: "09:00" }] }).success).toBe(false);
    expect(HorarioAtendimentoSchema.safeParse({ intervalos: [], feriados: ["2026-02-30"] }).success).toBe(false);
  });
});

describe("dentroDoHorario", () => {
  it("dentro_do_horario", () => {
    expect(dentroDoHorario(d("2026-10-19T10:00-03:00"), util, fuso)).toBe(true);
    expect(dentroDoHorario(d("2026-10-18T10:00-03:00"), util, fuso)).toBe(false);
  });
  it("fechamento_e_feriado_ficam_fora", () => {
    expect(dentroDoHorario(d("2026-10-19T18:00-03:00"), util, fuso)).toBe(false);
    expect(dentroDoHorario(d("2026-10-19T08:00-03:00"), util, fuso)).toBe(true);
    expect(dentroDoHorario(d("2026-11-20T10:00-03:00"), { ...util, feriados: ["2026-11-20"] }, fuso)).toBe(false);
  });
});
