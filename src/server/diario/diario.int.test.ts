import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { exigirSessao } from "@/server/_shared/sessao";
import { obterAluno, listarAlunos, obterTurma } from "@/server/alunos/consultas";
import { editarTurma } from "@/server/turmas/acoes";
import { salvarAulaDiario } from "./acoes";
import { listarAulasDiario, listarTurmasParaDiario } from "./consultas";
import { listarAlunosParaChamada } from "./chamada";
import { listarChamadaEncontro } from "./chamada-encontro";
import { solicitarConclusaoSemGravacao, decidirConclusaoSemGravacao } from "./excecao-gravacao";
import { listarExcecoesGravacao } from "./excecao-consulta";
import { salvarDiarioParticular } from "./particular";

const DIA = 86_400_000;
const como = (u: { id: string; papeis: Papel[] }) => authMock.mockResolvedValue({ user: { id: u.id, papeis: u.papeis } });

async function cenario(comEncontro = false) {
  const cat = await seedCatalogoMinimo();
  const professor = await criarUsuario([Papel.PROFESSOR], "Professor original");
  const sucessor = await criarUsuario([Papel.PROFESSOR], "Professor sucessor");
  const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const gestao = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão pedagógica");
  const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
  const inicio = new Date(Date.now() - 10 * DIA);
  const ocorridaEm = new Date(Date.now() - 2 * DIA);
  const turma = await prisma.turma.create({ data: {
    codigo: "T-DIARIO", modalidadeId: cat.modalidade.id, nivelId: nivel.id, professorId: professor.id,
    status: "EM_ANDAMENTO", capacidade: 12,
    vinculosDocentes: { create: { professorId: professor.id, inicio } },
  } });
  const destino = await prisma.turma.create({ data: {
    codigo: "T-DESTINO", modalidadeId: cat.modalidade.id, nivelId: nivel.id, professorId: sucessor.id,
    status: "EM_ANDAMENTO", capacidade: 12,
    vinculosDocentes: { create: { professorId: sucessor.id, inicio } },
  } });
  const aluno = await prisma.aluno.create({ data: {
    primeiroNome: "Ana", sobrenome: "Santos", paisId: cat.pais.id,
    documento: "DOCUMENTO_PRIVADO", telefoneE164: "+50688887777", email: "privado@example.test",
    observacoes: "NOTA_ADMINISTRATIVA_PRIVADA", alocacoes: { create: { turmaId: turma.id, criadoEm: inicio } },
  } });
  const encontro = comEncontro ? await prisma.encontroAgenda.create({ data: { turmaId: turma.id, professorId: professor.id, preparadorId: gestao.id,
    inicio: ocorridaEm, fim: new Date(ocorridaEm.getTime() + 3600000), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula sem gravação recuperável", chaveIdempotencia: "conclusao-excecao-aula", entradaHash: "fixture" } }) : null;
  const entrada = {
    ...(encontro ? { encontroId: encontro.id } : {}),
    turmaId: turma.id, ocorridaEm: ocorridaEm.toISOString(), conteudo: "Conversação sobre viagens",
    registros: [{ alunoId: aluno.id, presente: true, observacao: "Participou da atividade" }],
  };
  como(professor);
  const registro = await salvarAulaDiario(entrada);
  expect(registro.ok).toBe(true);
  if (!registro.ok || !registro.dado) throw new Error("Não foi possível registrar a aula do cenário.");
  return { professor, sucessor, secretaria, gestao, turma, destino, aluno, inicio, ocorridaEm, entrada, aulaId: registro.dado.id };
}

/**
 * Este é um retrato histórico, não uma transferência exercida pelo teste. A
 * transferência operacional passa pela equivalência acadêmica; os cenários de
 * diário só precisam de vínculos já encerrados para conferir leitura e chamada.
 */
async function registrarTransferenciaHistorica(c: Awaited<ReturnType<typeof cenario>>, turmaDestinoId: string, quando: Date) {
  const origem = await prisma.alocacaoTurma.findFirstOrThrow({
    where: { alunoId: c.aluno.id, ativa: true },
    orderBy: { criadoEm: "desc" },
  });
  await prisma.$transaction(async (tx) => {
    await tx.alocacaoTurma.update({ where: { id: origem.id }, data: { ativa: false, encerradaEm: quando } });
    await tx.alocacaoTurma.create({
      data: {
        alunoId: c.aluno.id,
        matriculaId: origem.matriculaId,
        turmaId: turmaDestinoId,
        criadoEm: quando,
      },
    });
  });
}

async function atribuirTurma(c: Awaited<ReturnType<typeof cenario>>, professorId: string) {
  como(c.gestao);
  const resultado = await editarTurma(c.turma.id, {
    modalidadeId: c.turma.modalidadeId, nivelId: c.turma.nivelId, professorId,
    diasSemana: [1, 3], horarioInicio: "19:00", horarioFim: "21:00",
    dataInicio: c.inicio, dataFim: new Date(Date.now() + 30 * DIA), capacidade: 12,
  });
  expect(resultado.ok).toBe(true);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
});

describe("D08 — diário persistido, transferência e revogação", () => {
  it("diário legado espera calendário antes de bloquear a turma, sem inverter a ordem da conclusão", async () => {
    const c = await cenario();
    let anunciar!: () => void;
    let conferir!: () => void;
    const pronto = new Promise<void>(resolve => { anunciar = resolve; });
    const verificar = new Promise<void>(resolve => { conferir = resolve; });
    let pid = 0;
    const bloqueador = prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const [conexao] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      pid = conexao.pid;
      anunciar();
      await verificar;
      // Se o diário segurasse a turma antes de esperar calendário, NOWAIT
      // falharia e provaria a inversão em vez de aguardar um deadlock.
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${c.turma.id} FOR UPDATE NOWAIT`;
    }, { timeout: 10000 });
    await Promise.race([pronto, bloqueador]);
    const escrita = salvarAulaDiario({ ...c.entrada, aulaId: c.aulaId, conteudo: "Conferência concorrente do diário legado" });
    try {
      let aguardou = false;
      const limite = Date.now() + 3000;
      while (Date.now() < limite) {
        const [estado] = await prisma.$queryRaw<{ aguardando: boolean }[]>`
          SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))) AS aguardando`;
        if (estado.aguardando) { aguardou = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(aguardou).toBe(true);
    } finally {
      conferir();
      const resultados = await Promise.allSettled([bloqueador, escrita]);
      expect(resultados[0].status).toBe("fulfilled");
      expect(resultados[1]).toMatchObject({ status: "fulfilled", value: { ok: true } });
    }
  });
  it.each([true, false])("exige conferência de vínculos históricos sobrepostos; mesmo contrato=%s", async (mesmoContrato) => {
    const c = await cenario(true);
    const produto = await prisma.produto.findFirstOrThrow();
    const dados = { alunoId: c.aluno.id, produtoId: produto.id, paisId: c.aluno.paisId, moeda: "CRC", status: "ATIVA" as const, ativadaEm: c.inicio };
    const primeira = await prisma.matricula.create({ data: dados });
    const segunda = mesmoContrato ? primeira : await prisma.matricula.create({ data: dados });
    const fim = new Date();
    await prisma.alocacaoTurma.updateMany({ where: { alunoId: c.aluno.id }, data: { matriculaId: primeira.id, ativa: false, encerradaEm: fim } });
    await prisma.alocacaoTurma.create({ data: { alunoId: c.aluno.id, matriculaId: segunda.id, turmaId: c.turma.id, criadoEm: c.inicio, ativa: false, encerradaEm: fim } });
    const antes = await prisma.registroAulaAluno.findMany({ where: { aulaId: c.aulaId } });
    expect(await listarAlunosParaChamada({ turmaId: c.turma.id, ocorridaEm: c.ocorridaEm.toISOString() })).toMatchObject({ ok: true, dado: { exigeConferencia: true, alunos: [] } });
    expect(await listarChamadaEncontro({ encontroId: c.entrada.encontroId! })).toMatchObject({ ok: true, dado: { exigeConferencia: true, alunos: [{ alunoId: c.aluno.id, podeEditar: false, podeClassificar: false }] } });
    expect(await salvarAulaDiario({ ...c.entrada, encontroId: undefined, ocorridaEm: new Date(c.ocorridaEm.getTime() + 1000).toISOString() })).toMatchObject({ ok: false, erro: expect.stringContaining("sobrepostos") });
    expect((await solicitarConclusaoSemGravacao({ encontroId: c.entrada.encontroId!, motivo: "Conferir a chamada antes de concluir", chaveIdempotencia: "sobreposicao-nao-conclui" })).ok).toBe(false);
    expect(await prisma.aulaDiario.count()).toBe(1);
    expect(await prisma.registroAulaAluno.findMany({ where: { aulaId: c.aulaId } })).toEqual(antes);
    expect(await prisma.decisaoExcecaoGravacao.count()).toBe(0);
  });

  it("conclui sem gravação apenas com chamada completa e aprovação independente do estado revisado", async () => {
    const c = await cenario(true);
    const e = await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: c.entrada.encontroId! } });
    const input = { encontroId: e.id, motivo: "Falha da gravação, arquivo irrecuperável", chaveIdempotencia: "excecao-gravacao-teste" };
    await prisma.registroAulaAluno.updateMany({ where: { aulaId: c.aulaId }, data: { presente: null } });
    expect((await solicitarConclusaoSemGravacao(input)).ok).toBe(false);
    await prisma.registroAulaAluno.updateMany({ where: { aulaId: c.aulaId }, data: { presente: true } });
    const p = await solicitarConclusaoSemGravacao(input);
    expect(p.ok).toBe(true);
    if (!p.ok || !p.dado) throw new Error("Exceção ausente");
    expect(await solicitarConclusaoSemGravacao(input)).toEqual(p);
    expect(await listarExcecoesGravacao()).toMatchObject({ ok: true, dado: { itens: [{ id: p.dado.id, podeDecidir: false, decisao: null, diarioParaRevisao: null }] } });
    como(c.sucessor);
    expect(await listarExcecoesGravacao()).toMatchObject({ ok: true, dado: { itens: [] } });
    expect((await listarExcecoesGravacao({ cursor: p.dado.id })).ok).toBe(false);
    como(c.professor);
    await prisma.usuario.update({ where: { id: c.professor.id }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
    const decisao = { excecaoId: p.dado.id, aprovar: true, motivo: "Evidências conferidas pela gestão" };
    expect((await decidirConclusaoSemGravacao(decisao)).ok).toBe(false);
    await prisma.aulaDiario.update({ where: { id: c.aulaId }, data: { conteudo: "Conteúdo alterado após proposta" } });
    como(c.gestao);
    expect((await decidirConclusaoSemGravacao(decisao)).ok).toBe(false);
    expect(await listarExcecoesGravacao()).toMatchObject({ ok: true, dado: { itens: [{ id: p.dado.id, podeDecidir: true, diarioCorresponde: false, diarioParaRevisao: { conteudo: "Conteúdo alterado após proposta" } }] } });
    expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("PREVISTO");
    expect((await decidirConclusaoSemGravacao({ ...decisao, aprovar: false })).ok).toBe(true);
    como(c.professor);
    const nova = await solicitarConclusaoSemGravacao({ ...input, chaveIdempotencia: "excecao-gravacao-revisada" });
    if (!nova.ok || !nova.dado) throw new Error("Nova proposta ausente");
    como(c.gestao);
    const aprovar = { ...decisao, excecaoId: nova.dado.id };
    const r = await decidirConclusaoSemGravacao(aprovar);
    expect(r).toMatchObject({ ok: true, dado: { concluida: true } });
    expect(await decidirConclusaoSemGravacao(aprovar)).toEqual(r);
    expect(await listarExcecoesGravacao()).toMatchObject({ ok: true, dado: { itens: [] } });
    const historicoExcecoes = await listarExcecoesGravacao({ apenasPendentes: false });
    if (!historicoExcecoes.ok || !historicoExcecoes.dado) throw new Error("Histórico ausente");
    expect(historicoExcecoes.dado.itens).toHaveLength(2);
    expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("MINISTRADO");
    expect(await prisma.cobranca.count()).toBe(0);
    await expect(prisma.excecaoGravacaoEncontro.update({ where: { id: nova.dado.id }, data: { motivo: "Alteração indevida" } })).rejects.toThrow();
    await expect(prisma.decisaoExcecaoGravacao.deleteMany({ where: { excecaoId: nova.dado.id } })).rejects.toThrow();
    como(c.professor);
    expect((await salvarAulaDiario({ ...c.entrada, aulaId: c.aulaId, encontroId: e.id, conteudo: "Correção sem aprovação" })).ok).toBe(false);
  });
  it("autoriza substituto apenas no encontro atribuído e preserva o titular da turma", async () => {
    const c = await cenario();
    const inicio = new Date(Date.now() - DIA);
    const e = await prisma.encontroAgenda.create({ data: { turmaId: c.turma.id, professorId: c.sucessor.id, preparadorId: c.gestao.id,
      inicio, fim: new Date(inicio.getTime() + 3600000), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Encontro atribuído ao substituto", chaveIdempotencia: "diario-substituto", entradaHash: "fixture" } });
    const input = { ...c.entrada, encontroId: e.id, ocorridaEm: inicio.toISOString() };
    como(c.professor);
    expect((await listarChamadaEncontro({ encontroId: e.id })).ok).toBe(false);
    expect((await salvarAulaDiario(input)).ok).toBe(false);
    expect((await salvarAulaDiario({ ...c.entrada, ocorridaEm: inicio.toISOString() })).ok).toBe(false);
    como(c.sucessor);
    const chamada = await listarChamadaEncontro({ encontroId: e.id });
    expect(chamada).toMatchObject({ ok: true, dado: { alunos: [{ alunoId: c.aluno.id, nomeAluno: "Ana Santos" }], exigeConferencia: false, ocorridaEm: inicio.toISOString() } });
    expect(JSON.stringify(chamada)).not.toMatch(/DOCUMENTO_PRIVADO|privado@example|telefone|valor|snapshot/);
    expect((await listarAlunosParaChamada({ turmaId: c.turma.id, ocorridaEm: inicio.toISOString() })).ok).toBe(false);
    expect((await salvarAulaDiario({ ...input, turmaId: c.destino.id })).ok).toBe(false);
    expect((await salvarAulaDiario({ ...input, ocorridaEm: new Date(inicio.getTime() + 60000).toISOString() })).ok).toBe(false);
    const r = await salvarAulaDiario(input);
    expect(r.ok, r.ok ? undefined : r.erro).toBe(true);
    if (!r.ok || !r.dado) throw new Error("Diário não registrado");
    const diario = await prisma.aulaDiario.findUniqueOrThrow({ where: { id: r.dado.id } });
    expect(diario).toMatchObject({ encontroId: e.id, professorId: c.sucessor.id, turmaId: c.turma.id });
    const historicoPendente = await listarAulasDiario(await exigirSessao());
    expect(historicoPendente.aulas.find((a) => a.id === diario.id)).toMatchObject({ podeEditar: false, encontroParaEditar: e.id });
    expect(await listarChamadaEncontro({ encontroId: e.id })).toMatchObject({ ok: true, dado: { diarioId: diario.id, conteudo: input.conteudo, alunos: [{ alunoId: c.aluno.id, presente: true, observacao: "Participou da atividade", podeEditar: true }] } });
    const antes = await listarChamadaEncontro({ encontroId: e.id });
    if (!antes.ok || !antes.dado?.estadoAnterior) throw new Error("Estado do diário ausente");
    const editar = { ...input, aulaId: diario.id, estadoAnterior: antes.dado.estadoAnterior, conteudo: "Conteúdo complementado" };
    expect((await salvarAulaDiario({ ...editar, estadoAnterior: undefined })).ok).toBe(false);
    expect((await salvarAulaDiario(editar)).ok).toBe(true);
    expect((await salvarAulaDiario({ ...editar, conteudo: "Sobrescrita por outra aba" })).ok).toBe(false);
    expect((await prisma.aulaDiario.findUniqueOrThrow({ where: { id: diario.id } })).conteudo).toBe("Conteúdo complementado");
    await prisma.alocacaoTurma.updateMany({ where: { turmaId: c.turma.id, alunoId: c.aluno.id }, data: { ativa: false, encerradaEm: new Date() } });
    expect(await listarChamadaEncontro({ encontroId: e.id })).toMatchObject({ ok: true, dado: { alunos: [{ alunoId: c.aluno.id, presente: true, podeEditar: false }] } });
    const historica = await listarChamadaEncontro({ encontroId: e.id });
    if (!historica.ok || !historica.dado?.estadoAnterior) throw new Error("Estado histórico ausente");
    expect(await salvarAulaDiario({ ...input, aulaId: diario.id, estadoAnterior: historica.dado.estadoAnterior, registros: [{ alunoId: c.aluno.id, presente: false }] })).toMatchObject({ ok: false, erro: "O registro de aluno que saiu da turma permanece somente para leitura." });
    expect((await prisma.turma.findUniqueOrThrow({ where: { id: c.turma.id } })).professorId).toBe(c.professor.id);
    expect(await prisma.vinculoDocente.count({ where: { turmaId: c.turma.id, professorId: c.sucessor.id } })).toBe(0);
    expect((await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("PREVISTO");
    expect((await salvarAulaDiario({ ...input, aulaId: diario.id, encontroId: undefined })).ok).toBe(false);
    await prisma.encontroAgenda.update({ where: { id: e.id }, data: { status: "MINISTRADO" } });
    const historicoConcluido = await listarAulasDiario(await exigirSessao());
    expect(historicoConcluido.aulas.find((a) => a.id === diario.id)).toMatchObject({ podeEditar: false, encontroParaEditar: null });
    expect((await listarChamadaEncontro({ encontroId: e.id })).ok).toBe(false);
    expect((await salvarAulaDiario({ ...input, aulaId: diario.id, conteudo: "Correção sem aprovação" })).ok).toBe(false);
  });
  it("registra autoria, captura o nome no servidor e conserva os eventos anteriores", async () => {
    const c = await cenario();
    const original = await eventosDo("Turma", c.turma.id);
    expect(original).toHaveLength(1);
    expect(original[0]).toMatchObject({ tipo: "AulaDiarioRegistrada", autorId: c.professor.id });
    expect(await prisma.registroAulaAluno.findUnique({ where: { aulaId_alunoId: { aulaId: c.aulaId, alunoId: c.aluno.id } } })).toMatchObject({ nomeAluno: "Ana Santos", presente: true });

    expect((await salvarAulaDiario({ ...c.entrada, aulaId: c.aulaId, conteudo: "Conteúdo corrigido" })).ok).toBe(true);
    const eventos = await eventosDo("Turma", c.turma.id);
    expect(eventos).toHaveLength(2);
    expect(eventos[0]).toEqual(original[0]);
    expect(eventos[1]).toMatchObject({ tipo: "AulaDiarioAtualizada", autorId: c.professor.id, payload: { conteudoAnterior: c.entrada.conteudo } });
  });

  it("aluno transferido conserva snapshot em leitura sem abrir cadastro ou contatos atuais", async () => {
    const c = await cenario();
    await registrarTransferenciaHistorica(c, c.destino.id, new Date());
    await prisma.aluno.update({ where: { id: c.aluno.id }, data: { primeiroNome: "NOME_ATUAL_PRIVADO" } });
    como(c.professor);
    const usuario = await exigirSessao();
    expect(await obterAluno(c.aluno.id, usuario)).toBeNull();
    expect(await listarAlunos(usuario)).toEqual([]);
    const historico = await listarAulasDiario(usuario);
    expect(historico.aulas).toHaveLength(1);
    expect(historico.aulas[0].registros).toEqual([{ alunoId: c.aluno.id, nomeAluno: "Ana Santos", presente: true, observacao: "Participou da atividade", participacao: null, podeEditar: false }]);
    expect(JSON.stringify(historico)).not.toMatch(/NOME_ATUAL_PRIVADO|DOCUMENTO_PRIVADO|50688887777|privado@example|NOTA_ADMINISTRATIVA|matriculas|telefoneE164/);

    const eventosAntes = await eventosDo("Turma", c.turma.id);
    const resultado = await salvarAulaDiario({ ...c.entrada, aulaId: c.aulaId, registros: [{ ...c.entrada.registros[0], presente: false }] });
    expect(resultado).toMatchObject({ ok: false, erro: expect.stringContaining("somente para leitura") });
    expect(await eventosDo("Turma", c.turma.id)).toEqual(eventosAntes);
    expect(await prisma.registroAulaAluno.findUnique({ where: { aulaId_alunoId: { aulaId: c.aulaId, alunoId: c.aluno.id } } })).toMatchObject({ nomeAluno: "Ana Santos", presente: true });
    expect(await prisma.alocacaoTurma.findFirst({ where: { alunoId: c.aluno.id, turmaId: c.turma.id } })).toMatchObject({ ativa: false, encerradaEm: expect.any(Date) });
  });

  it("primeira chamada atrasada usa o vínculo encerrado na transferência", async () => {
    const c = await cenario();
    await registrarTransferenciaHistorica(c, c.destino.id, new Date());
    como(c.professor);
    const ocorridaEm = new Date(c.ocorridaEm.getTime() + 3600000).toISOString();
    const r = await salvarAulaDiario({ ...c.entrada, ocorridaEm });
    expect(r.ok).toBe(true);
    if (!r.ok || !r.dado) throw new Error("Chamada histórica não registrada");
    expect(await prisma.registroAulaAluno.findUnique({ where: { aulaId_alunoId: { aulaId: r.dado.id, alunoId: c.aluno.id } } })).toMatchObject({ presente: true });
    expect((await salvarAulaDiario({ ...c.entrada, ocorridaEm: new Date().toISOString() })).ok).toBe(false);
    const turmas = await listarTurmasParaDiario(await exigirSessao());
    expect(turmas.find((t) => t.id === c.turma.id)).toEqual({ id: c.turma.id, label: c.turma.codigo });
    expect(JSON.stringify(turmas)).not.toContain(c.aluno.id);
  });

  it("não oculta matrícula encerrada com histórico insuficiente na chamada antiga", async () => {
    const c = await cenario();
    const produto = await prisma.produto.findFirstOrThrow();
    const m = await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: produto.id,
      paisId: c.aluno.paisId, moeda: "CRC", status: "ENCERRADA", ativadaEm: c.inicio } });
    await prisma.alocacaoTurma.updateMany({ where: { alunoId: c.aluno.id, turmaId: c.turma.id },
      data: { matriculaId: m.id, ativa: false, encerradaEm: new Date() } });
    const inicio = new Date(c.ocorridaEm.getTime() - 3600000);
    const e = await prisma.encontroAgenda.create({ data: { turmaId: c.turma.id, professorId: c.professor.id,
      preparadorId: c.gestao.id, inicio, fim: c.ocorridaEm, fusoOrigem: "UTC", status: "PREVISTO",
      motivo: "Chamada histórica a conferir", chaveIdempotencia: "chamada-encerrada", entradaHash: "fixture" } });
    const lista = await listarChamadaEncontro({ encontroId: e.id });
    expect(lista).toMatchObject({ ok: true, dado: { alunos: [], exigeConferencia: true } });
    expect(JSON.stringify(lista)).not.toMatch(/DOCUMENTO_PRIVADO|privado@example|telefone|valor/);
    expect(await listarAlunosParaChamada({ turmaId: c.turma.id, ocorridaEm: inicio.toISOString() }))
      .toMatchObject({ ok: true, dado: { exigeConferencia: true } });
    const antes = await prisma.aulaDiario.count();
    const salvo = await salvarAulaDiario({ ...c.entrada, encontroId: e.id, ocorridaEm: inicio.toISOString() });
    expect(salvo).toMatchObject({ ok: false, erro: expect.stringContaining("histórico incompleto") });
    expect(await prisma.aulaDiario.count()).toBe(antes);
    // A pendência não autoriza concluir um diário legado que omitiu esse aluno.
    const diario = await prisma.aulaDiario.create({ data: { turmaId: c.turma.id, professorId: c.professor.id,
      encontroId: e.id, ocorridaEm: inicio, conteudo: "Registro anterior incompleto" } });
    expect((await solicitarConclusaoSemGravacao({ encontroId: e.id, motivo: "Gravação indisponível para este encontro",
      chaveIdempotencia: "conclusao-historico-incompleto" })).ok).toBe(false);
    expect(await prisma.encontroAgenda.findUnique({ where: { id: e.id } })).toMatchObject({ status: "PREVISTO" });
    expect(await prisma.aulaDiario.findUnique({ where: { id: diario.id } })).not.toBeNull();
  });

  it("matrícula pausada não ganha chamada porque o aluno possui outro contrato ativo", async () => {
    const c = await cenario();
    const produto = await prisma.produto.findFirstOrThrow();
    const base = { alunoId: c.aluno.id, produtoId: produto.id, paisId: c.aluno.paisId, moeda: "CRC" };
    const pausada = await prisma.matricula.create({ data: { ...base, status: "PAUSADA" } });
    await prisma.matricula.create({ data: { ...base, status: "ATIVA" } });
    await prisma.alocacaoTurma.updateMany({ where: { alunoId: c.aluno.id, ativa: true }, data: { matriculaId: pausada.id } });
    const turmas = await listarTurmasParaDiario(await exigirSessao());
    expect(turmas.find((t) => t.id === c.turma.id)).toEqual({ id: c.turma.id, label: c.turma.codigo });
    expect(await listarAlunosParaChamada({ turmaId: c.turma.id, ocorridaEm: new Date().toISOString() })).toMatchObject({ ok: true, dado: { alunos: [], exigeConferencia: true } });
    expect((await salvarAulaDiario({ ...c.entrada, ocorridaEm: new Date().toISOString() })).ok).toBe(false);
    expect((await prisma.registroAulaAluno.findMany({ where: { alunoId: c.aluno.id } }))).toHaveLength(1);
  });

  it("chamada anterior à pausa usa histórico do contrato e aula durante a pausa é recusada", async () => {
    const c = await cenario();
    const produto = await prisma.produto.findFirstOrThrow();
    const m = await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: produto.id, paisId: c.aluno.paisId,
      moeda: "CRC", status: "PAUSADA", ativadaEm: c.inicio,
    } });
    await prisma.alocacaoTurma.updateMany({ where: { alunoId: c.aluno.id, ativa: true }, data: { matriculaId: m.id } });
    const dataEfetiva = new Date(Date.now() - DIA).toISOString().slice(0, 10);
    const p = await prisma.propostaPausaMatriculas.create({ data: { alunoId: c.aluno.id, solicitanteId: c.secretaria.id,
      chaveIdempotencia: "historico-pausa", entradaHash: "fixture", estadoHash: "fixture", motivo: "Pausa histórica conferida",
      dataEfetiva: new Date(dataEfetiva), status: "APLICADA", aplicadaEm: new Date(), snapshot: { dataEfetiva, fusoInstitucional: "UTC" },
    } });
    await prisma.itemPropostaPausa.create({ data: { propostaId: p.id, matriculaId: m.id, alunoId: c.aluno.id } });
    const lista = await listarAlunosParaChamada({ turmaId: c.turma.id, ocorridaEm: c.ocorridaEm.toISOString() });
    expect(lista).toMatchObject({ ok: true, dado: { alunos: [{ alunoId: c.aluno.id, nomeAluno: "Ana Santos" }], exigeConferencia: false } });
    expect(JSON.stringify(lista)).not.toMatch(/DOCUMENTO_PRIVADO|privado@example|telefone|valor|snapshot/);
    expect(await listarAlunosParaChamada({ turmaId: c.turma.id, ocorridaEm: new Date().toISOString() })).toMatchObject({ ok: true, dado: { alunos: [] } });
    // A hora adicional podia atravessar meia-noite e alcançar o dia efetivo da pausa.
    const anterior = await salvarAulaDiario({ ...c.entrada, ocorridaEm: new Date(c.ocorridaEm.getTime() - 3600000).toISOString() });
    expect(anterior.ok, anterior.ok ? undefined : anterior.erro).toBe(true);
    expect((await salvarAulaDiario({ ...c.entrada, ocorridaEm: new Date().toISOString() })).ok).toBe(false);
    expect(await prisma.registroAulaAluno.count({ where: { alunoId: c.aluno.id } })).toBe(2);
    const historico = await listarAulasDiario(await exigirSessao());
    expect(historico.aulas.find((a) => a.id === c.aulaId)?.registros[0].podeEditar).toBe(true);
    const inconsistente = await prisma.aulaDiario.create({ data: { turmaId: c.turma.id, professorId: c.professor.id,
      ocorridaEm: new Date(), conteudo: "Registro legado durante pausa", registros: { create: {
        alunoId: c.aluno.id, nomeAluno: "Nome histórico", presente: null,
      } },
    } });
    const revisao = await listarAulasDiario(await exigirSessao());
    expect(revisao.aulas.find((a) => a.id === inconsistente.id)?.registros[0]).toMatchObject({ nomeAluno: "Nome histórico", podeEditar: false });
    como(c.sucessor);
    expect((await listarAlunosParaChamada({ turmaId: c.turma.id, ocorridaEm: c.ocorridaEm.toISOString() })).ok).toBe(false);
  });

  it("aguarda alteração concorrente da matrícula e relê o estado antes de gravar", async () => {
    const c = await cenario();
    const produto = await prisma.produto.findFirstOrThrow();
    const m = await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: produto.id, paisId: c.aluno.paisId,
      moeda: "CRC", status: "ATIVA", ativadaEm: c.inicio,
    } });
    await prisma.alocacaoTurma.updateMany({ where: { alunoId: c.aluno.id, ativa: true }, data: { matriculaId: m.id } });
    let liberar!: () => void, avisar!: () => void;
    const pronto = new Promise<void>((resolve) => { avisar = resolve; });
    const espera = new Promise<void>((resolve) => { liberar = resolve; });
    const movimento = prisma.$transaction(async (tx) => {
      await tx.matricula.update({ where: { id: m.id }, data: { status: "PAUSADA" } });
      avisar();
      await espera;
    });
    await pronto;
    const salvamento = salvarAulaDiario({ ...c.entrada, ocorridaEm: new Date(c.ocorridaEm.getTime() + 3600000).toISOString() });
    try {
      let aguardou = false;
      const limite = Date.now() + 2000;
      while (!aguardou && Date.now() < limite) {
        const r = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%"Matricula"%' AND pid <> pg_backend_pid()`;
        aguardou = Number(r[0].n) > 0;
        if (!aguardou) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(aguardou).toBe(true);
    } finally {
      liberar();
      await movimento;
    }
    const resultado = await salvamento;
    expect(resultado.ok).toBe(false);
    expect(await prisma.registroAulaAluno.count({ where: { alunoId: c.aluno.id } })).toBe(1);
  });

  it("troca de professor fecha o vínculo e mantém apenas as próprias aulas em leitura", async () => {
    const c = await cenario();
    const aulaAlheia = await prisma.aulaDiario.create({ data: {
      turmaId: c.destino.id, professorId: c.sucessor.id, ocorridaEm: c.ocorridaEm, conteudo: "Aula de outro professor",
    } });
    await atribuirTurma(c, c.sucessor.id);
    const vinculos = await prisma.vinculoDocente.findMany({ where: { turmaId: c.turma.id }, orderBy: { inicio: "asc" } });
    expect(vinculos).toHaveLength(2);
    expect(vinculos[0]).toMatchObject({ professorId: c.professor.id, inicio: c.inicio, fim: expect.any(Date) });
    expect(vinculos[1]).toMatchObject({ professorId: c.sucessor.id, inicio: vinculos[0].fim, fim: null });

    como(c.professor);
    const usuario = await exigirSessao();
    expect(await obterAluno(c.aluno.id, usuario)).toBeNull();
    expect(await obterTurma(c.turma.id, usuario)).toBeNull();
    expect(await listarTurmasParaDiario(usuario)).toEqual([]);
    const historico = await listarAulasDiario(usuario);
    expect(historico.aulas.map((a) => a.id)).toEqual([c.aulaId]);
    expect(historico.aulas[0].podeEditar).toBe(false);
    expect((await listarAulasDiario(usuario, aulaAlheia.id)).aulas).toEqual([]);
    expect((await salvarAulaDiario({ ...c.entrada, aulaId: c.aulaId, conteudo: "Alteração indevida" })).ok).toBe(false);
    expect(await prisma.aulaDiario.findUnique({ where: { id: c.aulaId } })).toMatchObject({ conteudo: c.entrada.conteudo, professorId: c.professor.id });
  });

  it("voltar à turma não reabre os registros de um vínculo docente encerrado", async () => {
    const c = await cenario();
    await atribuirTurma(c, c.sucessor.id);
    await atribuirTurma(c, c.professor.id);
    como(c.professor);
    const usuario = await exigirSessao();
    expect(await obterAluno(c.aluno.id, usuario)).not.toBeNull();
    expect((await listarAulasDiario(usuario)).aulas[0].podeEditar).toBe(false);
    expect((await salvarAulaDiario({ ...c.entrada, aulaId: c.aulaId })).ok).toBe(false);
    expect((await salvarAulaDiario({ ...c.entrada, ocorridaEm: new Date().toISOString() })).ok).toBe(true);
    expect(await prisma.aulaDiario.count({ where: { turmaId: c.turma.id } })).toBe(2);
  });

  it("retorno do aluno conserva a presença do período anterior em leitura", async () => {
    const c = await cenario();
    const ida = new Date();
    await registrarTransferenciaHistorica(c, c.destino.id, ida);
    await registrarTransferenciaHistorica(c, c.turma.id, new Date(ida.getTime() + 1));
    como(c.professor);
    const historico = await listarAulasDiario(await exigirSessao());
    expect(historico.aulas[0].podeEditar).toBe(true);
    expect(historico.aulas[0].registros[0].podeEditar).toBe(false);
    expect((await salvarAulaDiario({ ...c.entrada, aulaId: c.aulaId, registros: [{ ...c.entrada.registros[0], presente: false }] })).ok).toBe(false);
  });

  it("papel revogado no banco bloqueia leitura e escrita com o mesmo cookie", async () => {
    const c = await cenario();
    await prisma.usuario.update({ where: { id: c.professor.id }, data: { papeis: [Papel.VENDEDOR] } });
    const usuario = await exigirSessao();
    expect(usuario.papeis).toEqual([Papel.VENDEDOR]);
    expect((await listarAulasDiario(usuario)).aulas).toEqual([]);
    expect(await listarTurmasParaDiario(usuario)).toEqual([]);
    expect(await obterAluno(c.aluno.id, usuario)).toBeNull();
    expect((await salvarAulaDiario({ ...c.entrada, aulaId: c.aulaId })).ok).toBe(false);
    expect(await prisma.aulaDiario.count()).toBe(1);
    expect(await eventosDo("Turma", c.turma.id)).toHaveLength(1);
  });

  it("desativação invalida o acesso atual sem apagar a autoria histórica", async () => {
    const c = await cenario();
    await prisma.usuario.update({ where: { id: c.professor.id }, data: { ativo: false } });
    await expect(exigirSessao()).rejects.toThrow("Não autenticado");
    expect((await salvarAulaDiario({ ...c.entrada, aulaId: c.aulaId })).ok).toBe(false);
    como(c.gestao);
    const historico = await listarAulasDiario(await exigirSessao());
    expect(historico.aulas[0]).toMatchObject({ id: c.aulaId, professor: c.professor.nome, podeEditar: false });
    expect(await eventosDo("Turma", c.turma.id)).toHaveLength(1);
  });
});

