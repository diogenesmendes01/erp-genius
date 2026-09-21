import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma, type StatusTurma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { editarTurma, alterarStatusTurma } from "./acoes";
import type { TurmaInput } from "./schema";
import type { Resultado } from "@/server/_shared";

const DIA = 86_400_000;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const inicio = () => new Date(Date.now() - 10 * DIA);
const fim = () => new Date(Date.now() + 30 * DIA);

async function cenario() {
  const cat = await seedCatalogoMinimo();
  const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão pedagógica");
  const professor = await criarUsuario([Papel.PROFESSOR], "Professor atual");
  const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
  const outroNivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A2", ordem: 2 } });
  const outraModalidade = await prisma.modalidade.create({ data: { nome: "Intensiva", frequencia: "2x/semana", duracaoPorNivel: "2 meses" } });
  const turma = await prisma.turma.create({ data: {
    modalidadeId: cat.modalidade.id, nivelId: nivel.id, professorId: professor.id, status: "EM_ANDAMENTO", capacidade: 3,
    diasSemana: [1, 3], horarioInicio: "19:00", horarioFim: "21:00", dataInicio: inicio(), dataFim: fim(),
    vinculosDocentes: { create: { professorId: professor.id, inicio: inicio() } },
  } });
  const entrada: TurmaInput = {
    modalidadeId: turma.modalidadeId, nivelId: turma.nivelId, professorId: professor.id, capacidade: 3,
    diasSemana: [1, 3], horarioInicio: "19:00", horarioFim: "21:00", dataInicio: turma.dataInicio!, dataFim: turma.dataFim!,
  };
  entrar(gestor.id);
  return { cat, gestor, professor, turma, outroNivel, outraModalidade, entrada };
}

async function alocar(c: Awaited<ReturnType<typeof cenario>>, ativa = true, tx: Pick<Prisma.TransactionClient, "aluno"> = prisma) {
  return tx.aluno.create({ data: { primeiroNome: "Aluno", paisId: c.cat.pais.id,
    alocacoes: { create: { turmaId: c.turma.id, ativa, criadoEm: inicio(), encerradaEm: ativa ? null : new Date() } },
  } });
}

function sinal() {
  let liberar!: () => void;
  const promessa = new Promise<void>((resolve) => { liberar = resolve; });
  return { promessa, liberar };
}

