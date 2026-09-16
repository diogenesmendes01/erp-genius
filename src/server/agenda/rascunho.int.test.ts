import { conferirRevisaoParaDecisao } from "./replanejamento-conferencia";
import { decidirEAplicarReplanejamentoConjunto } from "./replanejamento-decisao";
import { consultarHistoricoReplanejamento, consultarRevisaoReplanejamento } from "./replanejamento-historico";
import { beforeEach, expect, it, vi } from "vitest";
import type { EncontroAgenda } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarRascunhoReplanejamento } from "./replanejamento-rascunho";
import { preverReplanejamentoCalendario } from "./replanejamento-consulta";
import { iniciarTurmasDaAgenda } from "./inicio-turmas";
import { prepararEncontroAgenda } from "./rascunho";
import { consultarConflitosEncontro } from "./conflitos";
import { prepararCalendarioEscolar } from "./calendario";
import { decidirCalendarioEscolar, consultarCalendarioEscolarVigente } from "./calendario-decisao";
import { preverImpactosCalendario } from "./calendario-impactos";
import { preverGradeInicialTurma } from "./grade-turma";
import { prepararGradeInicialTurma } from "./grade-proposta";
import { decidirGradeInicialTurma } from "./grade-decisao";
import { consultarPropostaGradeTurma } from "./grade-consulta";
import { solicitarIndisponibilidadeDocente, decidirIndisponibilidadeDocente, solicitarIndisponibilidadeLocal } from "./indisponibilidade";
import { consultarIndisponibilidadesDocentes } from "./indisponibilidade-consulta";
import { prepararSubstituicaoDocente } from "./substituicao";
import { consultarPropostaSubstituicao } from "./substituicao-consulta";
import { decidirSubstituicaoDocente } from "./substituicao-decisao";
import { consultarEncontrosDocente } from "./encontros-docente";
let matriculaId: string, autorId: string;
beforeEach(async () => {
  await truncarBanco(); const c = await seedCatalogoMinimo();
  const u = await criarUsuario(["SECRETARIA_ACADEMICA"]); autorId = u.id; authMock.mockResolvedValue({ user: { id: u.id } });
  const a = await prisma.aluno.create({ data: { primeiroNome: "Agenda teste", paisId: c.pais.id } });
  matriculaId = (await prisma.matricula.create({ data: { alunoId: a.id, paisId: c.pais.id, produtoId: c.produto.id, moeda: "CRC" } })).id;
});
const entrada = () => ({ matriculaId, inicio: "2026-10-01T23:00:00-03:00", fim: "2026-10-02T01:00:00-03:00", fusoOrigem: "America/Sao_Paulo", motivo: "Planejamento de particular contratada", chaveIdempotencia: "rascunho-encontro-teste" });
it("aplica substituição independente integralmente e impede aprovação com conflito surgido depois", async () => {
  const titular = await criarUsuario(["PROFESSOR"]), substituto = await criarUsuario(["PROFESSOR"]), gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["GERENTE_PEDAGOGICO"] } });
  const criar = (dia: number, professorId: string, chave: string) => prisma.encontroAgenda.create({ data: { matriculaId, professorId, preparadorId: autorId,
    inicio: new Date(`2099-10-0${dia}T13:00:00Z`), fim: new Date(`2099-10-0${dia}T14:00:00Z`), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula para aprovação", chaveIdempotencia: chave, entradaHash: "fixture" } });
  const e1 = await criar(1, titular.id, "aplicar-primeiro"), e2 = await criar(2, titular.id, "aplicar-segundo");
  const input = { encontrosIds: [e1.id, e2.id], substitutoId: substituto.id, motivo: "Cobertura em duas aulas", chaveIdempotencia: "substituicao-aplicar" };
  const p = await prepararSubstituicaoDocente(input);
  if (!p.ok || !p.dado) throw new Error("Proposta ausente");
  const decisao = { propostaId: p.dado.id, aprovar: true, motivo: "Conferido por outra pessoa" };
  expect((await decidirSubstituicaoDocente(decisao)).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: substituto.id } });
  expect((await consultarEncontrosDocente({ encontroId: e1.id })).ok).toBe(false);
  const conflito = await criar(2, substituto.id, "conflito-posterior");
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect((await decidirSubstituicaoDocente(decisao)).ok).toBe(false);
  expect(await prisma.decisaoSubstituicaoDocente.count()).toBe(0);
  expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: e1.id } })).professorId).toBe(titular.id);
  await prisma.encontroAgenda.update({ where: { id: conflito.id }, data: { status: "CANCELADO" } });
  const r = await decidirSubstituicaoDocente(decisao);
  expect(r).toMatchObject({ ok: true, dado: { aplicada: true } });
  expect(await decidirSubstituicaoDocente(decisao)).toEqual(r);
  for (const e of [e1, e2]) expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: e.id } })).toEqual({ ...e, professorId: substituto.id });
  expect(await prisma.decisaoSubstituicaoDocente.count()).toBe(1);
  authMock.mockResolvedValue({ user: { id: substituto.id } });
  const acesso = await consultarEncontrosDocente({ encontroId: e1.id });
  expect(acesso).toMatchObject({ ok: true, dado: { encontros: [{ id: e1.id, atribuicaoPropria: true }] } });
  if (!acesso.ok || !acesso.dado) throw new Error("Acesso ausente");
  expect(Object.keys(acesso.dado.encontros[0]).sort()).toEqual(["id", "inicio", "fim", "fusoOrigem", "status", "professor", "atribuicaoPropria", "turma", "particular"].sort());
  authMock.mockResolvedValue({ user: { id: titular.id } });
  expect((await consultarEncontrosDocente({ encontroId: e1.id })).ok).toBe(false);
  expect((await consultarEncontrosDocente({ cursor: e1.id })).ok).toBe(false);
  expect(await consultarEncontrosDocente()).toMatchObject({ ok: true, dado: { encontros: [] } });
  await expect(prisma.decisaoSubstituicaoDocente.updateMany({ data: { aprovada: false } })).rejects.toThrow();
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect(await prepararSubstituicaoDocente(input)).toMatchObject({ ok: true, dado: { aplicada: true } });
});
it("preserva proposta de substituição e encontros sem aplicar a troca", async () => {
  const titular = await criarUsuario(["PROFESSOR"]), substituto = await criarUsuario(["PROFESSOR"]);
  const encontros: EncontroAgenda[] = [];
  for (const dia of [1, 2]) encontros.push(await prisma.encontroAgenda.create({ data: { matriculaId, professorId: titular.id, preparadorId: autorId,
    inicio: new Date(`2099-10-0${dia}T13:00:00Z`), fim: new Date(`2099-10-0${dia}T14:00:00Z`), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Encontro para substituição", chaveIdempotencia: `substituicao-encontro-${dia}`, entradaHash: "fixture" } }));
  const input = { encontrosIds: encontros.map((e) => e.id), substitutoId: substituto.id, motivo: "Cobertura temporária do titular", chaveIdempotencia: "proposta-substituicao-teste" };
  const r = await prepararSubstituicaoDocente(input);
  expect(r).toMatchObject({ ok: true, dado: { aplicada: false } });
  expect(await prepararSubstituicaoDocente({ ...input, encontrosIds: [...input.encontrosIds].reverse() })).toEqual(r);
  expect((await prepararSubstituicaoDocente({ ...input, motivo: "Outra alteração na mesma chave" })).ok).toBe(false);
  const proposta = await prisma.propostaSubstituicaoDocente.findFirstOrThrow({ include: { itens: true } });
  expect(proposta.itens).toHaveLength(2);
  expect(proposta.itens[0].snapshot).toMatchObject({ professorId: titular.id, matriculaId });
  expect(await consultarPropostaSubstituicao({ propostaId: proposta.id })).toMatchObject({ ok: true, dado: { pendencias: [], conflitos: [], indisponibilidades: [], aplicacaoAutorizada: false } });
  const concorrente = await prisma.encontroAgenda.create({ data: { matriculaId, professorId: substituto.id, preparadorId: autorId,
    inicio: encontros[1].inicio, fim: encontros[1].fim, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Compromisso do substituto", chaveIdempotencia: "compromisso-substituto", entradaHash: "fixture" } });
  expect(await consultarPropostaSubstituicao({ propostaId: proposta.id })).toMatchObject({ ok: true, dado: { conflitos: [{ encontroId: encontros[1].id, concorrenteId: concorrente.id }] } });
  await prisma.encontroAgenda.update({ where: { id: concorrente.id }, data: { status: "CANCELADO" } });
  expect(await consultarPropostaSubstituicao({ propostaId: proposta.id })).toMatchObject({ ok: true, dado: { conflitos: [] } });
  const ausencia = await solicitarIndisponibilidadeDocente({ professorId: substituto.id, inicio: encontros[0].inicio.toISOString(), fim: encontros[0].fim.toISOString(), fusoOrigem: "UTC", motivo: "Ausência do substituto", chaveIdempotencia: "ausencia-substituto-teste" });
  if (!ausencia.ok || !ausencia.dado) throw new Error("Ausência não criada");
  const gestorSubstituicao = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  authMock.mockResolvedValue({ user: { id: gestorSubstituicao.id } });
  expect((await decidirIndisponibilidadeDocente({ indisponibilidadeId: ausencia.dado.id, impactoHash: await impactoAusenciaTeste(ausencia.dado.id), aprovar: true, motivo: "Ausência conferida pela gestão" })).ok).toBe(true);
  expect(await consultarPropostaSubstituicao({ propostaId: proposta.id })).toMatchObject({ ok: true, dado: { indisponibilidades: [{ encontroId: encontros[0].id, indisponibilidadeId: ausencia.dado.id }] } });
  authMock.mockResolvedValue({ user: { id: autorId } });
  await expect(prisma.propostaSubstituicaoDocente.update({ where: { id: proposta.id }, data: { motivo: "Editar proposta" } })).rejects.toThrow();
  await expect(prisma.itemSubstituicaoDocente.delete({ where: { id: proposta.itens[0].id } })).rejects.toThrow();
  for (const e of encontros) expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: e.id } })).toEqual(e);
  expect((await prepararSubstituicaoDocente({ ...input, encontrosIds: [encontros[0].id, encontros[0].id], chaveIdempotencia: "duplicada-substituicao" })).ok).toBe(false);
  expect((await prepararSubstituicaoDocente({ ...input, substitutoId: titular.id, chaveIdempotencia: "mesmo-professor-teste" })).ok).toBe(false);
  await prisma.encontroAgenda.update({ where: { id: encontros[0].id }, data: { status: "CANCELADO" } });
  const alterada = await consultarPropostaSubstituicao({ propostaId: proposta.id });
  if (!alterada.ok || !alterada.dado) throw new Error("Conferência ausente");
  expect(alterada.dado.itens.find((i) => i.encontroId === encontros[0].id)).toMatchObject({ alterado: true, snapshot: { status: "PREVISTO" }, atual: { status: "CANCELADO" } });
  expect((await prepararSubstituicaoDocente({ ...input, chaveIdempotencia: "encontro-cancelado-teste" })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: titular.id } });
  expect((await consultarPropostaSubstituicao({ propostaId: proposta.id })).ok).toBe(false);
  expect((await prepararSubstituicaoDocente({ ...input, chaveIdempotencia: "professor-sem-permissao" })).ok).toBe(false);
  expect(await prisma.propostaSubstituicaoDocente.count()).toBe(1);
});
it("registra horários locais no fuso informado e recusa datas ambíguas sem gravar", async () => {
  const docente = await criarUsuario(["PROFESSOR"]);
  const input = { professorId: docente.id, inicioLocal: "2099-10-01T23:00", fimLocal: "2099-10-02T01:00", fusoOrigem: "America/Costa_Rica", motivo: "Ausência noturna planejada", chaveIdempotencia: "ausencia-local-teste" };
  const r = await solicitarIndisponibilidadeLocal(input);
  expect(r.ok).toBe(true);
  expect(await solicitarIndisponibilidadeLocal(input)).toEqual(r);
  const salva = await prisma.indisponibilidadeDocente.findFirstOrThrow();
  expect(salva.inicio.toISOString()).toBe("2099-10-02T05:00:00.000Z");
  expect(salva.fim.toISOString()).toBe("2099-10-02T07:00:00.000Z");
  expect((await solicitarIndisponibilidadeLocal({ ...input, inicioLocal: "2026-11-01T01:30", fimLocal: "2026-11-01T03:00", fusoOrigem: "America/New_York", chaveIdempotencia: "horario-ambiguo-teste" })).ok).toBe(false);
  expect((await solicitarIndisponibilidadeLocal({ ...input, fimLocal: "2099-10-01T22:00", chaveIdempotencia: "intervalo-invertido-teste" })).ok).toBe(false);
  expect(await prisma.indisponibilidadeDocente.count()).toBe(1);
});
it("lista ausências com escopo docente, paginação e pendências atuais sem apagar o histórico", async () => {
  const p1 = await criarUsuario(["PROFESSOR"]), p2 = await criarUsuario(["PROFESSOR"]), gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const solicitar = async (professorId: string) => {
    const r = await solicitarIndisponibilidadeDocente({ professorId, inicio: "2099-10-01T10:00:00Z", fim: "2099-10-01T12:00:00Z", fusoOrigem: "UTC", motivo: "Ausência para conferência", chaveIdempotencia: `ausencia-${professorId}` });
    if (!r.ok || !r.dado) throw new Error("Solicitação ausente");
    return r.dado.id;
  };
  const a1 = await solicitar(p1.id), a2 = await solicitar(p2.id);
  authMock.mockResolvedValue({ user: { id: p1.id } });
  const propria = await consultarIndisponibilidadesDocentes();
  expect(propria).toMatchObject({ ok: true, dado: { itens: [{ id: a1, podeDecidir: false }] } });
  if (!propria.ok || !propria.dado) throw new Error("Consulta ausente");
  expect(propria.dado.itens).toHaveLength(1);
  expect((await consultarIndisponibilidadesDocentes({ professorId: p2.id })).ok).toBe(false);
  const encontro = await prisma.encontroAgenda.create({ data: { matriculaId, professorId: p1.id, preparadorId: autorId, inicio: new Date("2099-10-01T10:00:00Z"), fim: new Date("2099-10-01T11:00:00Z"), status: "PREVISTO", fusoOrigem: "UTC", motivo: "Aula que exige solução", chaveIdempotencia: "encontro-ausencia-lista", entradaHash: "fixture" } });
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  const primeira = await consultarIndisponibilidadesDocentes({ limite: 1 });
  if (!primeira.ok || !primeira.dado?.proximoCursor) throw new Error("Cursor ausente");
  const segunda = await consultarIndisponibilidadesDocentes({ limite: 1, cursor: primeira.dado.proximoCursor });
  if (!segunda.ok || !segunda.dado) throw new Error("Página ausente");
  expect(new Set([...primeira.dado.itens, ...segunda.dado.itens].map((a) => a.id))).toEqual(new Set([a1, a2]));
  expect(await consultarIndisponibilidadesDocentes({ professorId: p1.id, situacao: "PENDENTE" })).toMatchObject({ ok: true, dado: { itens: [{ id: a1, encontrosParaConferencia: [{ id: encontro.id }], encontrosPendentes: [] }] } });
  expect((await decidirIndisponibilidadeDocente({ indisponibilidadeId: a1, impactoHash: await impactoAusenciaTeste(a1), aprovar: true, motivo: "Conferido pela gestão" })).ok).toBe(true);
  expect(await consultarIndisponibilidadesDocentes({ situacao: "APROVADA" })).toMatchObject({ ok: true, dado: { itens: [{ id: a1, encontrosPendentes: [{ id: encontro.id }] }] } });
  expect((await decidirIndisponibilidadeDocente({ indisponibilidadeId: a2, aprovar: false, motivo: "Proposta rejeitada após conferência" })).ok).toBe(true);
  expect(await consultarIndisponibilidadesDocentes({ situacao: "REJEITADA" })).toMatchObject({ ok: true, dado: { itens: [{ id: a2, encontrosParaConferencia: [], encontrosPendentes: [], podeDecidir: false }] } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "CANCELADO" } });
  expect(await consultarIndisponibilidadesDocentes({ situacao: "APROVADA" })).toMatchObject({ ok: true, dado: { itens: [{ id: a1, encontrosPendentes: [], decisao: { encontrosNaDecisao: [{ id: encontro.id }] } }] } });
  const financeiro = await criarUsuario(["FINANCEIRO"]); authMock.mockResolvedValue({ user: { id: financeiro.id } });
  expect((await consultarIndisponibilidadesDocentes()).ok).toBe(false);
});
it("gera prévia da turma pelos parâmetros do banco e calendário aprovado", async () => {
  const modalidade = await prisma.modalidade.findFirstOrThrow(), idioma = await prisma.idioma.findFirstOrThrow();
  await prisma.modalidade.update({ where: { id: modalidade.id }, data: { frequencia: "2x/semana", aulasPorNivel: 3, horasAula: 1.5 } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: idioma.id, codigo: "A1", ordem: 1 } });
  const docenteGrade = await criarUsuario(["PROFESSOR"]);
  const turma = await prisma.turma.create({ data: { modalidadeId: modalidade.id, nivelId: nivel.id, professorId: docenteGrade.id, diasSemana: [2, 4], horarioInicio: "19:00", dataInicio: new Date("2026-09-07") } });
  const input = { turmaId: turma.id, fusoOrigem: "America/Sao_Paulo" };
  expect((await preverGradeInicialTurma(input)).ok).toBe(false);
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
  const calendario = await prepararCalendarioEscolar({ fusoConferido: "America/Sao_Paulo", versaoAnterior: 0, motivo: "Calendário conferido para grade", chaveIdempotencia: "calendario-grade-teste", periodos: [{ id: "f1", nome: "Feriado", tipo: "FERIADO", inicio: "2026-09-08", fim: "2026-09-08" }] });
  if (!calendario.ok || !calendario.dado) throw new Error("Calendário ausente");
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]); authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect((await decidirCalendarioEscolar({ calendarioId: calendario.dado.id, aprovar: true, motivo: "Publicação do calendário inicial" })).ok).toBe(true);
  const grade = await preverGradeInicialTurma(input);
  expect(grade.ok, grade.ok ? undefined : grade.erro).toBe(true);
  if (!grade.ok || !grade.dado) throw new Error("Grade ausente");
  expect(grade.dado.grade.encontros.map((e) => e.dataOrigem)).toEqual(["2026-09-10", "2026-09-15", "2026-09-17"]);
  expect(grade.dado.origem).toMatchObject({ quantidadeAulas: 3, duracaoMinutos: 90 });
  expect(await prisma.encontroAgenda.count()).toBe(0);
  const preparar = { ...input, versaoAnterior: 0, motivo: "Grade inicial conferida", chaveIdempotencia: "grade-inicial-versao-1" };
  const salva = await prepararGradeInicialTurma(preparar);
  expect(salva).toMatchObject({ ok: true, dado: { versao: 1 } });
  expect(await prepararGradeInicialTurma(preparar)).toEqual(salva);
  expect((await prepararGradeInicialTurma({ ...preparar, chaveIdempotencia: "grade-concorrente-antiga" })).ok).toBe(false);
  const snapshot = await prisma.propostaGradeTurma.findFirstOrThrow();
  expect(snapshot.snapshot).toEqual(grade.dado);
  expect(await consultarPropostaGradeTurma({ propostaId: snapshot.id })).toMatchObject({ ok: true, dado: { parametrosCorrespondem: true, necessitaNovaProposta: false, publicacaoAutorizada: false } });
  const segundo = grade.dado.grade.encontros[1];
  const criarConflito = (chave: string, status: "PREVISTO" | "CANCELADO" | "RASCUNHO", inicio: Date, fim: Date) => prisma.encontroAgenda.create({ data: {
    matriculaId, professorId: docenteGrade.id, preparadorId: autorId, status, inicio, fim,
    fusoOrigem: "America/Sao_Paulo", motivo: "Conferência de disponibilidade docente", chaveIdempotencia: chave, entradaHash: chave,
  } });
  const conflito = await criarConflito("conflito-segundo-encontro", "PREVISTO", new Date(segundo.inicio), new Date(segundo.fim));
  await criarConflito("cancelado-na-grade", "CANCELADO", new Date(segundo.inicio), new Date(segundo.fim));
  await criarConflito("rascunho-na-grade", "RASCUNHO", new Date(segundo.inicio), new Date(segundo.fim));
  await criarConflito("consecutivo-na-grade", "PREVISTO", new Date(segundo.fim), new Date(Date.parse(segundo.fim) + 3600000));
  await criarConflito("mesmo-dia-semana-anterior", "PREVISTO", new Date("2026-09-01T22:00:00Z"), new Date("2026-09-01T23:30:00Z"));
  const disponibilidade = await consultarPropostaGradeTurma({ propostaId: snapshot.id });
  expect(disponibilidade).toMatchObject({ ok: true, dado: { disponibilidade: { professorApto: true, disponibilidadeConfirmada: false,
    conflitos: [{ indiceEncontro: 1, encontroExistenteId: conflito.id, professor: true, turma: false }], conflitosInternos: [] } } });
  if (!disponibilidade.ok || !disponibilidade.dado) throw new Error("Conferência ausente");
  expect(disponibilidade.dado.disponibilidade?.conflitos).toHaveLength(1);
  authMock.mockResolvedValue({ user: { id: docenteGrade.id } });
  const ausenciaInput = { professorId: docenteGrade.id, inicio: segundo.inicio, fim: segundo.fim, fusoOrigem: "America/Sao_Paulo", motivo: "Licença solicitada pelo professor", chaveIdempotencia: "licenca-docente-grade" };
  const ausencia = await solicitarIndisponibilidadeDocente(ausenciaInput);
  expect(ausencia.ok).toBe(true);
  expect(await solicitarIndisponibilidadeDocente(ausenciaInput)).toEqual(ausencia);
  expect((await solicitarIndisponibilidadeDocente({ ...ausenciaInput, professorId: gestor.id, chaveIdempotencia: "outro-professor-indevido" })).ok).toBe(false);
  if (!ausencia.ok || !ausencia.dado) throw new Error("Ausência não criada");
  await prisma.usuario.update({ where: { id: docenteGrade.id }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  const decidir = { indisponibilidadeId: ausencia.dado.id, impactoHash: await impactoAusenciaTeste(ausencia.dado.id), aprovar: true, motivo: "Licença conferida pela gestão" };
  expect((await decidirIndisponibilidadeDocente(decidir)).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect(await consultarPropostaGradeTurma({ propostaId: snapshot.id })).toMatchObject({ ok: true, dado: { disponibilidade: { indisponibilidades: [] } } });
  const aprovada = await decidirIndisponibilidadeDocente(decidir);
  expect(aprovada.ok).toBe(true);
  expect(await decidirIndisponibilidadeDocente(decidir)).toEqual(aprovada);
  expect(await consultarPropostaGradeTurma({ propostaId: snapshot.id })).toMatchObject({ ok: true, dado: { disponibilidade: { indisponibilidades: [{ indiceEncontro: 1, indisponibilidadeId: ausencia.dado.id }] } } });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: conflito.id } })).toEqual(conflito);
  expect(await consultarConflitosEncontro({ encontroId: conflito.id })).toMatchObject({ ok: true, dado: { indisponibilidades: [{ id: ausencia.dado.id }] } });
  const decisaoAusencia = await prisma.decisaoIndisponibilidadeDocente.findFirstOrThrow();
  expect(decisaoAusencia.encontrosAfetados).toEqual([{ id: conflito.id, inicio: segundo.inicio, fim: segundo.fim }]);
  await expect(prisma.indisponibilidadeDocente.update({ where: { id: ausencia.dado.id }, data: { motivo: "Alterar histórico" } })).rejects.toThrow();
  await expect(prisma.decisaoIndisponibilidadeDocente.delete({ where: { id: decisaoAusencia.id } })).rejects.toThrow();
  await prisma.usuario.update({ where: { id: docenteGrade.id }, data: { ativo: false } });
  expect(await consultarPropostaGradeTurma({ propostaId: snapshot.id })).toMatchObject({ ok: true, dado: { disponibilidade: { professorApto: false } } });
  await prisma.usuario.update({ where: { id: docenteGrade.id }, data: { ativo: true } });
  await prisma.modalidade.update({ where: { id: modalidade.id }, data: { aulasPorNivel: 4 } });
  expect(await consultarPropostaGradeTurma({ propostaId: snapshot.id })).toMatchObject({ ok: true, dado: { parametrosCorrespondem: false, necessitaNovaProposta: true, snapshot: grade.dado } });
  await prisma.modalidade.update({ where: { id: modalidade.id }, data: { aulasPorNivel: 3 } });
  expect((await prepararGradeInicialTurma({ ...preparar, versaoAnterior: 1, chaveIdempotencia: "grade-inicial-versao-2" })).ok).toBe(true);
  expect(await consultarPropostaGradeTurma({ propostaId: snapshot.id })).toMatchObject({ ok: true, dado: { parametrosCorrespondem: true, necessitaNovaProposta: true, versaoMaisRecente: 2 } });
  await expect(prisma.propostaGradeTurma.update({ where: { id: snapshot.id }, data: { snapshot: {} } })).rejects.toThrow();
  await expect(prisma.propostaGradeTurma.delete({ where: { id: snapshot.id } })).rejects.toThrow();
  expect(await prisma.encontroAgenda.count({ where: { turmaId: turma.id } })).toBe(0);
  await prisma.modalidade.update({ where: { id: modalidade.id }, data: { aulasPorNivel: null } });
  expect((await preverGradeInicialTurma(input)).ok).toBe(false);
  expect(await consultarPropostaGradeTurma({ propostaId: snapshot.id })).toMatchObject({ ok: true, dado: { parametrosCorrespondem: false, necessitaNovaProposta: true } });
  await prisma.modalidade.update({ where: { id: modalidade.id }, data: { aulasPorNivel: 3 } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO" } });
  expect((await preverGradeInicialTurma(input)).ok).toBe(false);
  const professor = await criarUsuario(["PROFESSOR"]);
  authMock.mockResolvedValue({ user: { id: professor.id } });
  expect((await consultarPropostaGradeTurma({ propostaId: snapshot.id })).ok).toBe(false);
});
it("prévia do calendário identifica interseções e preservação do passado sem remarcar", async () => {
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
  const proposta = await prepararCalendarioEscolar({ fusoConferido: "America/Sao_Paulo", versaoAnterior: 0, motivo: "Feriados propostos para conferência", chaveIdempotencia: "calendario-impactos-teste", periodos: [
    { id: "futuro", nome: "Feriado futuro", tipo: "FERIADO", inicio: "2099-10-02", fim: "2099-10-02" },
    { id: "passado", nome: "Data passada", tipo: "FERIADO", inicio: "2020-10-02", fim: "2020-10-02" },
  ] });
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta ausente");
  const docente = await criarUsuario(["PROFESSOR"]);
  const criar = (id: string, ano: string, status: "PREVISTO" | "CANCELADO") => prisma.encontroAgenda.create({ data: { matriculaId, professorId: docente.id, preparadorId: autorId, inicio: new Date(`${ano}-10-02T02:00:00Z`), fim: new Date(`${ano}-10-02T04:00:00Z`), fusoOrigem: "America/Sao_Paulo", status, motivo: "Encontro para revisão", chaveIdempotencia: id, entradaHash: id } });
  const futuro = await criar("futuro", "2099", "PREVISTO"), passado = await criar("passado", "2020", "PREVISTO");
  await criar("cancelado", "2099", "CANCELADO");
  const resultado = await preverImpactosCalendario({ calendarioId: proposta.dado.id });
  expect(resultado).toMatchObject({ ok: true, dado: { totalEncontros: 2, totalComIntersecao: 2, aplicada: false, revisaoCompleta: false } });
  if (!resultado.ok || !resultado.dado) throw new Error("Prévia ausente");
  expect(resultado.dado.encontros.find((e) => e.id === futuro.id)).toMatchObject({ preservarRegistro: false, periodosPropostos: ["futuro"] });
  expect(resultado.dado.encontros.find((e) => e.id === passado.id)).toMatchObject({ preservarRegistro: true, periodosPropostos: ["passado"] });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: futuro.id } })).toEqual(futuro);
  expect(await prisma.decisaoCalendarioEscolar.count()).toBe(0);
});
it("aprova calendário inicial por outra pessoa e bloqueia mudança com encontros publicados", async () => {
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["ADMINISTRADOR"] } });
  const d = { fusoConferido: "America/Sao_Paulo", versaoAnterior: 0, motivo: "Calendário inicial da escola", chaveIdempotencia: "calendario-aprovacao-teste", periodos: [] };
  const r = await prepararCalendarioEscolar(d); if (!r.ok || !r.dado) throw new Error("Proposta ausente");
  const decisao = { calendarioId: r.dado.id, aprovar: true, motivo: "Conferência independente do calendário" };
  expect((await decidirCalendarioEscolar(decisao)).ok).toBe(false);
  expect(await consultarCalendarioEscolarVigente()).toEqual({ ok: true, dado: null });
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]); authMock.mockResolvedValue({ user: { id: gestor.id } });
  const aprovado = await decidirCalendarioEscolar(decisao); expect(aprovado.ok).toBe(true);
  expect(await decidirCalendarioEscolar(decisao)).toEqual(aprovado);
  expect(await consultarCalendarioEscolarVigente()).toMatchObject({ ok: true, dado: { versao: 1 } });
  await expect(prisma.decisaoCalendarioEscolar.updateMany({ data: { aprovada: false } })).rejects.toThrow();
  authMock.mockResolvedValue({ user: { id: autorId } });
  expect(await prepararCalendarioEscolar(d)).toMatchObject({ ok: true, dado: { publicada: true } });
  const nova = await prepararCalendarioEscolar({ ...d, versaoAnterior: 1, chaveIdempotencia: "calendario-versao-dois" });
  if (!nova.ok || !nova.dado) throw new Error("Nova versão ausente");
  const docente = await criarUsuario(["PROFESSOR"]);
  await prisma.encontroAgenda.create({ data: { matriculaId, professorId: docente.id, preparadorId: autorId, inicio: new Date("2026-10-01T12:00:00Z"), fim: new Date("2026-10-01T13:00:00Z"), fusoOrigem: "America/Sao_Paulo", motivo: "Encontro publicado de teste", status: "PREVISTO", chaveIdempotencia: "encontro-publicado", entradaHash: "fixture" } });
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect((await decidirCalendarioEscolar({ ...decisao, calendarioId: nova.dado.id })).ok).toBe(false);
  expect((await decidirCalendarioEscolar({ ...decisao, calendarioId: nova.dado.id, aprovar: false })).ok).toBe(true);
  expect(await consultarCalendarioEscolarVigente()).toMatchObject({ ok: true, dado: { versao: 1 } });
});
it("preserva versões do calendário único sem publicar e normaliza ordem dos períodos", async () => {
  const d = { fusoConferido: "America/Sao_Paulo", versaoAnterior: 0, motivo: "Calendário institucional para revisão", chaveIdempotencia: "calendario-teste-chave", periodos: [
    { id: "feriado", nome: "Feriado escolar", tipo: "FERIADO" as const, inicio: "2026-10-12", fim: "2026-10-12" },
    { id: "recesso", nome: "Recesso escolar", tipo: "RECESSO" as const, inicio: "2026-12-20", fim: "2027-01-05" },
  ] };
  expect((await prepararCalendarioEscolar(d)).ok).toBe(false);
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
  const r = await prepararCalendarioEscolar(d); expect(r).toMatchObject({ ok: true, dado: { versao: 1, publicada: false } });
  expect(await prepararCalendarioEscolar({ ...d, periodos: [...d.periodos].reverse() })).toEqual(r);
  expect((await prepararCalendarioEscolar({ ...d, motivo: "Conteúdo alterado na mesma chave" })).ok).toBe(false);
  expect((await prepararCalendarioEscolar({ ...d, chaveIdempotencia: "calendario-nova-chave" })).ok).toBe(false);
  const v1 = await prisma.versaoCalendarioEscolar.findFirstOrThrow();
  expect(v1.fusoInstitucional).toBe("America/Sao_Paulo");
  await expect(prisma.versaoCalendarioEscolar.update({ where: { id: v1.id }, data: { periodos: [] } })).rejects.toThrow();
  await expect(prisma.versaoCalendarioEscolar.delete({ where: { id: v1.id } })).rejects.toThrow();
  expect(await prepararCalendarioEscolar({ ...d, versaoAnterior: 1, chaveIdempotencia: "calendario-segunda-versao", periodos: [] })).toMatchObject({ ok: true, dado: { versao: 2, publicada: false } });
  expect(await prisma.encontroAgenda.count()).toBe(0);
  expect((await prepararCalendarioEscolar({ ...d, versaoAnterior: 2, periodos: [d.periodos[0], d.periodos[0]] })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["FINANCEIRO"] } });
  expect((await prepararCalendarioEscolar({ ...d, versaoAnterior: 2, chaveIdempotencia: "calendario-proibido" })).ok).toBe(false);
});
it("consulta sobreposição real, ignora rascunhos/cancelados e aceita horários consecutivos", async () => {
  const docente = await criarUsuario(["PROFESSOR"]);
  const r = await prepararEncontroAgenda({ ...entrada(), professorId: docente.id });
  if (!r.ok || !r.dado) throw new Error("Rascunho ausente");
  const e = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: r.dado.id } });
  const criar = (chave: string, status: "PREVISTO" | "RASCUNHO" | "CANCELADO", inicio = e.inicio, fim = e.fim) => prisma.encontroAgenda.create({ data: { matriculaId, professorId: docente.id, preparadorId: autorId, inicio, fim, fusoOrigem: e.fusoOrigem, motivo: "Encontro para conferência", chaveIdempotencia: chave, entradaHash: chave, status } });
  const conflito = await criar("conflito", "PREVISTO");
  await criar("rascunho", "RASCUNHO"); await criar("cancelado", "CANCELADO");
  await criar("consecutivo", "PREVISTO", e.fim, new Date(e.fim.getTime() + 3600000));
  const c = await consultarConflitosEncontro({ encontroId: e.id });
  expect(c).toMatchObject({ ok: true, dado: { conflitos: [{ id: conflito.id, professor: true, matricula: true }], publicacaoAutorizada: false } });
  if (!c.ok || !c.dado) throw new Error("Consulta ausente");
  expect(c.dado.conflitos).toHaveLength(1);
  authMock.mockResolvedValue({ user: { id: docente.id } });
  expect((await consultarConflitosEncontro({ encontroId: e.id })).ok).toBe(false);
});
it("guarda encontro atravessando meia-noite como rascunho e não cria efeitos financeiros", async () => {
  const r = await prepararEncontroAgenda(entrada()); expect(r.ok, r.ok ? undefined : r.erro).toBe(true);
  expect(await prepararEncontroAgenda(entrada())).toEqual(r);
  const e = await prisma.encontroAgenda.findFirstOrThrow();
  expect(e.status).toBe("RASCUNHO"); expect(e.professorId).toBeNull();
  expect(e.inicio.toISOString()).toBe("2026-10-02T02:00:00.000Z"); expect(e.fim.toISOString()).toBe("2026-10-02T04:00:00.000Z");
  expect(await prisma.cobranca.count()).toBe(0);
  expect((await prepararEncontroAgenda({ ...entrada(), motivo: "Outra proposta de encontro" })).ok).toBe(false);
  await expect(prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "PREVISTO" } })).rejects.toThrow();
});
it("rejeita vínculo misto, horário inválido, professor inativo e papel financeiro", async () => {
  expect((await prepararEncontroAgenda({ ...entrada(), turmaId: "turma" })).ok).toBe(false);
  expect((await prepararEncontroAgenda({ ...entrada(), fim: entrada().inicio })).ok).toBe(false);
  expect((await prepararEncontroAgenda({ ...entrada(), professorId: autorId })).ok).toBe(false);
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["FINANCEIRO"] } });
  expect((await prepararEncontroAgenda(entrada())).ok).toBe(false);
  expect(await prisma.encontroAgenda.count()).toBe(0);
});

