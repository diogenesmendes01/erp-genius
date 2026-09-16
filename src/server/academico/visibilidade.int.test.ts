import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock, enviarMock } = vi.hoisted(() => ({ authMock: vi.fn(), enviarMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/whatsapp/drivers/meta-cloud", () => ({ driverMetaCloud: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));
vi.mock("@/server/whatsapp/drivers/evolution", () => ({ driverEvolution: { enviarTexto: enviarMock, enviarTemplate: enviarMock, enviarMidia: enviarMock } }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import type { Resultado } from "@/server/_shared";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { confirmarFechamentoAcademico, revisarFechamentoAcademico } from "@/server/avaliacoes/fechamento";
import { oficializarLancamentoAvaliacao, salvarLancamentoAvaliacao } from "@/server/avaliacoes/lancamentos";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "@/server/avaliacoes/regras-tx";
import { obterAluno, listarAlunos } from "@/server/alunos/consultas";
import { salvarAulaDiario } from "@/server/diario/acoes";
import { listarAulasDiario, listarTurmasParaDiario } from "@/server/diario/consultas";
import { editarTurma } from "@/server/turmas/acoes";
import { podeLerArquivo } from "@/server/uploads/autorizacao";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { carregarThread, listarConversas } from "@/server/whatsapp/consultas-inbox";
import { despacharFila } from "@/server/whatsapp/despachante";
import { enviarTextoInbox } from "@/server/whatsapp/acoes";
import { abrirAtendimentoInstitucional } from "@/server/whatsapp/operacoes-atendimento";
import { decidirMudancaAcademica, executarMudancaAcademica, registrarParecerMudanca, solicitarMudancaAcademica } from "./acoes";

const DIA = 86_400_000;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const motivoExecucao = "Horário confirmado; secretaria executa a decisão pedagógica";
const executarInput = { motivo: motivoExecucao, horarioCompativel: true as const };

function sucesso<T>(resultado: Resultado<T>): T {
  expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
  if (!resultado.ok) throw new Error(resultado.erro);
  return resultado.dado!;
}

async function cenario({ comAgendaPublicada = true }: { comAgendaPublicada?: boolean } = {}) {
  const cat = await seedCatalogoMinimo();
  const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  const gestao = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão pedagógica");
  const administracao = await criarUsuario([Papel.ADMINISTRADOR], "Administração pedagógica");
  const professor = await criarUsuario([Papel.PROFESSOR], "Professor de origem");
  const sucessor = await criarUsuario([Papel.PROFESSOR], "Professor de destino");
  const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
  const nivelDestino = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A2", ordem: 2 } });
  const inicio = new Date(Date.now() - 10 * DIA);
  const agenda = { modalidadeId: cat.modalidade.id, diasSemana: [1, 3], horarioInicio: "19:00", horarioFim: "21:00", dataInicio: inicio, dataFim: new Date(Date.now() + 30 * DIA), capacidade: 12 };

  async function publicarRegra(nivelId: string, chaveIdempotencia: string) {
    const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestao.id, {
      nivelId, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(),
      motivo: "Regra publicada para a fixture de visibilidade após progressão.", chaveIdempotencia,
    }));
    const persistida = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
    await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administracao.id, {
      regraId: regra.id, conteudoHash: persistida.conteudoHash, aprovada: true,
      motivo: "Publicação independente da regra da fixture de visibilidade.",
    }));
  }
  await publicarRegra(nivel.id, "regra-visibilidade-a1");
  await publicarRegra(nivelDestino.id, "regra-visibilidade-a2");
  const origemRascunho = await prisma.turma.create({ data: { ...agenda, dataInicio: new Date("2099-01-01T00:00:00.000Z"), codigo: "ACADEMICO-ORIGEM", nivelId: nivel.id, professorId: professor.id, status: "ABERTA",
    vinculosDocentes: { create: { professorId: professor.id, inicio } },
  } });
  const origem = await prisma.turma.update({ where: { id: origemRascunho.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  const destinoRascunho = await prisma.turma.create({ data: { ...agenda, dataInicio: new Date("2099-01-01T00:00:00.000Z"), codigo: "ACADEMICO-DESTINO", nivelId: nivelDestino.id, professorId: sucessor.id, status: "ABERTA",
    vinculosDocentes: { create: { professorId: sucessor.id, inicio } },
  } });
  const destino = await prisma.turma.update({ where: { id: destinoRascunho.id }, data: { status: "EM_ANDAMENTO", dataInicio: inicio } });
  const aluno = await prisma.aluno.create({ data: {
    primeiroNome: "Ana", sobrenome: "Santos", paisId: cat.pais.id, telefoneE164: "+50688887777", email: "privado@example.test", documento: "DOCUMENTO_PRIVADO",
  } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: inicio,
  } });
  const alocacao = await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matricula.id, turmaId: origem.id, criadoEm: inicio } });
  const entradaAula = { turmaId: origem.id, ocorridaEm: new Date(Date.now() - 2 * DIA).toISOString(), conteudo: "Conversação com a turma de origem",
    registros: [{ alunoId: aluno.id, presente: true, observacao: "Participou da atividade" }],
  };
  const inicioAula = new Date(entradaAula.ocorridaEm);
  const encontro = comAgendaPublicada ? await prisma.encontroAgenda.create({ data: {
    turmaId: origem.id, professorId: professor.id, preparadorId: gestao.id, inicio: inicioAula,
    fim: new Date(inicioAula.getTime() + 60 * 60 * 1000), fusoOrigem: "UTC", status: "PREVISTO", finalidade: "AULA",
    motivo: "Aula conferida que compõe a frequência do fechamento.", chaveIdempotencia: "visibilidade-frequencia", entradaHash: "fixture-visibilidade-frequencia",
  } }) : null;
  const diario = await prisma.aulaDiario.create({ data: {
    ...(encontro ? { encontroId: encontro.id } : {}), turmaId: origem.id, professorId: professor.id, ocorridaEm: inicioAula, conteudo: entradaAula.conteudo,
    registros: { create: { alunoId: aluno.id, matriculaId: matricula.id, nomeAluno: "Ana Santos", presente: true, observacao: "Participou da atividade" } },
  } });
  if (encontro) await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
  const aulaId = diario.id;
  const { numero } = await seedCanal({ driver: "BAILEYS", estado: "ATIVA" });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: aluno.telefoneE164!, alunoId: aluno.id } });
  const atendimento = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "PEDAGOGICO", alunoId: aluno.id, turmaId: origem.id }));
  const segmentosMidia = ["whatsapp", "atividade-origem.pdf"];
  await prisma.mensagemWhatsApp.create({ data: {
    numeroId: numero.id, conversaId: atendimento.conversaId, atendimentoId: atendimento.id,
    direcao: "ENTRADA", driver: "BAILEYS", tipo: "DOCUMENTO", corpo: "Atividade da turma de origem", midiaPath: `/api/files/${segmentosMidia.join("/")}`,
  } });
  entrar(secretaria.id);
  const solicitacaoId = sucesso(await solicitarMudancaAcademica(aluno.id, { turmaDestinoId: destino.id, motivo: "Avaliar mudança de nível após desempenho demonstrado", horarioCompativel: true })).solicitacaoId;
  return { cat, secretaria, gestao, professor, sucessor, origem, destino, aluno, matricula, alocacao, agenda, entradaAula, aulaId, numero, contato, atendimento, segmentosMidia, solicitacaoId };
}