it("chamada registra impedimento no contrato conferido sem reclassificar registros antigos", async () => {
  const c = await cenario();
  const produto = await prisma.produto.findFirstOrThrow();
  const m = await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: produto.id, paisId: c.aluno.paisId, moeda: "CRC", status: "ATIVA", ativadaEm: c.inicio } });
  await prisma.alocacaoTurma.updateMany({ where: { alunoId: c.aluno.id, turmaId: c.turma.id }, data: { matriculaId: m.id } });
  const e = await prisma.encontroAgenda.create({ data: { turmaId: c.turma.id, professorId: c.professor.id, preparadorId: c.gestao.id, inicio: c.ocorridaEm, fim: new Date(c.ocorridaEm.getTime() + 3600000), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Participação contratual", chaveIdempotencia: "classificacao-diario", entradaHash: "fixture" } });
  const r = await salvarAulaDiario({ ...c.entrada, encontroId: e.id, registros: [{ alunoId: c.aluno.id, presente: false, participacao: "IMPEDIDO_POR_RESTRICAO", observacao: "Acesso à aula restrito" }] });
  expect(r.ok).toBe(true); if (!r.ok || !r.dado) throw new Error("Registro não salvo");
  const registro = await prisma.registroAulaAluno.findUniqueOrThrow({ where: { aulaId_alunoId: { aulaId: r.dado.id, alunoId: c.aluno.id } } });
  expect(registro).toMatchObject({ matriculaId: m.id, participacao: "IMPEDIDO_POR_RESTRICAO", presente: false });
  expect((await listarAulasDiario(await exigirSessao())).aulas.find(a => a.id === r.dado!.id)?.registros).toMatchObject([{ participacao: "IMPEDIDO_POR_RESTRICAO" }]);
  expect(await listarChamadaEncontro({ encontroId: e.id })).toMatchObject({ ok: true, dado: { alunos: [{ participacao: "IMPEDIDO_POR_RESTRICAO", podeClassificar: true }] } });
  expect(await prisma.registroAulaAluno.findMany({ where: { aulaId: c.aulaId } })).toMatchObject([{ matriculaId: null, participacao: null }]);
  await expect(prisma.registroAulaAluno.update({ where: { id: registro.id }, data: { matriculaId: null } })).rejects.toThrow();
  await expect(prisma.registroAulaAluno.update({ where: { id: registro.id }, data: { presente: true } })).rejects.toThrow();
});

it("particular usa contrato próprio, protege autoria e conclui com exceção independente", async () => {
  const c = await cenario();
  const produto = await prisma.produto.findFirstOrThrow();
  const m = await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: produto.id, paisId: c.aluno.paisId, moeda: "CRC", status: "ATIVA", ativadaEm: c.inicio } });
  const e = await prisma.encontroAgenda.create({ data: { matriculaId: m.id, professorId: c.professor.id, preparadorId: c.secretaria.id, inicio: c.ocorridaEm, fim: new Date(c.ocorridaEm.getTime() + 3600000), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Particular contratada", chaveIdempotencia: "particular-diario", entradaHash: "fixture" } });
  const d = { encontroId: e.id, ocorridaEm: e.inicio.toISOString(), conteudo: "Conversação individual", registros: [{ alunoId: c.aluno.id, presente: true, observacao: "Atividade realizada" }] };
  como(c.sucessor);
  expect((await listarChamadaEncontro({ encontroId: e.id })).ok).toBe(false);
  expect((await salvarDiarioParticular(d)).ok).toBe(false);
  como(c.professor);
  const chamada = await listarChamadaEncontro({ encontroId: e.id });
  expect(chamada).toMatchObject({ ok: true, dado: { turmaId: null, alunos: [{ alunoId: c.aluno.id, presente: null }] } });
  expect(JSON.stringify(chamada)).not.toMatch(/DOCUMENTO_PRIVADO|privado@example|telefone|valor/);
  expect((await salvarDiarioParticular({ ...d, registros: [{ ...d.registros[0], alunoId: "aluno-alheio" }] })).ok).toBe(false);
  const salvo = await salvarDiarioParticular(d);
  expect(salvo).toMatchObject({ ok: true });
  if (!salvo.ok || !salvo.dado) throw new Error("Diário ausente");
  expect(await prisma.encontroAgenda.findUnique({ where: { id: e.id } })).toMatchObject({ status: "PREVISTO" });
  expect(await prisma.cobranca.count({ where: { matriculaId: m.id } })).toBe(0);
  expect((await salvarDiarioParticular(d)).ok).toBe(false);
  const atual = await listarChamadaEncontro({ encontroId: e.id });
  if (!atual.ok || !atual.dado?.estadoAnterior) throw new Error("Estado ausente");
  const editavel = { ...d, aulaId: salvo.dado.id, estadoAnterior: atual.dado.estadoAnterior, conteudo: "Conteúdo revisado" };
  expect((await salvarDiarioParticular(editavel)).ok).toBe(true);
  expect((await salvarDiarioParticular(editavel)).ok).toBe(false);
  await expect(prisma.aulaDiario.update({ where: { id: salvo.dado.id }, data: { turmaId: c.turma.id } })).rejects.toThrow();
  const proposta = await solicitarConclusaoSemGravacao({ encontroId: e.id, motivo: "Arquivo da gravação irrecuperável", chaveIdempotencia: "excecao-particular" });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  como(c.gestao);
  expect(await listarExcecoesGravacao()).toMatchObject({ ok: true, dado: { itens: [{ id: proposta.dado.id, diarioCorresponde: true }] } });
  como(c.professor);
  await prisma.usuario.update({ where: { id: c.professor.id }, data: { papeis: ["PROFESSOR", "GERENTE_PEDAGOGICO"] } });
  expect((await decidirConclusaoSemGravacao({ excecaoId: proposta.dado.id, aprovar: true, motivo: "Aprovação pelo próprio autor" })).ok).toBe(false);
  como(c.gestao);
  expect(await decidirConclusaoSemGravacao({ excecaoId: proposta.dado.id, aprovar: true, motivo: "Exceção conferida pela gestão" })).toMatchObject({ ok: true, dado: { concluida: true } });
  expect(await prisma.encontroAgenda.findUnique({ where: { id: e.id } })).toMatchObject({ status: "MINISTRADO" });
  como(c.professor);
  expect((await salvarDiarioParticular(editavel)).ok).toBe(false);
  const historico = await listarAulasDiario(await exigirSessao());
  expect(historico.aulas.find(a => a.id === salvo.dado!.id)).toMatchObject({ turma: "Particular", podeEditar: false });
});

it("particular exige elegibilidade do próprio contrato e falta não conclui aula", async () => {
  const c = await cenario();
  const produto = await prisma.produto.findFirstOrThrow();
  const m = await prisma.matricula.create({ data: { alunoId: c.aluno.id, produtoId: produto.id, paisId: c.aluno.paisId, moeda: "CRC", status: "PAUSADA", ativadaEm: c.inicio } });
  const e = await prisma.encontroAgenda.create({ data: { matriculaId: m.id, professorId: c.professor.id, preparadorId: c.secretaria.id, inicio: c.ocorridaEm, fim: new Date(c.ocorridaEm.getTime() + 3600000), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Particular para conferir", chaveIdempotencia: "particular-pendente", entradaHash: "fixture" } });
  const d = { encontroId: e.id, ocorridaEm: e.inicio.toISOString(), conteudo: "Aluno não compareceu", registros: [{ alunoId: c.aluno.id, presente: false }] };
  expect(await listarChamadaEncontro({ encontroId: e.id })).toMatchObject({ ok: true, dado: { exigeConferencia: true, alunos: [] } });
  expect((await salvarDiarioParticular(d)).ok).toBe(false);
  await prisma.matricula.update({ where: { id: m.id }, data: { status: "ATIVA" } });
  expect((await salvarDiarioParticular({ ...d, ocorridaEm: new Date().toISOString() })).ok).toBe(false);
  expect((await salvarDiarioParticular(d)).ok).toBe(true);
  expect(await solicitarConclusaoSemGravacao({ encontroId: e.id, motivo: "Falta não deve concluir particular", chaveIdempotencia: "falta-particular" })).toMatchObject({ ok: false, erro: expect.stringContaining("não comprova aula ministrada") });
  expect(await prisma.cobranca.count({ where: { matriculaId: m.id } })).toBe(0);
  expect(await prisma.encontroAgenda.findUnique({ where: { id: e.id } })).toMatchObject({ status: "PREVISTO" });
  await prisma.usuario.update({ where: { id: c.professor.id }, data: { ativo: false } });
  expect((await listarChamadaEncontro({ encontroId: e.id })).ok).toBe(false);
  expect((await salvarDiarioParticular(d)).ok).toBe(false);
});
