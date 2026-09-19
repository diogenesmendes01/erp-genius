import { beforeEach, expect, it, vi } from "vitest";

const { sessaoId } = vi.hoisted(() => ({ sessaoId: { atual: "" } }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared")>();
  return { ...original, exigirSessaoComPapel: vi.fn(async () => ({ id: sessaoId.atual, nome: "Usuário de teste", papeis: [] })) };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararCalendarioEscolar } from "./calendario";
import { decidirCalendarioEscolar } from "./calendario-decisao";
import { decidirEAplicarReplanejamentoConjunto } from "./replanejamento-decisao";
import { conferirRevisaoParaDecisao } from "./replanejamento-conferencia";
import { preverReplanejamentoCalendario } from "./replanejamento-consulta";
import { registrarRascunhoReplanejamento } from "./replanejamento-rascunho";
import { prepararGradeInicialTurma } from "./grade-proposta";
import { decidirGradeInicialTurma } from "./grade-decisao";

beforeEach(async () => {
  await truncarBanco();
});

it("publica revisão conjunta sem remarcações e preserva a agenda publicada", async () => {
  const catalogo = await seedCatalogoMinimo();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  await prisma.modalidade.update({
    where: { id: catalogo.modalidade.id },
    data: { frequencia: "1x/semana", aulasPorNivel: 2, horasAula: 1 },
  });
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const professor = await criarUsuario(["PROFESSOR"]);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "SEM-REMARCAR", ordem: 1 } });

  sessaoId.atual = secretaria.id;
  const calendarioBase = await prepararCalendarioEscolar({
    fusoConferido: "UTC", versaoAnterior: 0, periodos: [],
    motivo: "Calendário base da revisão sem remarcações.", chaveIdempotencia: "calendario-base-sem-remarcar",
  });
  expect(calendarioBase).toMatchObject({ ok: true });
  if (!calendarioBase.ok || !calendarioBase.dado) throw new Error("Calendário base ausente");

  sessaoId.atual = gestor.id;
  expect(await decidirCalendarioEscolar({
    calendarioId: calendarioBase.dado.id, aprovar: true, motivo: "Gestão independente publica o calendário base.",
  })).toMatchObject({ ok: true, dado: { aprovada: true } });

  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id,
    diasSemana: [4], horarioInicio: "19:00", dataInicio: new Date("2099-10-01T00:00:00.000Z"), status: "PLANEJADA",
  } });
  sessaoId.atual = secretaria.id;
  const grade = await prepararGradeInicialTurma({
    turmaId: turma.id, fusoOrigem: "UTC", versaoAnterior: 0,
    motivo: "Grade publicada que deve permanecer imutável.", chaveIdempotencia: "grade-sem-remarcar",
  });
  expect(grade.ok, grade.ok ? undefined : grade.erro).toBe(true);
  if (!grade.ok || !grade.dado) throw new Error("Grade ausente");
  sessaoId.atual = gestor.id;
  expect(await decidirGradeInicialTurma({
    propostaId: grade.dado.id, aprovar: true, motivo: "Gestão independente publica a grade.",
  })).toMatchObject({ ok: true, dado: { publicada: true } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "ABERTA" } });
  const agendaAntes = await prisma.encontroAgenda.findMany({
    where: { turmaId: turma.id }, orderBy: [{ inicio: "asc" }, { id: "asc" }],
    select: { id: true, inicio: true, fim: true, status: true, professorId: true, propostaGradeId: true },
  });
  expect(agendaAntes).not.toHaveLength(0);

  sessaoId.atual = secretaria.id;
  const calendarioNovo = await prepararCalendarioEscolar({
    fusoConferido: "UTC", versaoAnterior: 1,
    periodos: [{ id: "feriado-sem-impacto", nome: "Feriado sem aula prevista", tipo: "FERIADO", inicio: "2099-12-24", fim: "2099-12-24" }],
    motivo: "Nova versão com feriado fora dos encontros publicados.", chaveIdempotencia: "calendario-sem-remarcar",
  });
  expect(calendarioNovo).toMatchObject({ ok: true });
  if (!calendarioNovo.ok || !calendarioNovo.dado) throw new Error("Calendário novo ausente");

  sessaoId.atual = gestor.id;
  const simples = await decidirCalendarioEscolar({
    calendarioId: calendarioNovo.dado.id, aprovar: true, motivo: "Decisão simples não pode ignorar agenda publicada.",
  });
  expect(simples).toMatchObject({ ok: false });

  sessaoId.atual = secretaria.id;
  const previa = await preverReplanejamentoCalendario({ calendarioId: calendarioNovo.dado.id });
  expect(previa).toMatchObject({ ok: true });
  if (!previa.ok || !previa.dado) throw new Error("Prévia da revisão ausente");
  const alterados = previa.dado.revisoes.flatMap((revisao) => revisao.previsao?.propostas.filter((proposta) => proposta.alterado) ?? []);
  expect(alterados).toEqual([]);
  const rascunho = await registrarRascunhoReplanejamento({
    calendarioId: calendarioNovo.dado.id, estadoHash: previa.dado.estadoHash, versaoAnterior: 0,
    motivo: "Revisão conjunta conferida sem remarcações.", chaveIdempotencia: "rascunho-sem-remarcar",
  });
  expect(rascunho).toMatchObject({ ok: true });
  if (!rascunho.ok || !rascunho.dado) throw new Error("Rascunho ausente");

  expect(await conferirRevisaoParaDecisao({
    calendarioId: calendarioNovo.dado.id, revisaoId: rascunho.dado.id,
  })).toMatchObject({ ok: true, dado: { estadoCorresponde: true, independente: false, aprovacaoDisponivel: false } });
  const entrada = {
    calendarioId: calendarioNovo.dado.id, revisaoId: rascunho.dado.id, aprovar: true,
    motivo: "Gestão independente aprova a revisão conferida.", excecoesAutorizadas: [],
  };
  expect(await decidirEAplicarReplanejamentoConjunto(entrada)).toMatchObject({ ok: false });

  sessaoId.atual = gestor.id;
  expect(await conferirRevisaoParaDecisao({
    calendarioId: calendarioNovo.dado.id, revisaoId: rascunho.dado.id,
  })).toMatchObject({ ok: true, dado: { estadoCorresponde: true, independente: true, aprovacaoDisponivel: true } });
  const primeira = await decidirEAplicarReplanejamentoConjunto(entrada);
  expect(primeira).toMatchObject({ ok: true, dado: { aprovada: true, aplicada: true } });
  expect(await decidirEAplicarReplanejamentoConjunto(entrada)).toEqual(primeira);
  expect(await decidirEAplicarReplanejamentoConjunto({ ...entrada, motivo: "Tentativa divergente após a decisão." })).toMatchObject({ ok: false });

  const [decisaoCalendario, aplicacao, evento, agendaDepois, avisos] = await Promise.all([
    prisma.decisaoCalendarioEscolar.findUnique({ where: { calendarioId: calendarioNovo.dado.id } }),
    prisma.aplicacaoReplanejamentoConjunto.findUnique({ where: { rascunhoId: rascunho.dado.id } }),
    prisma.evento.findFirst({ where: { tipo: "ReplanejamentoConjuntoAplicado", payload: { path: ["revisaoId"], equals: rascunho.dado.id } } }),
    prisma.encontroAgenda.findMany({
      where: { turmaId: turma.id }, orderBy: [{ inicio: "asc" }, { id: "asc" }],
      select: { id: true, inicio: true, fim: true, status: true, professorId: true, propostaGradeId: true },
    }),
    prisma.avisoAlteracaoAgenda.count(),
  ]);
  expect(decisaoCalendario).toMatchObject({ aprovada: true, decisorId: gestor.id });
  expect(aplicacao).toMatchObject({ rascunhoId: rascunho.dado.id });
  expect(evento?.payload).toMatchObject({ aprovada: true, encontrosIds: [], horarios: [] });
  expect(agendaDepois).toEqual(agendaAntes);
  expect(avisos).toBe(0);
});