it("publica grade inteira após aprovação independente e revalidação de disponibilidade", async () => {
  const modalidade = await prisma.modalidade.findFirstOrThrow(), idioma = await prisma.idioma.findFirstOrThrow();
  await prisma.modalidade.update({ where: { id: modalidade.id }, data: { frequencia: "2x/semana", aulasPorNivel: 3, horasAula: 1 } });
  const nivel = await prisma.nivel.create({ data: { idiomaId: idioma.id, codigo: "PUBLICAR", ordem: 1 } });
  const professor = await criarUsuario(["PROFESSOR"]), gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  const cal = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 0, periodos: [], motivo: "Calendário para publicação", chaveIdempotencia: "calendario-publicacao" });
  if (!cal.ok || !cal.dado) throw new Error("Calendário ausente");
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect((await decidirCalendarioEscolar({ calendarioId: cal.dado.id, aprovar: true, motivo: "Calendário conferido" })).ok).toBe(true);
  const turma = await prisma.turma.create({ data: { modalidadeId: modalidade.id, nivelId: nivel.id, professorId: professor.id,
    diasSemana: [2, 4], horarioInicio: "19:00", dataInicio: new Date("2099-10-01") } });
  authMock.mockResolvedValue({ user: { id: autorId } });
  const p = await prepararGradeInicialTurma({ turmaId: turma.id, fusoOrigem: "UTC", versaoAnterior: 0,
    motivo: "Publicação inicial revisada", chaveIdempotencia: "grade-para-publicar" });
  if (!p.ok || !p.dado) throw new Error("Grade ausente");
  const d = { propostaId: p.dado.id, aprovar: true, motivo: "Conjunto revisado por outra pessoa" };
  expect(await consultarPropostaGradeTurma({ propostaId: p.dado.id })).toMatchObject({ ok: true, dado: { podeDecidir: false,
    fusoOrigem: "UTC", exibicao: { origem: { quantidadeAulas: 3, duracaoMinutos: 60 } } } });
  authMock.mockResolvedValue({ user: { id: professor.id } });
  expect((await consultarPropostaGradeTurma({ propostaId: p.dado.id })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: autorId } });
  await prisma.usuario.update({ where: { id: autorId }, data: { papeis: ["ADMINISTRADOR"] } });
  expect(await decidirGradeInicialTurma(d)).toMatchObject({ ok: false, erro: expect.stringContaining("Outra pessoa") });
  const previa = await preverGradeInicialTurma({ turmaId: turma.id, fusoOrigem: "UTC" });
  if (!previa.ok || !previa.dado) throw new Error("Prévia ausente");
  const primeiro = previa.dado.grade.encontros[0];
  const conflito = await prisma.encontroAgenda.create({ data: { matriculaId, professorId: professor.id, preparadorId: autorId,
    inicio: new Date(primeiro.inicio), fim: new Date(primeiro.fim), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Ocupação posterior à proposta", chaveIdempotencia: "conflito-publicacao", entradaHash: "fixture" } });
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect(await consultarPropostaGradeTurma({ propostaId: p.dado.id })).toMatchObject({ ok: true, dado: { podeDecidir: true } });
  expect(await decidirGradeInicialTurma(d)).toMatchObject({ ok: false, erro: expect.stringContaining("conflitos") });
  expect(await prisma.encontroAgenda.count({ where: { turmaId: turma.id } })).toBe(0);
  expect(await prisma.decisaoGradeTurma.count()).toBe(0);
  await prisma.encontroAgenda.update({ where: { id: conflito.id }, data: { status: "CANCELADO" } });
  await prisma.modalidade.update({ where: { id: modalidade.id }, data: { aulasPorNivel: 4 } });
  expect(await decidirGradeInicialTurma(d)).toMatchObject({ ok: false, erro: expect.stringContaining("parâmetros") });
  await prisma.modalidade.update({ where: { id: modalidade.id }, data: { aulasPorNivel: 3 } });
  await prisma.usuario.update({ where: { id: professor.id }, data: { ativo: false } });
  expect(await decidirGradeInicialTurma(d)).toMatchObject({ ok: false, erro: expect.stringContaining("indisponibilidade") });
  await prisma.usuario.update({ where: { id: professor.id }, data: { ativo: true } });
  expect(await prisma.encontroAgenda.count({ where: { turmaId: turma.id } })).toBe(0);
  const resultado = await decidirGradeInicialTurma(d);
  expect(resultado).toMatchObject({ ok: true, dado: { publicada: true } });
  expect(await decidirGradeInicialTurma(d)).toEqual(resultado);
  const publicados = await prisma.encontroAgenda.findMany({ where: { propostaGradeId: p.dado.id }, orderBy: { inicio: "asc" } });
  expect(publicados).toHaveLength(3);
  const gradeOfertaId = p.dado.id;
  const rollbackOferta = new Error("Rollback fixture Q161");
  await expect(prisma.$transaction(async tx => {
  // Q161: fonte publicada real, vinculada ao contrato, sem emissão.
  const { carregarComprovacaoOfertaContinuidadeAgendaTx } = await import("@/server/matricula/oferta-continuidade-agenda-tx");
  const consultarOferta = (id: string) => carregarComprovacaoOfertaContinuidadeAgendaTx(tx, {
    matriculaId: id, inicio: new Date("2099-10-02T00:00:00Z"), fim: new Date("2099-10-06T00:00:00Z"),
  });
  expect(await consultarOferta(matriculaId)).toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO" });
  const matriculaOferta = await tx.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  await tx.turma.update({ where: { id: turma.id }, data: { status: "ABERTA" } });
  await tx.alocacaoTurma.create({ data: { matriculaId, alunoId: matriculaOferta.alunoId, turmaId: turma.id, criadoEm: new Date("2099-09-01T00:00:00Z") } });
  expect(await consultarOferta(matriculaId)).toMatchObject({ estado: "COMPROVADA_POR_AGENDA", memoria: { fontes: [{ turmaId: turma.id, gradeId: gradeOfertaId }] } });
  expect(await consultarOferta("outra-matricula-sem-vinculo")).toMatchObject({ estado: "EXIGE_CONFIRMACAO_GESTAO" });

    throw rollbackOferta;
  })).rejects.toBe(rollbackOferta);
  expect(publicados.map((e) => ({ inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })))
    .toEqual(previa.dado.grade.encontros.map((e) => ({ inicio: e.inicio, fim: e.fim })));
  expect(publicados.every((e) => e.status === "PREVISTO" && e.professorId === professor.id && e.preparadorId === autorId)).toBe(true);
  expect(await consultarPropostaGradeTurma({ propostaId: p.dado.id })).toMatchObject({ ok: true, dado: { publicada: true, podeDecidir: false, necessitaNovaProposta: false, decisao: { decisorId: gestor.id } } });
  expect((await decidirGradeInicialTurma({ ...d, aprovar: false })).ok).toBe(false);
  await expect(prisma.decisaoGradeTurma.updateMany({ data: { motivo: "Tentativa de reescrever decisão" } })).rejects.toThrow();
  const novoCalendario = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 1, motivo: "Feriado após publicar a grade", chaveIdempotencia: "feriado-replanejamento",
    periodos: [{ id: "novo", nome: "Feriado novo", tipo: "FERIADO", inicio: primeiro.inicio.slice(0, 10), fim: primeiro.inicio.slice(0, 10) }] });
  if (!novoCalendario.ok || !novoCalendario.dado) throw new Error("Calendário ausente");
  const revisao = await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id });
  expect(revisao).toMatchObject({ ok: true, dado: { aplicada: false, revisoes: [{ turmaId: turma.id, pendencias: [], previsao: { propostas: expect.any(Array) } }] } });
  if (!revisao.ok || !revisao.dado) throw new Error("Revisão ausente");
  expect(revisao.dado.revisoes[0].previsao?.propostas).toHaveLength(3);
  expect(revisao.dado.recursos).toMatchObject({ internos: [], externos: [], indisponibilidades: [], semDocenteApto: [] });
  const remarcado = revisao.dado.revisoes[0].previsao!.propostas[0];
  const particular = await prisma.encontroAgenda.create({ data: { matriculaId, professorId: professor.id, preparadorId: autorId,
    inicio: new Date(remarcado.inicioProposto), fim: new Date(remarcado.fimProposto), status: "PREVISTO", fusoOrigem: "UTC",
    motivo: "Particular conflitando com proposta", chaveIdempotencia: "particular-replanejamento", entradaHash: "fixture" } });
  const comConflito = await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id });
  expect(comConflito).toMatchObject({ ok: true, dado: { recursos: { externos: expect.arrayContaining([{ encontroPropostoId: remarcado.encontroId, encontroExistenteId: particular.id }]) } } });
  const ajustes = [{ encontroId: remarcado.encontroId, data: "2099-12-20", horario: "10:00", motivo: "Evitar conflito identificado na revisão" }];
  const ajustada = await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id, ajustes });
  expect(ajustada).toMatchObject({ ok: true, dado: { ajustes, recursos: { externos: [] } } });
  if (!ajustada.ok || !ajustada.dado) throw new Error("Revisão ajustada ausente");
  const propostaReservada = ajustada.dado.revisoes[0].previsao!.propostas.find((p) => p.encontroId === remarcado.encontroId)!;
  const reservaParticular = await prisma.reservaAgendaParticular.create({ data: { matriculaId, preparadorId: autorId, status: "ATIVA", criadaEm: new Date("2019-01-01T00:00:00Z"), expiraEm: new Date("2100-01-01T00:00:00Z"), motivo: "Reserva contratada ainda vigente", chaveIdempotencia: "reserva-replanejamento", entradaHash: "fixture", snapshot: { professorId: professor.id, fusoOrigem: "UTC", encontros: [{ inicio: propostaReservada.inicioProposto, fim: propostaReservada.fimProposto }] } } });
  await prisma.horarioReservaParticular.create({ data: { reservaId: reservaParticular.id, professorId: professor.id, inicio: new Date(propostaReservada.inicioProposto), fim: new Date(propostaReservada.fimProposto), fusoOrigem: "UTC" } });
  expect(await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id, ajustes })).toMatchObject({ ok: true, dado: { recursos: { reservas: [expect.objectContaining({ reservaId: reservaParticular.id })] } } });
  await prisma.reservaAgendaParticular.update({ where: { id: reservaParticular.id }, data: { status: "MANTIDA_PENDENCIA", expiraEm: new Date("2020-01-01T00:00:00Z") } });
  expect(await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id, ajustes })).toMatchObject({ ok: true, dado: { recursos: { reservas: [expect.objectContaining({ reservaId: reservaParticular.id })] } } });
  await prisma.reservaAgendaParticular.update({ where: { id: reservaParticular.id }, data: { status: "LIBERADA" } });
  expect(await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id, ajustes })).toMatchObject({ ok: true, dado: { recursos: { reservas: [] } } });
  expect(ajustada.dado.revisoes[0].previsao?.propostas[0].inicioProposto).toBe("2099-12-20T10:00:00.000Z");
  expect((await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id, ajustes: [{ ...ajustes[0], encontroId: particular.id }] })).ok).toBe(false);
  const registroAntigo = { calendarioId: novoCalendario.dado.id, estadoHash: revisao.dado.estadoHash, versaoAnterior: 0, motivo: "Guardar conjunto conferido", chaveIdempotencia: "rascunho-conjunto" };
  expect(await registrarRascunhoReplanejamento(registroAntigo)).toMatchObject({ ok: false, erro: expect.stringContaining("agenda mudou") });
  expect(await prisma.rascunhoReplanejamento.count()).toBe(0);
  if (!comConflito.ok || !comConflito.dado) throw new Error("Revisão com conflito ausente");
  const registro = { ...registroAntigo, estadoHash: comConflito.dado.estadoHash };
  const salvo = await registrarRascunhoReplanejamento(registro);
  expect(salvo).toMatchObject({ ok: true, dado: { versao: 1, aplicada: false } });
  expect(await registrarRascunhoReplanejamento(registro)).toEqual(salvo);
  expect((await registrarRascunhoReplanejamento({ ...registro, chaveIdempotencia: "rascunho-outro-envio" })).ok).toBe(false);
  expect(await prisma.rascunhoReplanejamento.count()).toBe(1);
  const historico = await consultarHistoricoReplanejamento({ calendarioId: novoCalendario.dado.id });
  expect(historico).toMatchObject({ ok: true, dado: { pagina: 1, possuiMais: false, registros: [{ versao: 1, motivo: registro.motivo }] } });
  if (!historico.ok || !historico.dado) throw new Error("Histórico ausente");
  expect(historico.dado.registros[0]).not.toHaveProperty("snapshot");
  if (!salvo.ok || !salvo.dado) throw new Error("Registro ausente");
  expect(await conferirRevisaoParaDecisao({ calendarioId: novoCalendario.dado.id, revisaoId: salvo.dado.id })).toMatchObject({ ok: true, dado: { estadoCorresponde: true, independente: false, aprovacaoDisponivel: false, motivos: expect.arrayContaining([expect.stringContaining("Outra pessoa"), expect.stringContaining("conflitos")]) } });
  const detalhe = await consultarRevisaoReplanejamento({ calendarioId: novoCalendario.dado.id, revisaoId: salvo.dado.id });
  expect(detalhe).toMatchObject({ ok: true, dado: { versao: 1, snapshot: { revisoes: [{ previsao: { propostas: comConflito.dado.revisoes[0].previsao!.propostas } }] } } });
  await prisma.encontroAgenda.update({ where: { id: particular.id }, data: { inicio: new Date("2100-01-01T12:00:00Z"), fim: new Date("2100-01-01T13:00:00Z") } });
  expect(await consultarRevisaoReplanejamento({ calendarioId: novoCalendario.dado.id, revisaoId: salvo.dado.id })).toEqual(detalhe);
  expect(await conferirRevisaoParaDecisao({ calendarioId: novoCalendario.dado.id, revisaoId: salvo.dado.id })).toMatchObject({ ok: true, dado: { estadoCorresponde: false } });

  expect(historico.dado.registros[0]).not.toHaveProperty("entradaHash");
  expect(await consultarHistoricoReplanejamento({ calendarioId: novoCalendario.dado.id, pagina: 2 })).toMatchObject({ ok: true, dado: { registros: [], possuiMais: false } });
  expect((await consultarHistoricoReplanejamento({ calendarioId: novoCalendario.dado.id, pagina: 0 })).ok).toBe(false);
  const outroCalendario = await prisma.versaoCalendarioEscolar.findFirstOrThrow({ where: { id: { not: novoCalendario.dado.id } } });
  expect(await consultarHistoricoReplanejamento({ calendarioId: outroCalendario.id })).toMatchObject({ ok: true, dado: { registros: [] } });
  expect((await consultarRevisaoReplanejamento({ calendarioId: outroCalendario.id, revisaoId: salvo.dado.id })).ok).toBe(false);
  expect((await conferirRevisaoParaDecisao({ calendarioId: outroCalendario.id, revisaoId: salvo.dado.id })).ok).toBe(false);

  await expect(prisma.rascunhoReplanejamento.updateMany({ data: { motivo: "Alteração indevida do registro" } })).rejects.toThrow();
  const previaAjustadaAtual = await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id, ajustes });
  if (!previaAjustadaAtual.ok || !previaAjustadaAtual.dado) throw new Error("Prévia ajustada ausente");
  expect((await registrarRascunhoReplanejamento({ ...registro, versaoAnterior: 1, estadoHash: previaAjustadaAtual.dado.estadoHash, chaveIdempotencia: "ajuste-sem-dados" })).ok).toBe(false);
  const ajusteSalvo = await registrarRascunhoReplanejamento({ ...registro, ajustes, versaoAnterior: 1, estadoHash: previaAjustadaAtual.dado.estadoHash, chaveIdempotencia: "ajuste-com-dados" });
  expect(ajusteSalvo).toMatchObject({ ok: true, dado: { versao: 2, aplicada: false } });
  if (!ajusteSalvo.ok || !ajusteSalvo.dado) throw new Error("Ajuste salvo ausente");
  expect(await consultarRevisaoReplanejamento({ calendarioId: novoCalendario.dado.id, revisaoId: ajusteSalvo.dado.id })).toMatchObject({ ok: true, dado: { snapshot: { revisoes: [{ previsao: { propostas: expect.arrayContaining([expect.objectContaining({ motivoAjuste: ajustes[0].motivo })]) } }] } } });

  const excecaoAjustes = [{ ...ajustes[0], data: primeiro.inicio.slice(0, 10), horario: "19:00", motivo: "Propor encontro específico no feriado" }];
  const previaExcecao = await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id, ajustes: excecaoAjustes });
  if (!previaExcecao.ok || !previaExcecao.dado) throw new Error("Exceção ausente");
  const excecaoSalva = await registrarRascunhoReplanejamento({ ...registro, ajustes: excecaoAjustes, versaoAnterior: 2, estadoHash: previaExcecao.dado.estadoHash, chaveIdempotencia: "ajuste-com-excecao" });
  if (!excecaoSalva.ok || !excecaoSalva.dado) throw new Error("Exceção não registrada");
  const rascunhoExcecaoId = excecaoSalva.dado.id;
  const estadoHashExcecao = previaExcecao.dado.estadoHash;
  const gestorIndependente = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  authMock.mockResolvedValue({ user: { id: gestorIndependente.id } });
  const rascunhoExcecao = await prisma.rascunhoReplanejamento.findUniqueOrThrow({ where: { id: rascunhoExcecaoId }, select: { preparadorId: true } });
  await expect(prisma.decisaoReplanejamentoConjunto.create({ data: { rascunhoId: rascunhoExcecaoId, decisorId: rascunhoExcecao.preparadorId, aprovada: true, motivo: "Autoaprovação direta indevida", estadoHash: estadoHashExcecao, excecoesAutorizadas: [remarcado.encontroId] } })).rejects.toThrow();
  await expect(prisma.$transaction(async (tx) => {
    const decisaoDireta = await tx.decisaoReplanejamentoConjunto.create({ data: { rascunhoId: rascunhoExcecaoId, decisorId: gestorIndependente.id, aprovada: true, motivo: "Decisão direta sem efeitos materiais", estadoHash: estadoHashExcecao, excecoesAutorizadas: [remarcado.encontroId] } });
    await tx.aplicacaoReplanejamentoConjunto.create({ data: { rascunhoId: rascunhoExcecaoId, decisaoId: decisaoDireta.id, estadoHash: estadoHashExcecao } });
    await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
  })).rejects.toThrow("Aplicação conjunta exige calendário publicado");
  expect(await prisma.decisaoReplanejamentoConjunto.count()).toBe(0);
  expect(await conferirRevisaoParaDecisao({ calendarioId: novoCalendario.dado.id, revisaoId: excecaoSalva.dado.id })).toMatchObject({ ok: true, dado: {
    estadoCorresponde: true, independente: true, papelDecisor: true, aprovacaoDisponivel: true,
    excecoes: [expect.objectContaining({ encontroId: remarcado.encontroId, periodos: ["novo"], motivoProposto: excecaoAjustes[0].motivo })],
    motivos: [],
  } });
  expect(await decidirEAplicarReplanejamentoConjunto({ calendarioId: novoCalendario.dado.id, revisaoId: excecaoSalva.dado.id, aprovar: true, motivo: "Aprovar conjunto com exceção justificada" })).toMatchObject({ ok: false, erro: expect.stringContaining("autorização explícita") });
  const entradaDecisao = { calendarioId: novoCalendario.dado.id, revisaoId: excecaoSalva.dado.id, aprovar: true, motivo: "Aprovar conjunto com exceção justificada", excecoesAutorizadas: [remarcado.encontroId] };
  const aplicada = await decidirEAplicarReplanejamentoConjunto(entradaDecisao);
  expect(aplicada).toMatchObject({ ok: true, dado: { aprovada: true, aplicada: true } });
  expect(await decidirEAplicarReplanejamentoConjunto(entradaDecisao)).toEqual(aplicada);
  expect(await prisma.aplicacaoReplanejamentoConjunto.count()).toBe(1);
  expect(await consultarCalendarioEscolarVigente()).toMatchObject({ ok: true, dado: { id: novoCalendario.dado.id } });
  expect(await conferirRevisaoParaDecisao({ calendarioId: novoCalendario.dado.id, revisaoId: salvo.dado.id })).toMatchObject({ ok: true, dado: { motivos: expect.arrayContaining([expect.stringContaining("mais recente")]) } });
  expect(revisao.dado.revisoes[0].previsao?.propostas[0].inicioProposto).not.toBe(primeiro.inicio);
  const aposAplicacao = await prisma.encontroAgenda.findMany({ where: { propostaGradeId: p.dado.id }, orderBy: { id: "asc" } });
  expect(aposAplicacao.map((e) => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() }))).toEqual(previaExcecao.dado.revisoes.flatMap((t) => t.previsao?.propostas ?? []).sort((a, b) => a.encontroId.localeCompare(b.encontroId)).map((p) => ({ id: p.encontroId, inicio: p.inicioProposto, fim: p.fimProposto })));
  authMock.mockResolvedValue({ user: { id: professor.id } });
  expect((await preverReplanejamentoCalendario({ calendarioId: novoCalendario.dado.id })).ok).toBe(false);
  expect((await consultarHistoricoReplanejamento({ calendarioId: novoCalendario.dado.id })).ok).toBe(false);
  expect((await consultarRevisaoReplanejamento({ calendarioId: novoCalendario.dado.id, revisaoId: salvo.dado.id })).ok).toBe(false);
  expect((await conferirRevisaoParaDecisao({ calendarioId: novoCalendario.dado.id, revisaoId: salvo.dado.id })).ok).toBe(false);
});