/** A mutação só ocorre depois de observar a ação esperando no lock real do PostgreSQL. */
async function duranteEspera<T>(turmaId: string, acao: () => Promise<T>, mudar: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  const pronto = sinal();
  const liberar = sinal();
  let pid = 0;
  const bloqueador = prisma.$transaction(async (tx) => {
    const [conexao] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    pid = conexao.pid;
    await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${turmaId} FOR UPDATE`;
    pronto.liberar();
    await liberar.promessa;
    await mudar(tx);
  }, { timeout: 10000 });
  await Promise.race([pronto.promessa, bloqueador]);
  const pendente = acao();
  let resultado!: T;
  try {
    let aguardou = false;
    const limite = Date.now() + 3000;
    while (Date.now() < limite) {
      const [estado] = await prisma.$queryRaw<{ aguardando: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM pg_stat_activity atividade WHERE ${pid} = ANY(pg_blocking_pids(atividade.pid))) AS aguardando
      `;
      if (estado.aguardando) { aguardou = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(aguardou, "A ação deve esperar no lock da turma antes da mutação concorrente").toBe(true);
  } finally {
    liberar.liberar();
    await bloqueador;
    resultado = await pendente;
  }
  return resultado;
}

beforeEach(async () => { vi.clearAllMocks(); await truncarBanco(); });

describe("integridade das turmas no fluxo de mudanças acadêmicas", () => {
  it.each([
    ["nível", true], ["nível", false], ["modalidade", true], ["modalidade", false],
  ] as const)("não altera %s em turma com alocação ativa=%s", async (campo, ativa) => {
    const c = await cenario();
    await alocar(c, ativa);
    const entrada = { ...c.entrada, ...(campo === "nível" ? { nivelId: c.outroNivel.id } : { modalidadeId: c.outraModalidade.id }) };
    const resultado = await editarTurma(c.turma.id, entrada);
    expect(resultado).toMatchObject({ ok: false, erro: expect.stringContaining("alunos ou histórico") });
    expect(await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).toEqual(c.turma);
    expect(await eventosDo("Turma", c.turma.id)).toEqual([]);
  });

  it("administração também não altera o currículo de turma com histórico", async () => {
    const c = await cenario();
    const admin = await criarUsuario([Papel.ADMINISTRADOR]);
    await alocar(c, false); entrar(admin.id);
    expect((await editarTurma(c.turma.id, { ...c.entrada, nivelId: c.outroNivel.id })).ok).toBe(false);
    expect((await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).nivelId).toBe(c.turma.nivelId);
  });

  it("turma sem alocações pode corrigir nível e modalidade antes de receber alunos", async () => {
    const c = await cenario();
    expect((await editarTurma(c.turma.id, { ...c.entrada, nivelId: c.outroNivel.id, modalidadeId: c.outraModalidade.id })).ok).toBe(true);
    expect(await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).toMatchObject({ nivelId: c.outroNivel.id, modalidadeId: c.outraModalidade.id });
    expect((await eventosDo("Turma", c.turma.id))[0]).toMatchObject({ tipo: "TurmaEditada", payload: {
      de: { nivelId: c.turma.nivelId, modalidadeId: c.turma.modalidadeId },
      para: { nivelId: c.outroNivel.id, modalidadeId: c.outraModalidade.id },
    } });
  });

  it("rejeita tentativa de alterar online pelo payload e preserva o formato cadastrado", async () => {
    const c = await cenario(); await alocar(c);
    const entrada = { ...c.entrada, online: false };
    expect(await editarTurma(c.turma.id, entrada)).toMatchObject({ ok: false, erro: expect.stringContaining("online/presencial") });
    expect((await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).online).toBe(true);
    expect(await eventosDo("Turma", c.turma.id)).toEqual([]);
  });

  it("conta a reserva de aluno pausado para não reduzir capacidade abaixo da ocupação", async () => {
    const c = await cenario();
    await alocar(c); const pausado = await alocar(c);
    await prisma.aluno.update({ where: { id: pausado.id }, data: { status: "PAUSADO" } });
    expect(await editarTurma(c.turma.id, { ...c.entrada, capacidade: 1 })).toMatchObject({ ok: false, erro: expect.stringContaining("2 alunos") });
    expect((await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).capacidade).toBe(3);
  });

  it("reduz capacidade até a ocupação atual sem contar alocações históricas", async () => {
    const c = await cenario(); await alocar(c); await alocar(c, false);
    expect((await editarTurma(c.turma.id, { ...c.entrada, capacidade: 1 })).ok).toBe(true);
    expect((await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).capacidade).toBe(1);
    expect(await prisma.alocacaoTurma.count({ where: { turmaId: c.turma.id } })).toBe(2);
  });

  it("mantém edição de professor e horário sem reescrever currículo ou alocações", async () => {
    const c = await cenario(); await alocar(c);
    const outro = await criarUsuario([Papel.PROFESSOR], "Professor sucessor");
    const antes = await prisma.alocacaoTurma.findMany({ where: { turmaId: c.turma.id } });
    expect((await editarTurma(c.turma.id, { ...c.entrada, professorId: outro.id, horarioInicio: "18:00", horarioFim: "20:00" })).ok).toBe(true);
    expect(await prisma.alocacaoTurma.findMany({ where: { turmaId: c.turma.id } })).toEqual(antes);
    const vinculos = await prisma.vinculoDocente.findMany({ where: { turmaId: c.turma.id }, orderBy: { inicio: "asc" } });
    expect(vinculos).toHaveLength(2);
    expect(vinculos[0]).toMatchObject({ professorId: c.professor.id, fim: vinculos[1].inicio });
    expect(vinculos[1]).toMatchObject({ professorId: outro.id, fim: null });
  });

  it("reconta ocupação depois de esperar a matrícula que ocupa a última vaga", async () => {
    const c = await cenario(); await alocar(c);
    const resultado = await duranteEspera(c.turma.id, () => editarTurma(c.turma.id, { ...c.entrada, capacidade: 1 }), (tx) => alocar(c, true, tx));
    expect(resultado).toMatchObject({ ok: false, erro: expect.stringContaining("2 alunos") });
    expect((await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).capacidade).toBe(3);
    expect(await prisma.alocacaoTurma.count({ where: { turmaId: c.turma.id, ativa: true } })).toBe(2);
  });

  it("alocação incluída durante a espera impede alterar o nível da turma antes vazia", async () => {
    const c = await cenario();
    const resultado = await duranteEspera(c.turma.id, () => editarTurma(c.turma.id, { ...c.entrada, nivelId: c.outroNivel.id }), (tx) => alocar(c, true, tx));
    expect(resultado).toMatchObject({ ok: false, erro: expect.stringContaining("alunos ou histórico") });
    expect((await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).nivelId).toBe(c.turma.nivelId);
  });

  it.each([
    ["editar", "papel"], ["editar", "desativação"], ["status", "papel"], ["status", "desativação"],
  ] as const)("%s revalida permissão após %s enquanto aguarda lock", async (acao, revogacao) => {
    const c = await cenario();
    const executar = (): Promise<Resultado> => acao === "editar"
      ? editarTurma(c.turma.id, { ...c.entrada, nome: "Mudança não autorizada" })
      : alterarStatusTurma(c.turma.id, "CONCLUIDA");
    const resultado = await duranteEspera(c.turma.id, executar, (tx) => tx.usuario.update({ where: { id: c.gestor.id },
      data: revogacao === "papel" ? { papeis: [Papel.SECRETARIA_ACADEMICA] } : { ativo: false },
    }));
    expect(resultado.ok).toBe(false);
    expect(await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).toEqual(c.turma);
    expect(await eventosDo("Turma", c.turma.id)).toEqual([]);
  });

  it.each([false, true])("conclusão confere diário e encerra vínculo uma vez; legado incompleto=%s", async (legadoIncompleto) => {
    const c = await cenario();
    expect(await alterarStatusTurma(c.turma.id, "CONCLUIDA")).toMatchObject({ ok: false, erro: expect.stringContaining("meta de aulas") });
    const outro = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
    const calendario = await prisma.versaoCalendarioEscolar.create({ data: { versao: 1, preparadorId: c.gestor.id, fusoInstitucional: "UTC",
      periodos: [], motivo: "Calendário de teste", chaveIdempotencia: "calendario-conclusao", entradaHash: "fixture" } });
    await prisma.propostaGradeTurma.create({ data: { turmaId: c.turma.id, calendarioId: calendario.id, preparadorId: outro.id,
      versao: 1, fusoOrigem: "UTC", motivo: "Meta aprovada de teste", chaveIdempotencia: "meta-conclusao", entradaHash: "fixture",
      snapshot: { origem: { quantidadeAulas: 1 } }, decisao: { create: { decisorId: c.gestor.id, aprovada: true, motivo: "Meta conferida" } } } });
    expect(await alterarStatusTurma(c.turma.id, "CONCLUIDA")).toMatchObject({ ok: false, erro: expect.stringContaining("quantidade exigida") });
    const e = await prisma.encontroAgenda.create({ data: { turmaId: c.turma.id, professorId: c.professor.id, preparadorId: c.gestor.id,
      inicio: inicio(), fim: new Date(Date.now() - DIA), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Encontro de teste",
      chaveIdempotencia: "encontro-conclusao", entradaHash: "fixture" } });
    expect(await alterarStatusTurma(c.turma.id, "CONCLUIDA")).toMatchObject({ ok: false, erro: expect.stringContaining("previstos pendentes") });
    if (legadoIncompleto) {
      await prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "MINISTRADO" } });
      expect(await alterarStatusTurma(c.turma.id, "CONCLUIDA")).toMatchObject({ ok: false, erro: expect.stringContaining("diário incompleto") });
      await expect(prisma.aulaDiario.create({ data: { turmaId: c.turma.id, professorId: c.professor.id, encontroId: e.id,
        ocorridaEm: e.inicio, conteudo: "Inclusão tardia sem correção aprovada" } })).rejects.toThrow();
      return;
    }
    const aluno = await alocar(c);
    await prisma.aulaDiario.create({ data: { turmaId: c.turma.id, professorId: c.professor.id, encontroId: e.id, ocorridaEm: e.inicio,
      conteudo: "Atividade realizada", registros: { create: { alunoId: aluno.id, nomeAluno: "Aluno", presente: true } } } });
    await prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "MINISTRADO" } });
    expect((await alterarStatusTurma(c.turma.id, "CONCLUIDA")).ok).toBe(true);
    expect((await alterarStatusTurma(c.turma.id, "CONCLUIDA")).ok).toBe(true);
    expect(await prisma.vinculoDocente.count({ where: { turmaId: c.turma.id, fim: null } })).toBe(0);
    expect((await eventosDo("Turma", c.turma.id)).map((e) => e.tipo)).toEqual(["TurmaConcluida"]);
  });

  it("status fora do enum é recusado sem gravação", async () => {
    const c = await cenario();
    expect(await alterarStatusTurma(c.turma.id, "ATIVA" as StatusTurma)).toMatchObject({ ok: false, erro: expect.stringContaining("Status") });
    expect(await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).toEqual(c.turma);
  });
});

