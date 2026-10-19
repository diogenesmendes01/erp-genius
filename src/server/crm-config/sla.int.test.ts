import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { salvarConfigSetor, salvarSlaSetor } from "./sla";
import type { HorarioAtendimento } from "./horario-atendimento";

let admin: Awaited<ReturnType<typeof criarUsuario>>;
const logado = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const sla = { finalidade: "COMERCIAL", prazoPrimeiraRespostaMin: 60, alertarResponsavel: true, alertarGerente: false, contarSoNoHorario: true } as const;
const util: HorarioAtendimento = { intervalos: [1, 2, 3, 4, 5].map((dia) => ({ dia, inicio: "08:00", fim: "18:00" })), feriados: [] };
const eventosSla = async () => (await eventosDo("ConfigSetorAtendimento", "COMERCIAL")).filter((e) => e.tipo === "SlaAlterado");
const contarEventos = async () => (await eventosSla()).length;
const gravado = async () => (await prisma.prazoRespostaSetor.findUnique({ where: { finalidade: "COMERCIAL" } }))!.horario;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  logado(admin);
});

describe("horário de atendimento do SLA", () => {
  it("grava_horario_e_audita", async () => {
    expect((await salvarSlaSetor({ ...sla, horario: util })).ok).toBe(true);
    expect(await gravado()).toEqual(util);
    expect((await eventosSla()).at(-1)!.payload).toMatchObject({ para: { horario: util } });
  });

  it("horario_invalido_recusado_sem_evento", async () => {
    const n = await contarEventos();
    expect((await salvarSlaSetor({ ...sla, horario: { intervalos: [{ dia: 1, inicio: "18:00", fim: "08:00" }], feriados: [] } })).ok).toBe(false);
    expect(await contarEventos()).toBe(n);
  });

  it("mesmo_horario_nao_gera_evento_vazio", async () => {
    await salvarSlaSetor({ ...sla, horario: util });
    const n = await contarEventos();
    // Mesma grade em outra ordem: a comparação é canônica.
    expect((await salvarSlaSetor({ ...sla, horario: { intervalos: [...util.intervalos].reverse(), feriados: [] } })).ok).toBe(true);
    expect(await contarEventos()).toBe(n);
  });

  it("horario_grava_em_ordem_canonica", async () => {
    await salvarSlaSetor({ ...sla, horario: { intervalos: [...util.intervalos].reverse(), feriados: [] } });
    expect(await gravado()).toEqual(util);
  });

  it("limpar_horario_grava_null_com_de_e_para", async () => {
    await salvarSlaSetor({ ...sla, horario: util });
    expect((await salvarSlaSetor({ ...sla, horario: null })).ok).toBe(true);
    expect(await gravado()).toBeNull();
    expect((await eventosSla()).at(-1)!.payload).toMatchObject({ de: { horario: util }, para: { horario: null } });
  });

  it("sem_campo_horario_preserva_o_gravado", async () => {
    await salvarSlaSetor({ ...sla, horario: util });
    const n = await contarEventos();
    expect((await salvarSlaSetor(sla)).ok).toBe(true);
    expect(await gravado()).toEqual(util);
    expect(await contarEventos()).toBe(n);
  });

  it("tela_salva_horario_com_a_distribuicao", async () => {
    const { finalidade, ...resto } = sla;
    expect((await salvarConfigSetor({ distribuicao: { finalidade, regra: "MANUAL", participantesIds: [] }, sla: { ...resto, horario: util } })).ok).toBe(true);
    expect(await gravado()).toEqual(util);
  });
});