it("rejeita a fotografia obsoleta e a aplicação SQL com fotografia ou listas vazias", async () => {
  const catalogo = await seedCatalogoMinimo();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  await prisma.modalidade.update({
    where: { id: catalogo.modalidade.id },
    data: { frequencia: "1x/semana", aulasPorNivel: 2, horasAula: 1 },
  });
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const professor = await criarUsuario(["PROFESSOR"]);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "FOTO-REMARCAR", ordem: 1 } });

  sessaoId.atual = secretaria.id;
  const base = await prepararCalendarioEscolar({
    fusoConferido: "UTC", versaoAnterior: 0, periodos: [],
    motivo: "Calendário base da conferência de fotografia.", chaveIdempotencia: "foto-base-calendario",
  });
  if (!base.ok || !base.dado) throw new Error("Calendário base ausente");
  sessaoId.atual = gestor.id;
  expect(await decidirCalendarioEscolar({
    calendarioId: base.dado.id, aprovar: true, motivo: "Gestão aprova o calendário base da fotografia.",
  })).toMatchObject({ ok: true });

  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id,
    diasSemana: [4], horarioInicio: "19:00", dataInicio: new Date("2099-10-01T00:00:00.000Z"), status: "PLANEJADA",
  } });
  sessaoId.atual = secretaria.id;
  const grade = await prepararGradeInicialTurma({
    turmaId: turma.id, fusoOrigem: "UTC", versaoAnterior: 0,
    motivo: "Grade usada para invalidar uma fotografia.", chaveIdempotencia: "foto-grade",
  });
  if (!grade.ok || !grade.dado) throw new Error("Grade ausente");
  sessaoId.atual = gestor.id;
  expect(await decidirGradeInicialTurma({
    propostaId: grade.dado.id, aprovar: true, motivo: "Gestão aprova a grade da fotografia.",
  })).toMatchObject({ ok: true });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "ABERTA" } });
  const encontro = await prisma.encontroAgenda.findFirstOrThrow({ where: { turmaId: turma.id }, orderBy: { inicio: "asc" } });

  sessaoId.atual = secretaria.id;
  const calendarioObsoleto = await prepararCalendarioEscolar({
    fusoConferido: "UTC", versaoAnterior: 1, periodos: [],
    motivo: "Versão a ser conferida antes da alteração da agenda.", chaveIdempotencia: "foto-calendario-obsoleto",
  });
  if (!calendarioObsoleto.ok || !calendarioObsoleto.dado) throw new Error("Calendário obsoleto ausente");
  const previa = await preverReplanejamentoCalendario({ calendarioId: calendarioObsoleto.dado.id });
  if (!previa.ok || !previa.dado) throw new Error("Prévia obsoleta ausente");
  const rascunho = await registrarRascunhoReplanejamento({
    calendarioId: calendarioObsoleto.dado.id, estadoHash: previa.dado.estadoHash, versaoAnterior: 0,
    motivo: "Rascunho cuja fotografia será superada.", chaveIdempotencia: "foto-rascunho-obsoleto",
  });
  if (!rascunho.ok || !rascunho.dado) throw new Error("Rascunho obsoleto ausente");
  await prisma.encontroAgenda.update({
    where: { id: encontro.id },
    data: { inicio: new Date(encontro.inicio.getTime() + 60_000), fim: new Date(encontro.fim.getTime() + 60_000) },
  });
  sessaoId.atual = gestor.id;
  expect(await decidirEAplicarReplanejamentoConjunto({
    calendarioId: calendarioObsoleto.dado.id, revisaoId: rascunho.dado.id, aprovar: true,
    motivo: "Não pode aprovar fotografia que perdeu vigência.", excecoesAutorizadas: [],
  })).toMatchObject({ ok: false });

  sessaoId.atual = secretaria.id;
  const calendarioMalformado = await prepararCalendarioEscolar({
    fusoConferido: "UTC", versaoAnterior: 2, periodos: [],
    motivo: "Versão usada para provar o guard SQL de fotografia.", chaveIdempotencia: "foto-calendario-malformado",
  });
  if (!calendarioMalformado.ok || !calendarioMalformado.dado) throw new Error("Calendário da prova SQL ausente");
  const calendarioMalformadoId = calendarioMalformado.dado.id;
  const rascunhoMalformado = await prisma.rascunhoReplanejamento.create({ data: {
    calendarioId: calendarioMalformadoId, preparadorId: secretaria.id, versao: 1,
    motivo: "Registro propositalmente malformado para o guard SQL.", chaveIdempotencia: "foto-rascunho-malformado",
    entradaHash: "a".repeat(64), estadoHash: "b".repeat(64), snapshot: { revisoes: [{}] },
  } });
  await expect(prisma.$transaction(async (tx) => {
    const decisaoCalendario = await tx.decisaoCalendarioEscolar.create({ data: {
      calendarioId: calendarioMalformadoId, decisorId: gestor.id, aprovada: true,
      motivo: "Decisão SQL usada somente para validar a guarda.",
    } });
    const decisao = await tx.decisaoReplanejamentoConjunto.create({ data: {
      rascunhoId: rascunhoMalformado.id, decisorId: gestor.id, aprovada: true,
      motivo: "Decisão SQL usada somente para validar a guarda.", estadoHash: rascunhoMalformado.estadoHash,
    } });
    await tx.evento.create({ data: {
      tipo: "ReplanejamentoConjuntoAplicado", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: gestor.id,
      payload: { aprovada: true, calendarioId: calendarioMalformadoId, decisaoCalendarioId: decisaoCalendario.id, revisaoId: rascunhoMalformado.id, decisaoId: decisao.id, encontrosIds: [], horarios: [] },
    } });
    await tx.aplicacaoReplanejamentoConjunto.create({ data: {
      rascunhoId: rascunhoMalformado.id, decisaoId: decisao.id, estadoHash: rascunhoMalformado.estadoHash,
    } });
    await tx.$executeRawUnsafe('SET CONSTRAINTS "validar_aplicacao_replanejamento_material_167" IMMEDIATE');
  })).rejects.toThrow("fotografia completa");
  expect(await prisma.aplicacaoReplanejamentoConjunto.count()).toBe(0);
});
