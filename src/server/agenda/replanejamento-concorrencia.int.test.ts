import { beforeEach, expect, it, vi } from "vitest";

const { sessaoId } = vi.hoisted(() => ({ sessaoId: { atual: "" } }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared")>();
  return { ...original, exigirSessaoComPapel: vi.fn(async () => ({ id: sessaoId.atual, nome: "Gestor de teste", papeis: [] })) };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararCalendarioEscolar } from "./calendario";
import { decidirCalendarioEscolar } from "./calendario-decisao";
import { decidirEAplicarReplanejamentoConjunto } from "./replanejamento-decisao";
import { preverReplanejamentoCalendario } from "./replanejamento-consulta";
import { registrarRascunhoReplanejamento } from "./replanejamento-rascunho";
import { prepararGradeInicialTurma } from "./grade-proposta";
import { decidirGradeInicialTurma } from "./grade-decisao";

beforeEach(async () => { await truncarBanco(); });

it("serializa duas aprovações da mesma revisão sem duplicar os fatos aplicados", async () => {
  const catalogo = await seedCatalogoMinimo();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  await prisma.modalidade.update({ where: { id: catalogo.modalidade.id }, data: { frequencia: "1x/semana", aulasPorNivel: 2, horasAula: 1 } });
  const preparador = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const professor = await criarUsuario(["PROFESSOR"]);
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "CONCORRENCIA", ordem: 1 } });

  sessaoId.atual = preparador.id;
  const base = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 0, periodos: [], motivo: "Calendário base para concorrência", chaveIdempotencia: "concorrencia-base" });
  if (!base.ok || !base.dado) throw new Error("Calendário base ausente");
  sessaoId.atual = gestor.id;
  expect((await decidirCalendarioEscolar({ calendarioId: base.dado.id, aprovar: true, motivo: "Publicação independente do calendário base" })).ok).toBe(true);

  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, diasSemana: [4], horarioInicio: "19:00", dataInicio: new Date("2099-10-01T00:00:00Z") } });
  sessaoId.atual = preparador.id;
  const grade = await prepararGradeInicialTurma({ turmaId: turma.id, fusoOrigem: "UTC", versaoAnterior: 0, motivo: "Grade que será replanejada", chaveIdempotencia: "concorrencia-grade" });
  if (!grade.ok || !grade.dado) throw new Error("Grade ausente");
  sessaoId.atual = gestor.id;
  expect((await decidirGradeInicialTurma({ propostaId: grade.dado.id, aprovar: true, motivo: "Grade aprovada por outra pessoa" })).ok).toBe(true);
  const primeiro = await prisma.encontroAgenda.findFirstOrThrow({ where: { turmaId: turma.id }, orderBy: { inicio: "asc" } });

  sessaoId.atual = preparador.id;
  const calendario = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 1, motivo: "Feriado que exige replanejamento", chaveIdempotencia: "concorrencia-feriado", periodos: [{ id: "feriado", nome: "Feriado", tipo: "FERIADO", inicio: primeiro.inicio.toISOString().slice(0, 10), fim: primeiro.inicio.toISOString().slice(0, 10) }] });
  if (!calendario.ok || !calendario.dado) throw new Error("Calendário a aplicar ausente");
  const previa = await preverReplanejamentoCalendario({ calendarioId: calendario.dado.id });
  if (!previa.ok || !previa.dado) throw new Error("Prévia de replanejamento ausente");
  const rascunho = await registrarRascunhoReplanejamento({ calendarioId: calendario.dado.id, estadoHash: previa.dado.estadoHash, versaoAnterior: 0, motivo: "Revisão concorrente conferida", chaveIdempotencia: "concorrencia-rascunho" });
  if (!rascunho.ok || !rascunho.dado) throw new Error("Rascunho de replanejamento ausente");

  sessaoId.atual = gestor.id;
  const entrada = { calendarioId: calendario.dado.id, revisaoId: rascunho.dado.id, aprovar: true, motivo: "Aplicação conjunta independente", excecoesAutorizadas: [] };
  const [primeira, segunda] = await Promise.all([decidirEAplicarReplanejamentoConjunto(entrada), decidirEAplicarReplanejamentoConjunto(entrada)]);
  expect(primeira).toMatchObject({ ok: true, dado: { aprovada: true, aplicada: true } });
  expect(segunda).toEqual(primeira);
  expect(await decidirEAplicarReplanejamentoConjunto(entrada)).toEqual(primeira);

  const [decisoes, aplicacoes, decisoesCalendario, eventos] = await Promise.all([
    prisma.decisaoReplanejamentoConjunto.findMany(), prisma.aplicacaoReplanejamentoConjunto.findMany(),
    prisma.decisaoCalendarioEscolar.findMany({ where: { calendarioId: calendario.dado.id } }),
    prisma.evento.findMany({ where: { tipo: "ReplanejamentoConjuntoAplicado" } }),
  ]);
  expect(decisoes).toHaveLength(1);
  expect(decisoes[0]).toMatchObject({ rascunhoId: rascunho.dado.id, decisorId: gestor.id, aprovada: true });
  expect(aplicacoes).toHaveLength(1);
  expect(decisoesCalendario).toEqual([expect.objectContaining({ aprovada: true, decisorId: gestor.id })]);
  expect(eventos).toHaveLength(1);
  expect(eventos[0].payload).toMatchObject({ aprovada: true, revisaoId: rascunho.dado.id, decisaoId: decisoes[0].id, encontrosIds: expect.any(Array) });
  const propostas = previa.dado.revisoes.flatMap((r) => r.previsao?.propostas.filter((p) => p.alterado) ?? []);
  const persistidos = await prisma.encontroAgenda.findMany({ where: { id: { in: propostas.map((p) => p.encontroId) } } });
  expect(persistidos.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })).sort((a, b) => a.id.localeCompare(b.id))).toEqual(propostas.map((p) => ({ id: p.encontroId, inicio: p.inicioProposto, fim: p.fimProposto })).sort((a, b) => a.id.localeCompare(b.id)));
});
