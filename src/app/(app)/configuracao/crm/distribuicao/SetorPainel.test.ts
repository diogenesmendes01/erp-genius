import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/crm-config/acoes-distribuicao", () => ({ salvarConfigSetorDaTela: vi.fn() }));

import type { HorarioAtendimento } from "@/server/crm-config/horario-atendimento";
import { entradaSalvarSetor, erroDasLinhas, horarioDasLinhas, linhasDoHorario, SetorPainel, type SetorPainelProps } from "./SetorPainel";

const util: HorarioAtendimento = { intervalos: [1, 2, 3, 4, 5].map((dia) => ({ dia, inicio: "08:00", fim: "18:00" })), feriados: [] };
const props: SetorPainelProps = {
  finalidade: "COMERCIAL", rotulo: "Comercial", regra: "MANUAL", participantesIds: [], candidatos: [], prazo: 60,
  alertarResponsavel: true, alertarGerente: false, contarSoNoHorario: true, horario: util, fuso: "America/Sao_Paulo", outrosHorarios: [],
};
const html = (p: Partial<SetorPainelProps> = {}) => renderToStaticMarkup(createElement(SetorPainel, { ...props, ...p }));

describe("tela de Distribuição e SLA", () => {
  it("sem_aviso_em_breve", () => expect(html()).not.toMatch(/em breve/i));

  it("mostra_horario_gravado", () => {
    const h = html();
    expect(h).toContain('value="08:00"');
    expect(h).toContain('value="18:00"');
    expect(h).toContain("Horário de atendimento (fuso da escola: America/Sao_Paulo)");
    expect(h).toContain("Mudanças valem para os próximos atendimentos; prazos já calculados não mudam.");
    expect(h).toContain("O alerta aparece no sino e na lista do Inbox uma vez por atendimento. Sem responsável, vai ao gerente do setor.");
  });

  it("aviso_sem_horario_quando_flag_ligada", () => {
    expect(html({ horario: null })).toContain("Sem horário cadastrado: o prazo conta direto, 24 h por dia.");
    expect(html({ horario: null, contarSoNoHorario: false })).not.toContain("Sem horário cadastrado");
    expect(html()).not.toContain("Sem horário cadastrado");
  });

  it("copiar_de_outro_setor_so_aparece_com_horario_de_outro", () => {
    expect(html()).not.toContain("Copiar horário");
    const h = html({ outrosHorarios: [{ finalidade: "PEDAGOGICO", rotulo: "Pedagógico", horario: util }] });
    expect(h).toContain("Copiar horário");
    expect(h).toContain("Pedagógico");
  });
});

describe("linhas do horário", () => {
  it("ida_e_volta", () => expect(horarioDasLinhas(linhasDoHorario(util), [])).toEqual(util));

  it("envia_horario_ao_salvar", () => {
    const linhas = linhasDoHorario(null).map((l) => (l.dia === 1 ? { ...l, atende: true, inicio: "08:00", fim: "18:00" } : l));
    const e = entradaSalvarSetor({ finalidade: "COMERCIAL", regra: "MANUAL", ids: [], prazo: 60, alResp: true, alGer: false, contar: true, linhas, feriados: [] });
    expect(e).toEqual({
      distribuicao: { finalidade: "COMERCIAL", regra: "MANUAL", participantesIds: [] },
      sla: { prazoPrimeiraRespostaMin: 60, alertarResponsavel: true, alertarGerente: false, contarSoNoHorario: true, horario: { intervalos: [{ dia: 1, inicio: "08:00", fim: "18:00" }], feriados: [] } },
    });
  });

  it("sem_dias_marcados_envia_null", () => {
    const e = entradaSalvarSetor({ finalidade: "COMERCIAL", regra: "MANUAL", ids: [], prazo: 60, alResp: true, alGer: false, contar: true, linhas: linhasDoHorario(null), feriados: [] });
    expect(e.sla.horario).toBeNull();
  });

  it("feriados_gravados_sao_preservados", () => {
    expect(horarioDasLinhas(linhasDoHorario(util), ["2026-11-20"])).toEqual({ ...util, feriados: ["2026-11-20"] });
  });

  it("dia_com_varios_intervalos_preservado_se_nao_editado", () => {
    const almoco: HorarioAtendimento = { intervalos: [{ dia: 1, inicio: "08:00", fim: "12:00" }, { dia: 1, inicio: "13:00", fim: "18:00" }], feriados: [] };
    const linhas = linhasDoHorario(almoco);
    expect(horarioDasLinhas(linhas, [])).toEqual(almoco);
    const editadas = linhas.map((l) => (l.dia === 1 ? { ...l, fim: "17:00", originais: null } : l));
    expect(horarioDasLinhas(editadas, [])).toEqual({ intervalos: [{ dia: 1, inicio: "08:00", fim: "17:00" }], feriados: [] });
  });

  it("fim_antes_do_inicio_vira_erro_na_tela", () => {
    const linhas = linhasDoHorario(null).map((l) => (l.dia === 2 ? { ...l, atende: true, inicio: "18:00", fim: "08:00" } : l));
    expect(erroDasLinhas(linhas)).toBe("Terça: o fim do horário deve ser depois do início.");
    expect(erroDasLinhas(linhasDoHorario(util))).toBeNull();
  });
});