it("inicia turma no primeiro encontro válido sem presumir aula ministrada ou duplicar evento", async () => {
  const modalidade = await prisma.modalidade.findFirstOrThrow(), idioma = await prisma.idioma.findFirstOrThrow();
  const nivel = await prisma.nivel.create({ data: { idiomaId: idioma.id, codigo: "INICIO", ordem: 1 } });
  const professor = await criarUsuario(["PROFESSOR"]);
  const turma = await prisma.turma.create({ data: { modalidadeId: modalidade.id, nivelId: nivel.id, professorId: professor.id } });
  const criar = (status: "PREVISTO" | "CANCELADO" | "RASCUNHO", dia: string) => prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professor.id, preparadorId: autorId, inicio: new Date(`${dia}T13:00:00Z`), fim: new Date(`${dia}T14:00:00Z`),
    fusoOrigem: "UTC", status, motivo: "Teste de início automático", chaveIdempotencia: `inicio-${status}`, entradaHash: "fixture" } });
  await criar("CANCELADO", "2099-01-01");
  await criar("RASCUNHO", "2099-01-02");
  const encontro = await criar("PREVISTO", "2099-01-03");
  expect(await iniciarTurmasDaAgenda(new Date(encontro.inicio.getTime() - 1))).toMatchObject({ iniciadas: 0 });
  expect(await iniciarTurmasDaAgenda(encontro.inicio)).toMatchObject({ iniciadas: 1 });
  expect(await iniciarTurmasDaAgenda(encontro.fim)).toMatchObject({ iniciadas: 0 });
  expect(await prisma.turma.findUniqueOrThrow({ where: { id: turma.id } })).toMatchObject({ status: "EM_ANDAMENTO" });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontro.id } })).toEqual(encontro);
  const eventos = await prisma.evento.findMany({ where: { agregadoId: turma.id } });
  expect(eventos).toHaveLength(1);
  expect(eventos[0]).toMatchObject({ autorId: null, tipo: "TurmaEmAndamento", payload: { encontroId: encontro.id, inicioEfetivo: encontro.inicio.toISOString() } });
  expect(await prisma.aulaDiario.count()).toBe(0);
  expect(await prisma.cobranca.count()).toBe(0);
});