it("impede edição direta da grade publicada e preserva ajustes cadastrais sem alterar encontros", async () => {
  const c = await cenario();
  const encontro = await prisma.encontroAgenda.create({ data: { turmaId: c.turma.id, professorId: c.professor.id,
    preparadorId: c.gestor.id, inicio: new Date("2099-01-05T19:00:00Z"), fim: new Date("2099-01-05T21:00:00Z"),
    fusoOrigem: "UTC", status: "PREVISTO", motivo: "Agenda publicada para validação", chaveIdempotencia: "integridade-grade", entradaHash: "fixture" } });
  const outro = await criarUsuario([Papel.PROFESSOR]);
  const mudancas: Partial<TurmaInput>[] = [
    { professorId: outro.id }, { nivelId: c.outroNivel.id }, { modalidadeId: c.outraModalidade.id },
    { diasSemana: [2, 4] }, { horarioInicio: "18:00" }, { horarioFim: "22:00" },
    { dataInicio: new Date(c.turma.dataInicio!.getTime() + DIA) }, { dataFim: new Date(c.turma.dataFim!.getTime() + DIA) },
  ];
  for (const mudanca of mudancas) {
    expect(await editarTurma(c.turma.id, { ...c.entrada, ...mudanca }))
      .toMatchObject({ ok: false, erro: expect.stringContaining("agenda publicada") });
  }
  expect(await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).toEqual(c.turma);
  expect(await eventosDo("Turma", c.turma.id)).toHaveLength(0);
  expect((await editarTurma(c.turma.id, { ...c.entrada, nome: "Nome corrigido", capacidade: 4, diasSemana: [3, 1] })).ok).toBe(true);
  expect(await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).toMatchObject({ nome: "Nome corrigido", capacidade: 4 });
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontro.id } })).toEqual(encontro);
});