async function fecharSuficiente(c: Awaited<ReturnType<typeof cenario>>) {
  for (const codigoAvaliacao of ["I1", "F1"] as const) {
    const notas = codigoAvaliacao === "I1"
      ? [{ habilidade: "FALA" as const, nota: "8", comentarioAluno: "Resultado oficial suficiente de fala." }]
      : HABILIDADES.map(habilidade => ({ habilidade, nota: "8", comentarioAluno: `Resultado oficial suficiente de ${habilidade}.` }));
    entrar(c.professor.id);
    const salvo = sucesso(await salvarLancamentoAvaliacao({
      alocacaoId: c.alocacao.id, codigoAvaliacao, realizadaEm: new Date(Date.now() - DIA).toISOString(), notas,
      submetida: true, versaoEsperada: 0, chaveIdempotencia: `visibilidade-fechamento-${codigoAvaliacao}`,
    }));
    const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.id } });
    entrar(c.gestao.id);
    sucesso(await oficializarLancamentoAvaliacao({
      lancamentoId: lancamento.id, conteudoHash: lancamento.conteudoHash, aprovada: true,
      motivo: "Conferência independente da nota oficial antes da progressão.",
    }));
  }
  entrar(c.gestao.id);
  const revisao = sucesso(await revisarFechamentoAcademico({ alocacaoId: c.alocacao.id }));
  expect(revisao.elegibilidade).toMatchObject({ podeProgredir: true, pendencias: [] });
  sucesso(await confirmarFechamentoAcademico({
    alocacaoId: c.alocacao.id, estadoHash: revisao.estadoHash, versaoEsperada: revisao.versaoAtual,
    motivo: "Fechamento suficiente conferido antes da mudança de nível.", chaveIdempotencia: "visibilidade-fechamento-confirmado",
  }));
}