it("recusa preparação com fuso diferente do conferido e preserva repetição após mudança posterior", async () => {
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Sao_Paulo" } });
  const d = { fusoConferido: "UTC", versaoAnterior: 0, periodos: [], motivo: "Calendário conferido pela equipe", chaveIdempotencia: "fuso-calendario-conferido" };
  expect(await prepararCalendarioEscolar(d)).toMatchObject({ ok: false, erro: expect.stringContaining("fuso institucional mudou") });
  expect(await prisma.versaoCalendarioEscolar.count()).toBe(0);
  const entrada = { ...d, fusoConferido: "America/Sao_Paulo" };
  const r = await prepararCalendarioEscolar(entrada);
  expect(r).toMatchObject({ ok: true, dado: { versao: 1 } });
  await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: "UTC" } });
  expect(await prepararCalendarioEscolar(entrada)).toEqual(r);
  expect(await prisma.versaoCalendarioEscolar.count()).toBe(1);
  if (!r.ok || !r.dado) throw new Error("Proposta ausente");
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]); authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect(await decidirCalendarioEscolar({ calendarioId: r.dado.id, aprovar: true, motivo: "Conferência após mudança" })).toMatchObject({ ok: false, erro: expect.stringContaining("fuso da escola mudou") });
});

it("aplica duas turmas como conjunto e reverte tudo se uma delas mudar depois da fotografia", async () => {
  const modalidade = await prisma.modalidade.findFirstOrThrow(), idioma = await prisma.idioma.findFirstOrThrow();
  await prisma.modalidade.update({ where: { id: modalidade.id }, data: { frequencia: "1x/semana", aulasPorNivel: 2, horasAula: 1 } });
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  const preparador = await criarUsuario(["SECRETARIA_ACADEMICA"]), gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]);
  const base = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 0, periodos: [], motivo: "Calendário base para conjunto", chaveIdempotencia: "conjunto-base" });
  if (!base.ok || !base.dado) throw new Error("Calendário base ausente");
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect((await decidirCalendarioEscolar({ calendarioId: base.dado.id, aprovar: true, motivo: "Publicar calendário base" })).ok).toBe(true);
  const publicar = async (codigo: string, chave: string) => {
    const professor = await criarUsuario(["PROFESSOR"]), nivel = await prisma.nivel.create({ data: { idiomaId: idioma.id, codigo, ordem: Math.floor(Math.random() * 100000) } });
    const turma = await prisma.turma.create({ data: { modalidadeId: modalidade.id, nivelId: nivel.id, professorId: professor.id, diasSemana: [4], horarioInicio: "19:00", dataInicio: new Date("2099-10-01T00:00:00Z") } });
    authMock.mockResolvedValue({ user: { id: preparador.id } });
    const proposta = await prepararGradeInicialTurma({ turmaId: turma.id, fusoOrigem: "UTC", versaoAnterior: 0, motivo: `Publicar ${codigo}`, chaveIdempotencia: chave });
    if (!proposta.ok || !proposta.dado) throw new Error("Proposta de turma ausente");
    authMock.mockResolvedValue({ user: { id: gestor.id } });
    expect((await decidirGradeInicialTurma({ propostaId: proposta.dado.id, aprovar: true, motivo: `Aprovar ${codigo}` })).ok).toBe(true);
    return turma;
  };
  const turmaA = await publicar("CONJUNTO_A", "conjunto-grade-a"), turmaB = await publicar("CONJUNTO_B", "conjunto-grade-b");
  const primeiro = await prisma.encontroAgenda.findFirstOrThrow({ where: { turmaId: turmaA.id }, orderBy: { inicio: "asc" } });
  authMock.mockResolvedValue({ user: { id: preparador.id } });
  const calendario = await prepararCalendarioEscolar({ fusoConferido: "UTC", versaoAnterior: 1, motivo: "Feriado para duas turmas", chaveIdempotencia: "conjunto-feriado", periodos: [{ id: "feriado-conjunto", nome: "Feriado conjunto", tipo: "FERIADO", inicio: primeiro.inicio.toISOString().slice(0, 10), fim: primeiro.inicio.toISOString().slice(0, 10) }] });
  if (!calendario.ok || !calendario.dado) throw new Error("Calendário conjunto ausente");
  const previa = await preverReplanejamentoCalendario({ calendarioId: calendario.dado.id });
  if (!previa.ok || !previa.dado) throw new Error("Prévia conjunta ausente");
  expect(previa.dado.revisoes.filter((r) => r.turmaId === turmaA.id || r.turmaId === turmaB.id)).toHaveLength(2);
  const registro = await registrarRascunhoReplanejamento({ calendarioId: calendario.dado.id, estadoHash: previa.dado.estadoHash, versaoAnterior: 0, motivo: "Guardar conjunto de duas turmas", chaveIdempotencia: "conjunto-rascunho" });
  if (!registro.ok || !registro.dado) throw new Error("Rascunho conjunto ausente");
  const antes = await prisma.encontroAgenda.findMany({ where: { turmaId: { in: [turmaA.id, turmaB.id] } }, orderBy: { id: "asc" } });
  await prisma.encontroAgenda.update({ where: { id: antes.find((e) => e.turmaId === turmaB.id)!.id }, data: { inicio: new Date("2099-12-31T19:00:00Z"), fim: new Date("2099-12-31T20:00:00Z") } });
  authMock.mockResolvedValue({ user: { id: gestor.id } });
  expect(await decidirEAplicarReplanejamentoConjunto({ calendarioId: calendario.dado.id, revisaoId: registro.dado.id, aprovar: true, motivo: "Aplicar duas turmas" })).toMatchObject({ ok: false, erro: expect.stringContaining("mudaram") });
  const depoisFalha = await prisma.encontroAgenda.findMany({ where: { turmaId: { in: [turmaA.id, turmaB.id] } }, orderBy: { id: "asc" } });
  const alteradoPosteriormente = antes.find((e) => e.turmaId === turmaB.id)!;
  expect(depoisFalha.filter((e) => e.id !== alteradoPosteriormente.id).map((e) => ({ id: e.id, inicio: e.inicio, fim: e.fim }))).toEqual(antes.filter((e) => e.id !== alteradoPosteriormente.id).map((e) => ({ id: e.id, inicio: e.inicio, fim: e.fim })));
  expect(await prisma.aplicacaoReplanejamentoConjunto.count()).toBe(0);
});

async function impactoAusenciaTeste(id: string) {
  const r = await consultarIndisponibilidadesDocentes({ limite: 100 });
  if (!r.ok) throw new Error(r.erro);
  const hash = r.dado?.itens.find((a) => a.id === id)?.impactoHash;
  if (!hash) throw new Error("Impacto não disponível");
  return hash;
}
