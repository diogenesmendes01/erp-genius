import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarTurma, editarTurma } from "./acoes";
import { prepararCalendarioEscolar } from "@/server/agenda/calendario";
import { decidirCalendarioEscolar } from "@/server/agenda/calendario-decisao";
import { prepararGradeInicialTurma } from "@/server/agenda/grade-proposta";
import { decidirGradeInicialTurma } from "@/server/agenda/grade-decisao";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const DATA_INICIAL = "2099-10-12";
const DIA_DA_SEMANA = new Date(`${DATA_INICIAL}T00:00:00.000Z`).getUTCDay();

describe("Q47/Q48 — criação e publicação da turma noturna", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await truncarBanco();
  });

  it("cria 22:00–01:00 sem data final, pula o dia seguinte não letivo e publica três horas reais", async () => {
    const catalogo = await seedCatalogoMinimo();
    await prisma.modalidade.update({
      where: { id: catalogo.modalidade.id },
      data: { frequencia: "1x/semana", horasAula: 3, aulasPorNivel: 1 },
    });
    const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
    const criador = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestora criadora");
    const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria preparadora");
    const decisor = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestora decisora");
    const professor = await criarUsuario([Papel.PROFESSOR], "Professor noturno");

    await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
    entrar(secretaria.id);
    const calendario = await prepararCalendarioEscolar({
      fusoConferido: "UTC",
      versaoAnterior: 0,
      motivo: "Calendário com o dia seguinte indisponível",
      chaveIdempotencia: "q47-calendario-inicial",
      periodos: [{ id: "feriado-noturno", nome: "Feriado no dia seguinte", tipo: "FERIADO", inicio: "2099-10-13", fim: "2099-10-13" }],
    });
    expect(calendario.ok, calendario.ok ? undefined : calendario.erro).toBe(true);
    if (!calendario.ok || !calendario.dado) throw new Error("Calendário ausente");
    entrar(decisor.id);
    expect(await decidirCalendarioEscolar({ calendarioId: calendario.dado.id, aprovar: true, motivo: "Calendário conferido pela gestão" })).toMatchObject({ ok: true });

    entrar(criador.id);
    const criada = await criarTurma({
      nome: "Noturna sem data final manual",
      modalidadeId: catalogo.modalidade.id,
      nivelId: nivel.id,
      professorId: professor.id,
      diasSemana: [DIA_DA_SEMANA],
      horarioInicio: "22:00",
      horarioFim: "01:00",
      dataInicio: DATA_INICIAL,
      capacidade: 12,
    });
    expect(criada.ok, criada.ok ? undefined : criada.erro).toBe(true);
    if (!criada.ok || !criada.dado) throw new Error("Turma ausente");
    const turma = await prisma.turma.findUniqueOrThrow({ where: { id: criada.dado.id } });
    expect(turma).toMatchObject({ status: "PLANEJADA", dataFim: null, horarioInicio: "22:00", horarioFim: "01:00" });

    entrar(secretaria.id);
    const proposta = await prepararGradeInicialTurma({
      turmaId: turma.id,
      fusoOrigem: "UTC",
      versaoAnterior: 0,
      motivo: "Prévia noturna derivada da duração aprovada",
      chaveIdempotencia: "q47-grade-noturna",
    });
    expect(proposta.ok, proposta.ok ? undefined : proposta.erro).toBe(true);
    if (!proposta.ok || !proposta.dado) throw new Error("Proposta ausente");
    const propostaPersistida = await prisma.propostaGradeTurma.findUniqueOrThrow({ where: { id: proposta.dado.id } });
    const grade = propostaPersistida.snapshot as { grade: { encontros: { inicio: string; fim: string; dataOrigem: string }[] } };
    expect(grade.grade.encontros).toHaveLength(1);
    expect(grade.grade.encontros[0]).toMatchObject({ dataOrigem: "2099-10-19", inicio: "2099-10-19T22:00:00.000Z", fim: "2099-10-20T01:00:00.000Z" });

    entrar(decisor.id);
    const decisao = await decidirGradeInicialTurma({ propostaId: proposta.dado.id, aprovar: true, motivo: "Agenda noturna conferida de forma independente" });
    expect(decisao.ok, decisao.ok ? undefined : decisao.erro).toBe(true);
    const encontro = await prisma.encontroAgenda.findFirstOrThrow({ where: { turmaId: turma.id } });
    expect(encontro.fim.getTime() - encontro.inicio.getTime()).toBe(3 * 60 * 60 * 1000);
    expect(encontro.inicio.toISOString()).toBe("2099-10-19T22:00:00.000Z");
    expect(encontro.fim.toISOString()).toBe("2099-10-20T01:00:00.000Z");
  });

  it("exige duração em nova edição, mas preserva frequência e referência de legado em correção nominal", async () => {
    const catalogo = await seedCatalogoMinimo();
    await prisma.modalidade.update({ where: { id: catalogo.modalidade.id }, data: { frequencia: "1x/semana", horasAula: 3 } });
    const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
    const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
    const professor = await criarUsuario([Papel.PROFESSOR]);
    entrar(gestor.id);

    expect(await criarTurma({
      modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id,
      diasSemana: [1], horarioInicio: "22:00", horarioFim: "02:00", dataInicio: "2099-10-12", capacidade: 12,
    })).toMatchObject({ ok: false, erro: expect.stringContaining("dura") });

    const novaValida = await criarTurma({
      modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id,
      diasSemana: [1], horarioInicio: "22:00", horarioFim: "01:00", dataInicio: "2099-10-12", capacidade: 12,
    });
    expect(novaValida.ok, novaValida.ok ? undefined : novaValida.erro).toBe(true);
    if (!novaValida.ok || !novaValida.dado) throw new Error("Turma válida ausente");
    expect(await editarTurma(novaValida.dado.id, {
      modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id,
      diasSemana: [1], horarioInicio: "22:00", horarioFim: "02:00", dataInicio: "2099-10-12", capacidade: 12,
    })).toMatchObject({ ok: false, erro: expect.stringContaining("dura") });

    const legado = await prisma.turma.create({ data: {
      modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id,
      diasSemana: [1, 3], horarioInicio: "19:00", horarioFim: "21:00", dataInicio: new Date("2099-10-12T12:00:00.000Z"),
      dataFim: new Date("2099-12-01T12:00:00.000Z"), capacidade: 12, status: "PLANEJADA",
    } });
    expect(await editarTurma(legado.id, {
      nome: "Nome corrigido sem revalidar duração legada",
      modalidadeId: catalogo.modalidade.id,
      nivelId: nivel.id,
      professorId: professor.id,
      diasSemana: [1, 3],
      horarioInicio: "19:00",
      horarioFim: "21:00",
      dataInicio: "2099-10-12",
      capacidade: 12,
    })).toMatchObject({ ok: true });
    expect(await prisma.turma.findUniqueOrThrow({ where: { id: legado.id } })).toMatchObject({
      nome: "Nome corrigido sem revalidar duração legada",
      dataFim: new Date("2099-12-01T12:00:00.000Z"),
    });
    expect(await editarTurma(legado.id, {
      nome: "Não pode ultrapassar a referência legada",
      modalidadeId: catalogo.modalidade.id,
      nivelId: nivel.id,
      professorId: professor.id,
      diasSemana: [1, 3],
      horarioInicio: "19:00",
      horarioFim: "21:00",
      dataInicio: "2100-01-01",
      capacidade: 12,
    })).toMatchObject({ ok: false, erro: expect.stringContaining("data final de referência") });
    expect(await editarTurma(legado.id, {
      modalidadeId: catalogo.modalidade.id,
      nivelId: nivel.id,
      professorId: professor.id,
      diasSemana: [1, 3],
      horarioInicio: "18:00",
      horarioFim: "20:00",
      dataInicio: "2099-10-12",
      capacidade: 12,
    })).toMatchObject({ ok: false, erro: expect.stringContaining("dura") });
  });
});