async function aprovar(c: Awaited<ReturnType<typeof cenario>>) {
  entrar(c.professor.id);
  sucesso(await registrarParecerMudanca(c.solicitacaoId, { conteudo: "O aluno demonstrou domínio do conteúdo e pode cursar o nível seguinte." }));
  await fecharSuficiente(c);
  entrar(c.gestao.id);
  sucesso(await decidirMudancaAcademica(c.solicitacaoId, { aprovar: true, motivo: "Parecer docente analisado e mudança de nível aprovada" }));
}

function sinal() {
  let liberar!: () => void;
  const promessa = new Promise<void>((resolve) => { liberar = resolve; });
  return { promessa, liberar };
}

async function bloquearAluno(alunoId: string) {
  const pronto = sinal();
  const liberar = sinal();
  let pid = 0;
  const transacao = prisma.$transaction(async (tx) => {
    const [conexao] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    pid = conexao.pid;
    await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${alunoId} FOR UPDATE`;
    pronto.liberar();
    await liberar.promessa;
  }, { timeout: 10000 });
  await Promise.race([pronto.promessa, transacao]);
  return { pid, soltar: async () => { liberar.liberar(); await transacao; } };
}

async function esperarBloqueados(pid: number, quantidade: number) {
  const limite = Date.now() + 3000;
  let esperas: { pid: number; consulta: string; bloqueadores: number[] }[] = [];
  while (Date.now() < limite) {
    // O primeiro waiter pode possuir o tuple lock enquanto aguarda a transação inicial.
    // O segundo espera esse waiter: seguir toda a cadeia, sem exigir bloqueio direto no holder.
    esperas = await prisma.$queryRaw<typeof esperas>`
      WITH RECURSIVE atividade AS MATERIALIZED (
        SELECT pid, query, wait_event_type, pg_blocking_pids(pid) AS bloqueadores
        FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()
      ), cadeia(pid) AS (
        SELECT pid FROM atividade WHERE ${pid} = ANY(bloqueadores)
        UNION
        SELECT seguinte.pid FROM atividade seguinte
        JOIN cadeia anterior ON anterior.pid = ANY(seguinte.bloqueadores)
      )
      SELECT atividade.pid, atividade.query AS consulta, atividade.bloqueadores
      FROM atividade JOIN cadeia ON cadeia.pid = atividade.pid
      WHERE atividade.wait_event_type = 'Lock' AND (
        atividade.query LIKE '%FROM "Aluno"%' OR atividade.query LIKE '%FROM "Matricula"%'
        OR atividade.query LIKE '%pg_advisory_xact_lock%calendario-escola%'
      )
    `;
    if (esperas.length >= quantidade) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect(esperas.length, `As ações devem alcançar a cadeia de locks do calendário, matrícula e aluno: ${JSON.stringify(esperas)}`).toBeGreaterThanOrEqual(quantidade);
  return esperas;
}

beforeEach(async () => {
  vi.clearAllMocks(); await truncarBanco();
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarMock.mockResolvedValue({ providerMessageId: "teste-sem-rede" });
});
afterEach(() => vi.unstubAllEnvs());

describe("mudança acadêmica revoga vínculos atuais e preserva o diário", () => {
  it("solicitar/aprovar preserva acesso; executar revoga ficha, conversa e mídia do professor anterior", async () => {
    const c = await cenario();
    expect(await carregarThread(c.professor, c.atendimento.id)).not.toBeNull();
    expect(await podeLerArquivo(c.professor, c.segmentosMidia)).toBe(true);
    await aprovar(c);
    expect(await obterAluno(c.aluno.id, c.professor)).not.toBeNull();
    expect(await carregarThread(c.professor, c.atendimento.id)).not.toBeNull();

    const alocacaoOriginal = await prisma.alocacaoTurma.findFirstOrThrow({ where: { alunoId: c.aluno.id, ativa: true } });
    const diarioAntes = await prisma.registroAulaAluno.findMany({ where: { aulaId: c.aulaId } });
    entrar(c.secretaria.id);
    sucesso(await executarMudancaAcademica(c.solicitacaoId, executarInput));
    await prisma.aluno.update({ where: { id: c.aluno.id }, data: { primeiroNome: "NOME_ATUAL_PRIVADO" } });

    expect(await obterAluno(c.aluno.id, c.professor)).toBeNull();
    expect(await listarAlunos(c.professor)).toEqual([]);
    expect(await carregarThread(c.professor, c.atendimento.id)).toBeNull();
    expect(await listarConversas(c.professor)).toEqual([]);
    expect(await podeLerArquivo(c.professor, c.segmentosMidia)).toBe(false);
    const seletorDiario = JSON.stringify(await listarTurmasParaDiario(c.professor));
    expect(seletorDiario).not.toContain(c.aluno.id);
    expect(seletorDiario).not.toContain("NOME_ATUAL_PRIVADO");
    entrar(c.professor.id);
    expect((await enviarTextoInbox({ conversaId: c.atendimento.id, texto: "Envio após a saída do aluno" })).ok).toBe(false);
    expect(enviarMock).not.toHaveBeenCalled();

    const historico = await listarAulasDiario(c.professor);
    expect(historico.aulas.map((a) => a.id)).toEqual([c.aulaId]);
    expect(historico.aulas[0].registros).toEqual([{ alunoId: c.aluno.id, nomeAluno: "Ana Santos", presente: true, participacao: null, observacao: "Participou da atividade", podeEditar: false }]);
    expect(JSON.stringify(historico)).not.toMatch(/NOME_ATUAL_PRIVADO|DOCUMENTO_PRIVADO|50688887777|privado@example/);
    expect((await salvarAulaDiario({ ...c.entradaAula, aulaId: c.aulaId, registros: [{ alunoId: c.aluno.id, presente: false }] })).ok).toBe(false);
    expect(await prisma.registroAulaAluno.findMany({ where: { aulaId: c.aulaId } })).toEqual(diarioAntes);
    expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoOriginal.id } })).toMatchObject({ ativa: false, turmaId: c.origem.id, encerradaEm: expect.any(Date) });
    const atual = await prisma.alocacaoTurma.findFirstOrThrow({ where: { alunoId: c.aluno.id, ativa: true } });
    expect(atual.id).not.toBe(alocacaoOriginal.id); expect(atual.turmaId).toBe(c.destino.id);

    expect(await obterAluno(c.aluno.id, c.sucessor)).not.toBeNull();
    expect((await listarAulasDiario(c.sucessor)).aulas).toEqual([]);
    expect(await carregarThread(c.sucessor, c.atendimento.id)).toBeNull();
    entrar(c.sucessor.id);
    const novo = sucesso(await abrirAtendimentoInstitucional({ numeroId: c.numero.id, destinoChave: `PEDAGOGICO:${c.aluno.id}:${c.destino.id}` }));
    expect(novo.id).not.toBe(c.atendimento.id);
    const thread = await carregarThread(c.sucessor, novo.id);
    expect(thread?.mensagens).toEqual([]);
    expect(thread?.contato.telefone).toBe("");
    expect(thread?.cobrancaAtiva).toBeNull();
  });

  it("mensagem humana pendente do professor anterior é cancelada no despacho após a execução", async () => {
    const c = await cenario(); await aprovar(c);
    const intencao = await prisma.intencaoMensagem.create({ data: { numeroId: c.numero.id, contatoId: c.contato.id, atendimentoId: c.atendimento.id,
      origem: "HUMANO", autorId: c.professor.id, corpoRenderizado: "Tarefa ainda enfileirada antes da mudança", tipo: "TEXTO",
    } });
    entrar(c.secretaria.id);
    sucesso(await executarMudancaAcademica(c.solicitacaoId, executarInput));
    await despacharFila();
    expect(enviarMock).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } })).toMatchObject({ status: "CANCELADA", motivoFalha: "atendimento_sem_acesso" });
    expect(await prisma.mensagemWhatsApp.count({ where: { atendimentoId: c.atendimento.id, direcao: "SAIDA" } })).toBe(0);
  });

  it("transferência concorrente preserva chamada anterior e recusa aula ocorrida após a saída", async () => {
    const c = await cenario(); await aprovar(c);
    const antes = await prisma.registroAulaAluno.findMany({ where: { aulaId: c.aulaId } });
    const bloqueio = await bloquearAluno(c.aluno.id);
    entrar(c.secretaria.id);
    const execucao = executarMudancaAcademica(c.solicitacaoId, executarInput);
    let escrita: ReturnType<typeof salvarAulaDiario> | null = null;
    try {
      const esperaExecucao = await esperarBloqueados(bloqueio.pid, 1);
      expect(esperaExecucao.some((e) => e.consulta.includes("FOR UPDATE"))).toBe(true);
      entrar(c.professor.id);
      escrita = salvarAulaDiario({ ...c.entradaAula, ocorridaEm: new Date(Date.now() - DIA).toISOString(), conteudo: "Chamada atrasada de aula anterior à transferência" });
      const ambas = await esperarBloqueados(bloqueio.pid, 2);
      expect(new Set(ambas.map((e) => e.pid)).size).toBe(2);
      // A execução já reteve calendário/matrícula antes de esperar o aluno.
      // O diário aguarda primeiro o calendário, respeitando a mesma ordem.
      expect(ambas.some((e) => e.consulta.includes('FROM "Aluno"') && e.consulta.includes("FOR UPDATE"))).toBe(true);
      expect(ambas.some((e) => e.consulta.includes("pg_advisory_xact_lock") && e.consulta.includes("calendario-escola"))).toBe(true);
    } finally {
      await bloqueio.soltar();
      await Promise.all([execucao, escrita]);
    }
    sucesso(await execucao);
    expect(await escrita).toMatchObject({ ok: true });
    expect(await salvarAulaDiario({ ...c.entradaAula, ocorridaEm: new Date().toISOString() })).toMatchObject({ ok: false, erro: expect.stringContaining("não pertence à turma") });
    expect(await prisma.aulaDiario.count({ where: { turmaId: c.origem.id } })).toBe(2);
    expect(await prisma.registroAulaAluno.findMany({ where: { aulaId: c.aulaId } })).toEqual(antes);
    expect((await prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id: c.solicitacaoId } })).status).toBe("EXECUTADA");
  });

  it("diário relê a atribuição docente alterada enquanto aguardava o aluno", async () => {
    // Este cenário verifica somente a releitura da atribuição. Não publica agenda,
    // pois mudança de professor em agenda publicada requer seu fluxo próprio.
    const c = await cenario({ comAgendaPublicada: false });
    const antes = await eventosDo("Turma", c.origem.id);
    const bloqueio = await bloquearAluno(c.aluno.id);
    entrar(c.professor.id);
    const escrita = salvarAulaDiario({ ...c.entradaAula, aulaId: c.aulaId, conteudo: "Tentativa após troca de professor" });
    try {
      await esperarBloqueados(bloqueio.pid, 1);
      entrar(c.gestao.id);
      sucesso(await editarTurma(c.origem.id, { ...c.agenda, nivelId: c.origem.nivelId, professorId: c.sucessor.id }));
    } finally {
      await bloqueio.soltar();
      await escrita;
    }
    expect(await escrita).toMatchObject({ ok: false, erro: expect.stringContaining("somente para leitura") });
    expect((await prisma.aulaDiario.findUniqueOrThrow({ where: { id: c.aulaId } })).conteudo).toBe(c.entradaAula.conteudo);
    expect((await eventosDo("Turma", c.origem.id)).filter((e) => e.tipo.startsWith("AulaDiario"))).toEqual(antes);
  });

  it.each(["papel", "desativação"] as const)("diário revalida %s revogado enquanto aguardava o aluno", async (revogacao) => {
    const c = await cenario();
    const antes = await eventosDo("Turma", c.origem.id);
    const bloqueio = await bloquearAluno(c.aluno.id);
    entrar(c.professor.id);
    const escrita = salvarAulaDiario({ ...c.entradaAula, aulaId: c.aulaId, conteudo: "Tentativa após revogação" });
    try {
      await esperarBloqueados(bloqueio.pid, 1);
      await prisma.usuario.update({ where: { id: c.professor.id }, data: revogacao === "papel" ? { papeis: [Papel.VENDEDOR] } : { ativo: false } });
    } finally {
      await bloqueio.soltar();
      await escrita;
    }
    expect(await escrita).toMatchObject({ ok: false, erro: expect.stringContaining("revogado") });
    expect((await prisma.aulaDiario.findUniqueOrThrow({ where: { id: c.aulaId } })).conteudo).toBe(c.entradaAula.conteudo);
    expect(await eventosDo("Turma", c.origem.id)).toEqual(antes);
  });
});