it("protege transições manuais pelo início efetivo mesmo antes de o cron atualizar a turma", async () => {
  const c = await cenario();
  await prisma.turma.update({ where: { id: c.turma.id }, data: { status: "PLANEJADA" } });
  expect((await alterarStatusTurma(c.turma.id, "EM_ANDAMENTO")).ok).toBe(false);
  const e = await prisma.encontroAgenda.create({ data: { turmaId: c.turma.id, professorId: c.professor.id, preparadorId: c.gestor.id,
    inicio: new Date(Date.now() + DIA), fim: new Date(Date.now() + 2 * DIA), fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Encontro de transição", chaveIdempotencia: "transicao-status", entradaHash: "fixture" } });
  expect((await alterarStatusTurma(c.turma.id, "EM_ANDAMENTO")).ok).toBe(false);
  await prisma.encontroAgenda.update({ where: { id: e.id }, data: { inicio: new Date(Date.now() - DIA), fim: new Date() } });
  expect(await alterarStatusTurma(c.turma.id, "ABERTA")).toMatchObject({ ok: false, erro: expect.stringContaining("já iniciou") });
  expect((await alterarStatusTurma(c.turma.id, "EM_ANDAMENTO")).ok).toBe(true);
  expect((await alterarStatusTurma(c.turma.id, "PLANEJADA")).ok).toBe(false);
  expect((await alterarStatusTurma(c.turma.id, "ABERTA")).ok).toBe(false);
  await prisma.turma.update({ where: { id: c.turma.id }, data: { status: "CONCLUIDA" } });
  for (const status of ["PLANEJADA", "ABERTA", "EM_ANDAMENTO"] as const) {
    expect(await alterarStatusTurma(c.turma.id, status)).toMatchObject({ ok: false, erro: expect.stringContaining("reaberta") });
  }
  expect((await eventosDo("Turma", c.turma.id)).map((e) => e.tipo)).toEqual(["TurmaEmAndamento"]);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ status: "PREVISTO" });
});
