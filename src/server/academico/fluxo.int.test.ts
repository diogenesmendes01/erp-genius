import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { receberTx } from "@/server/financeiro/recebimentos";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import type { Resultado } from "@/server/_shared";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { confirmarFechamentoAcademico, revisarFechamentoAcademico } from "@/server/avaliacoes/fechamento";
import { oficializarLancamentoAvaliacao, salvarLancamentoAvaliacao } from "@/server/avaliacoes/lancamentos";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "@/server/avaliacoes/regras-tx";
import { pausarAluno, trocarTurma } from "@/server/alunos/acoes";
import { decidirRetomada, solicitarRetomada } from "@/server/retomada/acoes";
import {
  cancelarMudancaAcademica, decidirMudancaAcademica, executarMudancaAcademica,
  registrarParecerMudanca, solicitarMudancaAcademica,
} from "./acoes";
import { listarContextoMudancaAcademica, listarSolicitacoesAcademicas } from "./consultas";
import { carregarEstadoAcademico } from "./estado";
import { montarSnapshotMudancaAcademica } from "./regras";

type Usuario = Awaited<ReturnType<typeof criarUsuario>>;
type Catalogo = Awaited<ReturnType<typeof seedCatalogoMinimo>>;
type Turma = Awaited<ReturnType<typeof prisma.turma.create>>;
let sec: Usuario;
let gp: Usuario;
let adm: Usuario;
let pro: Usuario;
let proAlheio: Usuario;
let catalogo: Catalogo;
let origem: Turma;
let destino: Turma;
let equivalente: Turma;
let alunoId: string;
let alocacaoId: string;
let matriculaId: string;
const DIA = 86_400_000;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const motivo = "Mudança de nível solicitada após acompanhamento pedagógico";
const parecer = "O aluno demonstrou domínio dos objetivos de A1 na avaliação oral e escrita.";
const dispensa = "Professor indisponível; gestão conferiu avaliação registrada previamente.";
const execucao = { motivo: "Execução conforme decisão pedagógica vigente", horarioCompativel: true as const };

function sucesso<T>(resultado: Resultado<T>) {
  expect(resultado.ok, resultado.ok ? undefined : resultado.erro).toBe(true);
  if (!resultado.ok) throw new Error(resultado.erro);
  return resultado.dado!;
}

async function criarTurma(nivelId: string, extra: Partial<Prisma.TurmaUncheckedCreateInput> = {}) {
  const { dataInicio: dataInicioFinal = new Date(Date.now() - 15 * DIA), dataFim: dataFimFinal = new Date(Date.now() + 100 * DIA), status: statusFinal = "EM_ANDAMENTO", ...dados } = extra;
  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId, professorId: pro.id,
    status: "ABERTA", capacidade: 10, diasSemana: [1, 3], horarioInicio: "18:00", horarioFim: "19:00",
    // A regra é vinculada somente quando a turma nasce futura e aberta; depois
    // esta fixture a coloca no mesmo estado histórico usado pelos cenários.
    dataInicio: new Date("2099-01-01T00:00:00.000Z"), dataFim: dataFimFinal, ...dados,
  } });
  return prisma.turma.update({ where: { id: turma.id }, data: { status: statusFinal, dataInicio: dataInicioFinal, dataFim: dataFimFinal } });
}

async function criarAluno(nome = "Aluno acadêmico", comMatricula = true) {
  const pessoa = await prisma.aluno.create({ data: {
    primeiroNome: nome, sobrenome: "Teste", paisId: catalogo.pais.id, status: "ATIVO",
    email: "contato-academico-privado@example.test", telefoneE164: "+50688889999",
    documento: "DOCUMENTO_ACADEMICO_PRIVADO", observacoes: "OBSERVACAO_ADMINISTRATIVA_PRIVADA",
  } });
  const alocacao = await prisma.alocacaoTurma.create({ data: {
    alunoId: pessoa.id, turmaId: origem.id, criadoEm: new Date(Date.now() - 10 * DIA),
  } });
  const matricula = comMatricula ? await prisma.matricula.create({ data: {
    alunoId: pessoa.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA",
    ativadaEm: new Date(Date.now() - 12 * DIA), nivelInicialId: origem.nivelId, origemNivel: "AVALIACAO", dataAvaliacaoNivel: new Date(Date.now() - 12 * DIA),
  } }) : null;
  if (matricula) await prisma.alocacaoTurma.update({ where: { id: alocacao.id }, data: { matriculaId: matricula.id } });
  return { pessoa, alocacao, matricula };
}

const alocacoes = (id = alunoId) => prisma.alocacaoTurma.findMany({ where: { alunoId: id }, orderBy: { id: "asc" } });
const movimentos = (id = alunoId) => prisma.movimentacaoAluno.findMany({ where: { alunoId: id, tipo: "TROCA_TURMA" }, orderBy: { id: "asc" } });
const memorizarContrato = () => Promise.all([
  prisma.matricula.findMany({ where: { alunoId }, orderBy: { id: "asc" } }),
  prisma.cobranca.findMany({ where: { matricula: { alunoId } }, orderBy: { id: "asc" } }),
  prisma.recebimento.findMany({ where: { cobranca: { matricula: { alunoId } } }, orderBy: { id: "asc" } }),
  prisma.comissao.findMany({ where: { matricula: { alunoId } }, orderBy: { id: "asc" } }),
]);

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
  sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria acadêmica");
  gp = await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão pedagógica");
  adm = await criarUsuario([Papel.ADMINISTRADOR], "Direção");
  pro = await criarUsuario([Papel.PROFESSOR], "Professor responsável");
  proAlheio = await criarUsuario([Papel.PROFESSOR], "Professor de outra turma");
  catalogo = await seedCatalogoMinimo();
  const a1 = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const b2 = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "B2", ordem: 4 } });
  await publicarRegra(a1.id, "regra-fluxo-a1");
  await publicarRegra(b2.id, "regra-fluxo-b2");
  origem = await criarTurma(a1.id, { nome: "Origem A1" });
  destino = await criarTurma(b2.id, { nome: "Destino B2", professorId: proAlheio.id, diasSemana: [2, 4] });
  equivalente = await criarTurma(a1.id, { nome: "Equivalente A1", professorId: proAlheio.id, diasSemana: [2, 4] });
  await prisma.vinculoDocente.createMany({ data: [
    { turmaId: origem.id, professorId: pro.id, inicio: new Date(Date.now() - 30 * DIA) },
    { turmaId: destino.id, professorId: proAlheio.id, inicio: new Date(Date.now() - 30 * DIA) },
    { turmaId: equivalente.id, professorId: proAlheio.id, inicio: new Date(Date.now() - 30 * DIA) },
  ] });
  const c = await criarAluno();
  alunoId = c.pessoa.id; alocacaoId = c.alocacao.id; matriculaId = c.matricula!.id;
  const cobranca = await prisma.cobranca.create({ data: {
    matriculaId, tipo: "MENSALIDADE", status: "PENDENTE", moeda: "CRC", competencia: "2026-10",
    valorOriginal: 123.45, valorNegociado: 123.45, valorRecebido: 0, saldo: 123.45,
    vencimento: new Date(Date.now() + 40 * DIA),
  } });
  await prisma.$transaction(tx => receberTx(tx, {
    cobrancaId: cobranca.id, valorRecebido: 23.4, forma: "TRANSFERENCIA", dataPagamento: new Date(),
    autorId: adm.id, chaveIdempotencia: "pagamento-academico-fixture", evidencia: "Pagamento acadêmico conferido na fixture.",
  }));
  await prisma.comissao.create({ data: {
    matriculaId, vendedorId: adm.id, percentual: 10, valor: 12.35, moeda: "CRC", status: "PAGA", pagaEm: new Date(),
  } });
  entrar(sec.id);
});

const pedido = (id: string) => prisma.solicitacaoMudancaAcademica.findUniqueOrThrow({ where: { id } });
const pareceres = (id: string) => prisma.parecerMudancaAcademica.findMany({ where: { solicitacaoId: id }, orderBy: { id: "asc" } });
async function solicitar(idAluno = alunoId, autorId = sec.id, idDestino = destino.id) {
  entrar(autorId);
  return sucesso(await solicitarMudancaAcademica(idAluno, { turmaDestinoId: idDestino, motivo, horarioCompativel: true })).solicitacaoId;
}
async function opinar(id: string) {
  entrar(pro.id);
  return sucesso(await registrarParecerMudanca(id, { conteudo: parecer }));
}
async function publicarRegra(nivelId: string, chaveIdempotencia: string) {
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gp.id, {
    nivelId, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(),
    motivo: "Regra publicada para a fixture de fechamento suficiente.", chaveIdempotencia,
  }));
  const persistida = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, adm.id, {
    regraId: regra.id, conteudoHash: persistida.conteudoHash, aprovada: true,
    motivo: "Publicação independente da regra da fixture de mudança acadêmica.",
  }));
}

async function oficializarNotasSuficientes(alocacao: { id: string; matriculaId: string | null }) {
  if (!alocacao.matriculaId) throw new Error("A fixture de progressão exige matrícula identificada.");
  for (const codigoAvaliacao of ["I1", "F1"] as const) {
    const notas = codigoAvaliacao === "I1"
      ? [{ habilidade: "FALA" as const, nota: "8", comentarioAluno: "Resultado oficial suficiente de fala." }]
      : HABILIDADES.map(habilidade => ({ habilidade, nota: "8", comentarioAluno: `Resultado oficial suficiente de ${habilidade}.` }));
    entrar(pro.id);
    const salvo = sucesso(await salvarLancamentoAvaliacao({
      alocacaoId: alocacao.id, codigoAvaliacao, realizadaEm: new Date(Date.now() - DIA).toISOString(), notas,
      submetida: true, versaoEsperada: 0, chaveIdempotencia: `fechamento-${alocacao.id}-${codigoAvaliacao}`,
    }));
    const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.id } });
    entrar(gp.id);
    sucesso(await oficializarLancamentoAvaliacao({
      lancamentoId: lancamento.id, conteudoHash: lancamento.conteudoHash, aprovada: true,
      motivo: "Conferência independente da nota oficial da fixture de progressão.",
    }));
  }
}

async function registrarFrequenciaSuficiente(alocacao: { id: string; matriculaId: string | null; alunoId: string; turmaId: string }) {
  if (!alocacao.matriculaId) throw new Error("A fixture de progressão exige matrícula identificada.");
  const anterior = await prisma.encontroAgenda.findFirst({ where: {
    turmaId: alocacao.turmaId, finalidade: "AULA", status: "MINISTRADO", fim: { lt: new Date() }, diario: { isNot: null },
  }, orderBy: [{ inicio: "asc" }, { id: "asc" }], select: { diario: { select: { id: true } } } });
  if (anterior?.diario) {
    // A chamada foi preenchida integralmente antes da conclusão; não reescrever
    // a fonte depois que o fechamento do primeiro aluno já foi conferido.
    const registro = await prisma.registroAulaAluno.findUniqueOrThrow({
      where: { aulaId_alunoId: { aulaId: anterior.diario.id, alunoId: alocacao.alunoId } },
    });
    expect(registro).toMatchObject({ matriculaId: alocacao.matriculaId, presente: true, participacao: "PRESENTE" });
    return;
  }
  const inicioAula = new Date(Date.now() - 2 * DIA);
  const participantes = await prisma.alocacaoTurma.findMany({ where: { turmaId: alocacao.turmaId, matriculaId: { not: null },
    criadoEm: { lte: inicioAula }, OR: [{ encerradaEm: null }, { encerradaEm: { gt: inicioAula } }] } });
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId: alocacao.turmaId, professorId: pro.id, preparadorId: gp.id,
    inicio: inicioAula, fim: new Date(inicioAula.getTime() + 60 * 60 * 1000), fusoOrigem: "UTC",
    status: "PREVISTO", finalidade: "AULA", motivo: "Aula ministrada da fixture de fechamento.",
    chaveIdempotencia: `fechamento-frequencia-${alocacao.id}`, entradaHash: `fixture-${alocacao.id}`,
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: encontro.id, turmaId: alocacao.turmaId, professorId: pro.id, ocorridaEm: inicioAula,
    conteudo: "Aula com presença conferida para fechamento acadêmico.",
    registros: { create: participantes.map(p => ({ alunoId: p.alunoId, matriculaId: p.matriculaId, nomeAluno: "Aluno acadêmico", presente: true, participacao: "PRESENTE" })) },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
}

async function garantirFechamentoSuficiente(solicitacaoId: string) {
  const solicitacao = await pedido(solicitacaoId);
  const alocacao = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: solicitacao.alocacaoOrigemId } });
  if (!alocacao.matriculaId) return;
  const existente = await prisma.fechamentoAcademico.findFirst({ where: { matriculaId: alocacao.matriculaId }, orderBy: { versao: "desc" } });
  if (existente?.resultadoSuficiente) return;
  await oficializarNotasSuficientes(alocacao);
  await registrarFrequenciaSuficiente(alocacao);
  entrar(gp.id);
  const revisao = sucesso(await revisarFechamentoAcademico({ alocacaoId: alocacao.id }));
  expect(revisao.elegibilidade).toMatchObject({ podeProgredir: true, pendencias: [] });
  sucesso(await confirmarFechamentoAcademico({
    alocacaoId: alocacao.id, estadoHash: revisao.estadoHash, versaoEsperada: revisao.versaoAtual,
    motivo: "Fechamento suficiente conferido antes da decisão de mudança de nível.", chaveIdempotencia: `fechamento-confirmado-${alocacao.id}`,
  }));
}

async function aprovar(id: string, autorId = gp.id, dispensar = false) {
  await garantirFechamentoSuficiente(id);
  entrar(autorId);
  sucesso(await decidirMudancaAcademica(id, { aprovar: true, motivo: "Decisão pedagógica fundamentada", ...(dispensar ? { justificativaDispensaParecer: dispensa } : {}) }));
}
async function pedidoAprovado(idAluno = alunoId) {
  const id = await solicitar(idAluno);
  await opinar(id);
  await aprovar(id);
  return id;
}

describe("solicitação, parecer, decisão e execução separados", () => {
  it("mantém pedidos abertos independentes por contrato e impede duplicação no mesmo contrato", async () => {
    const outra = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
    const vinculo = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: outra.id, turmaId: equivalente.id } });
    const primeiraEntrada = { matriculaId, alocacaoOrigemId: alocacaoId, turmaDestinoId: destino.id, motivo, horarioCompativel: true as const };
    const segundaEntrada = { ...primeiraEntrada, matriculaId: outra.id, alocacaoOrigemId: vinculo.id };
    const [primeira, segunda] = await Promise.all([solicitarMudancaAcademica(alunoId, primeiraEntrada), solicitarMudancaAcademica(alunoId, segundaEntrada)]);
    const id1 = sucesso(primeira).solicitacaoId, id2 = sucesso(segunda).solicitacaoId;
    expect(id1).not.toBe(id2);
    expect(sucesso(await solicitarMudancaAcademica(alunoId, primeiraEntrada)).solicitacaoId).toBe(id1);
    expect((await solicitarMudancaAcademica(alunoId, { ...primeiraEntrada, motivo: "Outra justificativa para pedido concorrente" })).ok).toBe(false);
    expect(await prisma.solicitacaoMudancaAcademica.count({ where: { alunoId, status: "PENDENTE" } })).toBe(2);
    const preservada = await pedido(id2);
    const original = await pedido(id1);
    await expect(prisma.solicitacaoMudancaAcademica.create({ data: { alunoId, matriculaId, alocacaoOrigemId: alocacaoId, turmaOrigemId: origem.id, turmaDestinoId: destino.id, motivo, horarioCompativel: true, solicitanteId: sec.id, snapshot: original.snapshot! } })).rejects.toThrow();
    await expect(prisma.solicitacaoMudancaAcademica.update({ where: { id: id1 }, data: { matriculaId: outra.id } })).rejects.toThrow(/preservada/);
    sucesso(await cancelarMudancaAcademica(id1, { motivo: "Cancelamento apenas do primeiro contrato" }));
    expect(await pedido(id2)).toEqual(preservada);
    expect(sucesso(await listarContextoMudancaAcademica(alunoId, outra.id)).pedidoAbertoId).toBe(id2);
  });

  it.each(["PAUSADO", "ENCERRADO"] as const)("movimenta o contrato ativo com cadastro global %s, preservando os demais dados", async status => {
    await prisma.aluno.update({ where: { id: alunoId }, data: { status } });
    const financeiro = await memorizarContrato();
    const contexto = sucesso(await listarContextoMudancaAcademica(alunoId, matriculaId));
    expect(contexto).toMatchObject({ status, podeSolicitar: true, impedimento: null });
    const id = sucesso(await solicitarMudancaAcademica(alunoId, { matriculaId, alocacaoOrigemId: alocacaoId, turmaDestinoId: destino.id, motivo, horarioCompativel: true })).solicitacaoId;
    expect((await pedido(id)).snapshot).toMatchObject({ versao: 2, statusAluno: null });
    await opinar(id); await aprovar(id); entrar(sec.id);
    sucesso(await executarMudancaAcademica(id, execucao));
    expect((await alocacoes()).find(a => a.ativa)).toMatchObject({ matriculaId, turmaId: destino.id });
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: alunoId } })).status).toBe(status);
    expect(await memorizarContrato()).toEqual(financeiro);
  });

  it("não atribui pedido legado ao contrato identificado posteriormente na alocação", async () => {
    await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { matriculaId: null } });
    const id = await solicitar();
    expect((await pedido(id)).matriculaId).toBeNull();
    await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { matriculaId } });
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId })).solicitacoes.map(s => s.id)).toEqual([id]);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId, matriculaId })).solicitacoes).toEqual([]);
    expect((await listarSolicitacoesAcademicas({ alunoId, matriculaId, antesDe: id })).ok).toBe(false);
    expect(sucesso(await listarContextoMudancaAcademica(alunoId, matriculaId)).pedidoAbertoId).toBeNull();
    expect((await pedido(id)).matriculaId).toBeNull();
  });

  it("filtra histórico e cursor pelo contrato sem ampliar o acesso docente", async () => {
    const primeira = sucesso(await solicitarMudancaAcademica(alunoId, { matriculaId, alocacaoOrigemId: alocacaoId, turmaDestinoId: destino.id, motivo, horarioCompativel: true })).solicitacaoId;
    sucesso(await cancelarMudancaAcademica(primeira, { motivo: "Aluno desistiu desta mudança" }));
    await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { ativa: false, encerradaEm: new Date() } });
    const outra = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
    // Regularizar a referência da alocação antiga não transfere o pedido histórico.
    await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { matriculaId: outra.id } });
    const vinculo = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: outra.id, turmaId: origem.id } });
    const segunda = sucesso(await solicitarMudancaAcademica(alunoId, { matriculaId: outra.id, alocacaoOrigemId: vinculo.id, turmaDestinoId: destino.id, motivo, horarioCompativel: true })).solicitacaoId;
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId })).solicitacoes.map(s => s.id)).toEqual([segunda, primeira]);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId, matriculaId })).solicitacoes.map(s => s.id)).toEqual([primeira]);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId, matriculaId, apenasAbertas: true })).solicitacoes).toEqual([]);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId, matriculaId: outra.id })).solicitacoes.map(s => s.id)).toEqual([segunda]);
    expect((await listarSolicitacoesAcademicas({ alunoId, matriculaId, antesDe: segunda })).ok).toBe(false);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId, matriculaId, antesDe: primeira })).solicitacoes).toEqual([]);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId: "outro-aluno", matriculaId })).solicitacoes).toEqual([]);
    expect((await listarSolicitacoesAcademicas({ matriculaId: " " })).ok).toBe(false);
    entrar(pro.id);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId, matriculaId })).solicitacoes).toEqual([]);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId, matriculaId: outra.id })).solicitacoes.map(s => s.id)).toEqual([segunda]);
    entrar(proAlheio.id);
    expect(sucesso(await listarSolicitacoesAcademicas({ matriculaId: outra.id })).solicitacoes).toEqual([]);
    expect((await listarSolicitacoesAcademicas({ matriculaId: outra.id, antesDe: segunda })).ok).toBe(false);
  });

  it.each([true, false])("mantém o contrato durante parecer, aprovação e execução; seleção explícita=%s", async (explicita) => {
    const outra = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
    entrar(sec.id);
    expect((await solicitarMudancaAcademica(alunoId, { matriculaId: outra.id, turmaDestinoId: destino.id, motivo, horarioCompativel: true })).ok).toBe(false);
    const { solicitacaoId: id } = sucesso(await solicitarMudancaAcademica(alunoId, { matriculaId: explicita ? matriculaId : undefined, alocacaoOrigemId: alocacaoId, turmaDestinoId: destino.id, motivo, horarioCompativel: true }));
    expect((await pedido(id)).snapshot).toMatchObject({ escopoMatriculaId: matriculaId, matriculas: [{ id: matriculaId }] });
    const contextoSelecionado = sucesso(await listarContextoMudancaAcademica(alunoId, matriculaId));
    expect(contextoSelecionado).toMatchObject({ origem: { matriculaId, alocacaoId }, pedidoAbertoId: id });
    const contextoSemVinculo = sucesso(await listarContextoMudancaAcademica(alunoId, outra.id));
    expect(contextoSemVinculo).toMatchObject({ origem: null, pedidoAbertoId: null, podeSolicitar: false, podeTransferirEquivalente: false });
    expect(contextoSemVinculo.destinos).toEqual([]);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId, matriculaId })).solicitacoes.map(s => s.id)).toEqual([id]);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId, matriculaId: outra.id })).solicitacoes).toEqual([]);
    expect((await listarSolicitacoesAcademicas({ alunoId, matriculaId: outra.id, antesDe: id })).ok).toBe(false);
    const vinculoOutroContrato = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId: outra.id, turmaId: equivalente.id } });
    const semSelecao = sucesso(await listarContextoMudancaAcademica(alunoId));
    expect(semSelecao).toMatchObject({ origem: null, podeSolicitar: false, podeTransferirEquivalente: false });
    expect((await solicitarMudancaAcademica(alunoId, { turmaDestinoId: destino.id, motivo, horarioCompativel: true })).ok).toBe(false);
    expect(await prisma.solicitacaoMudancaAcademica.count({ where: { alunoId } })).toBe(1);
    await prisma.matricula.update({ where: { id: outra.id }, data: { status: "PAUSADA" } });
    await prisma.movimentacaoAluno.create({ data: { alunoId, matriculaId: outra.id, tipo: "PAUSA", motivo: "Pausa do segundo contrato" } });
    await opinar(id);
    await aprovar(id);
    entrar(sec.id);
    sucesso(await executarMudancaAcademica(id, execucao));
    expect((await alocacoes()).find((a) => a.ativa && a.matriculaId === matriculaId)).toMatchObject({ matriculaId, turmaId: destino.id });
    expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: vinculoOutroContrato.id } })).toEqual(vinculoOutroContrato);
    expect(await prisma.movimentacaoAluno.findMany({ where: { alunoId, matriculaId } })).toMatchObject([{ tipo: "TROCA_TURMA", matriculaId }]);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: outra.id } })).status).toBe("PAUSADA");
  });

  it.each([1, 2])("conserva memória de proposta existente sem escopo contratual na versão %s", async (versao) => {
    const outra = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
    const estadoAntigo = await carregarEstadoAcademico(prisma, alunoId, destino.id);
    const memoriaAntiga = { ...montarSnapshotMudancaAcademica(estadoAntigo), versao, statusAluno: versao === 1 ? "ATIVO" : null };
    const id = await solicitar();
    await prisma.solicitacaoMudancaAcademica.update({ where: { id }, data: { snapshot: memoriaAntiga } });
    expect(await solicitar()).toBe(id);
    expect((await pedido(id)).snapshot).toEqual(memoriaAntiga);
    await prisma.matricula.update({ where: { id: outra.id }, data: { status: "PAUSADA" } });
    expect((await solicitarMudancaAcademica(alunoId, { turmaDestinoId: destino.id, motivo, horarioCompativel: true })).ok).toBe(false);
    expect((await pedido(id)).snapshot).toEqual(memoriaAntiga);
    expect(await prisma.solicitacaoMudancaAcademica.count({ where: { alunoId } })).toBe(1);
  });

  it.each([Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR])("%s solicita sem alterar turma, situação ou contrato", async (papel) => {
    const autor = await criarUsuario([papel]);
    const antes = await alocacoes();
    const financeiro = await memorizarContrato();
    const id = await solicitar(alunoId, autor.id);
    expect(await pedido(id)).toMatchObject({ status: "PENDENTE", solicitanteId: autor.id, aprovadorId: null, executorId: null, alocacaoOrigemId: alocacaoId, turmaOrigemId: origem.id, turmaDestinoId: destino.id });
    expect(await alocacoes()).toEqual(antes);
    expect(await memorizarContrato()).toEqual(financeiro);
    expect(await movimentos()).toHaveLength(0);
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: alunoId } })).status).toBe("ATIVO");
  });

  it("aprovação não move o aluno; execução preserva valores, recebimentos, nível inicial e histórico", async () => {
    const antes = await alocacoes();
    const financeiro = await memorizarContrato();
    const id = await solicitar();
    await opinar(id);
    await aprovar(id);
    expect(await pedido(id)).toMatchObject({ status: "APROVADA", aprovadorId: gp.id, executorId: null, decididoEm: expect.any(Date) });
    expect(await alocacoes()).toEqual(antes);
    expect(await memorizarContrato()).toEqual(financeiro);
    expect(await movimentos()).toHaveLength(0);
    entrar(sec.id);
    sucesso(await executarMudancaAcademica(id, execucao));
    const depois = await alocacoes();
    expect(depois).toHaveLength(2);
    expect(depois.find((a) => a.id === alocacaoId)).toMatchObject({ matriculaId, turmaId: origem.id, ativa: false, encerradaEm: expect.any(Date), criadoEm: antes[0].criadoEm });
    expect(depois.find((a) => a.ativa)).toMatchObject({ matriculaId });
    expect(depois.find((a) => a.ativa)).toMatchObject({ turmaId: destino.id, alunoId, encerradaEm: null });
    expect(depois.find((a) => a.ativa)!.id).not.toBe(alocacaoId);
    expect(await memorizarContrato()).toEqual(financeiro);
    expect(await pedido(id)).toMatchObject({ status: "EXECUTADA", solicitanteId: sec.id, aprovadorId: gp.id, executorId: sec.id, motivoExecucao: execucao.motivo, executadoEm: expect.any(Date) });
    expect(await movimentos()).toEqual([expect.objectContaining({ usuarioId: sec.id, turmaOrigemId: origem.id, turmaDestinoId: destino.id })]);
    expect((await pedido(id)).movimentacaoId).toBe((await movimentos())[0].id);
    expect((await eventosDo("Aluno", alunoId)).filter((e) => e.tipo === "TrocaTurma")).toHaveLength(1);
    expect(await pareceres(id)).toEqual([expect.objectContaining({ autorId: pro.id, conteudo: parecer })]);
  });

  it("sem parecer exige dispensa motivada; dispensa não representa um parecer docente", async () => {
    const id = await solicitar();
    entrar(gp.id);
    expect((await decidirMudancaAcademica(id, { aprovar: true, motivo })).ok).toBe(false);
    expect((await decidirMudancaAcademica(id, { aprovar: true, motivo, justificativaDispensaParecer: "   " })).ok).toBe(false);
    expect((await pedido(id)).status).toBe("PENDENTE");
    await aprovar(id, gp.id, true);
    expect(await pedido(id)).toMatchObject({ status: "APROVADA", justificativaDispensaParecer: dispensa });
    expect(await pareceres(id)).toEqual([]);
    expect((await alocacoes()).filter((a) => a.ativa).map((a) => a.turmaId)).toEqual([origem.id]);
  });

  it("rejeição independe de parecer e libera um novo pedido, conservando a decisão anterior", async () => {
    const id = await solicitar();
    entrar(gp.id);
    sucesso(await decidirMudancaAcademica(id, { aprovar: false, motivo: "Aluno precisa concluir os objetivos do nível atual" }));
    expect(await pedido(id)).toMatchObject({ status: "REJEITADA", aprovadorId: gp.id, motivoDecisao: "Aluno precisa concluir os objetivos do nível atual" });
    entrar(sec.id);
    expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    const novoId = await solicitar();
    expect(novoId).not.toBe(id);
    expect((await pedido(id)).status).toBe("REJEITADA");
    expect(await movimentos()).toHaveLength(0);
  });

  it.each([Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR])("%s executa uma aprovação independente sem exigir terceira pessoa", async (papel) => {
    const id = await solicitar();
    await opinar(id);
    await aprovar(id, adm.id);
    entrar(papel === Papel.ADMINISTRADOR ? adm.id : sec.id);
    sucesso(await executarMudancaAcademica(id, execucao));
    expect((await pedido(id)).executorId).toBe(papel === Papel.ADMINISTRADOR ? adm.id : sec.id);
    expect(await movimentos()).toHaveLength(1);
  });

  it("GP solicitante pode ser aprovado por outro GP; acúmulo de papéis não autoriza autoaprovação", async () => {
    const id = await solicitar(alunoId, gp.id);
    const outroGp = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
    await prisma.usuario.update({ where: { id: gp.id }, data: { papeis: [Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA] } });
    entrar(gp.id);
    expect((await decidirMudancaAcademica(id, { aprovar: true, motivo, justificativaDispensaParecer: dispensa })).ok).toBe(false);
    expect((await pedido(id)).status).toBe("PENDENTE");
    await aprovar(id, outroGp.id, true);
    expect((await pedido(id)).aprovadorId).toBe(outroGp.id);
  });

  it("parecer repetido é idempotente e não pode ser reescrito depois da decisão", async () => {
    const id = await solicitar();
    await opinar(id);
    const antes = await pareceres(id);
    sucesso(await registrarParecerMudanca(id, { conteudo: parecer }));
    expect(await pareceres(id)).toEqual(antes);
    await aprovar(id);
    entrar(pro.id);
    expect((await registrarParecerMudanca(id, { conteudo: "Parecer alterado depois da aprovação" })).ok).toBe(false);
    expect(await pareceres(id)).toEqual(antes);
  });

  it.each(["PENDENTE", "APROVADA"] as const)("cancelamento motivado de %s preserva histórico e libera a fila", async (status) => {
    const id = await solicitar();
    if (status === "APROVADA") await aprovar(id, gp.id, true);
    entrar(sec.id);
    const antes = await alocacoes();
    expect((await cancelarMudancaAcademica(id, { motivo: "   " })).ok).toBe(false);
    sucesso(await cancelarMudancaAcademica(id, { motivo: "Aluno desistiu desta mudança de horário" }));
    expect(await pedido(id)).toMatchObject({ status: "CANCELADA", canceladorId: sec.id, motivoCancelamento: "Aluno desistiu desta mudança de horário", canceladoEm: expect.any(Date) });
    expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    expect(await alocacoes()).toEqual(antes);
    expect(await solicitar()).not.toBe(id);
  });
});

describe("papéis, vínculos e projeções acadêmicas", () => {
  it.each([Papel.PROFESSOR, Papel.VENDEDOR, Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL])("%s não abre pedido excepcional", async (papel) => {
    const usuario = await criarUsuario([papel]);
    entrar(usuario.id);
    expect((await solicitarMudancaAcademica(alunoId, { turmaDestinoId: destino.id, motivo, horarioCompativel: true })).ok).toBe(false);
    expect(await prisma.solicitacaoMudancaAcademica.count()).toBe(0);
  });

  it("professor atual vê somente a projeção acadêmica e só pode emitir parecer", async () => {
    const id = await solicitar();
    entrar(pro.id);
    const lista = sucesso(await listarSolicitacoesAcademicas({ alunoId }));
    expect(lista.solicitacoes).toEqual([expect.objectContaining({ id, podeDarParecer: true, podeDecidir: false, podeExecutar: false, podeCancelar: false })]);
    expect(JSON.stringify(lista)).not.toMatch(/contato-academico-privado|50688889999|DOCUMENTO_ACADEMICO_PRIVADO|OBSERVACAO_ADMINISTRATIVA_PRIVADA|123\.45|23\.4|100\.05|telefoneE164|recebimentos|comissoes|snapshot/);
    expect((await decidirMudancaAcademica(id, { aprovar: true, motivo })).ok).toBe(false);
    expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    expect((await cancelarMudancaAcademica(id, { motivo })).ok).toBe(false);
    sucesso(await registrarParecerMudanca(id, { conteudo: parecer }));
  });

  it("professor alheio não obtém pedido conhecido nem publica parecer por ID", async () => {
    const id = await solicitar();
    entrar(proAlheio.id);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId })).solicitacoes).toEqual([]);
    expect((await listarContextoMudancaAcademica(alunoId)).ok).toBe(false);
    expect((await registrarParecerMudanca(id, { conteudo: parecer })).ok).toBe(false);
    expect(await pareceres(id)).toEqual([]);
  });

  it("fim do vínculo docente revoga consulta e parecer mesmo com turma professorId legado", async () => {
    const id = await solicitar();
    await prisma.vinculoDocente.updateMany({ where: { turmaId: origem.id, professorId: pro.id, fim: null }, data: { fim: new Date(Date.now() - 1_000) } });
    entrar(pro.id);
    expect(sucesso(await listarSolicitacoesAcademicas({ alunoId })).solicitacoes).toEqual([]);
    expect((await registrarParecerMudanca(id, { conteudo: parecer })).ok).toBe(false);
  });

  it.each(["papel revogado", "usuário desativado"])("parecer histórico de professor com %s exige dispensa para nova aprovação", async (alteracao) => {
    const id = await solicitar();
    await opinar(id);
    // A avaliação e o fechamento pertencem ao momento em que o docente ainda está ativo.
    await garantirFechamentoSuficiente(id);
    const historico = await pareceres(id);
    await prisma.usuario.update({ where: { id: pro.id }, data: alteracao === "papel revogado" ? { papeis: [Papel.VENDEDOR] } : { ativo: false } });
    entrar(gp.id);
    const lista = sucesso(await listarSolicitacoesAcademicas({ alunoId }));
    expect(lista.solicitacoes).toEqual([expect.objectContaining({ id, temParecerVigente: false, pareceres: [expect.objectContaining({ conteudo: parecer })] })]);
    expect((await decidirMudancaAcademica(id, { aprovar: true, motivo })).ok).toBe(false);
    expect((await pedido(id)).status).toBe("PENDENTE");
    await aprovar(id, gp.id, true);
    expect(await pedido(id)).toMatchObject({ status: "APROVADA", justificativaDispensaParecer: dispensa });
    expect(await pareceres(id)).toEqual(historico);
    entrar(sec.id);
    sucesso(await executarMudancaAcademica(id, execucao));
    expect((await pedido(id)).status).toBe("EXECUTADA");
    expect(await pareceres(id)).toEqual(historico);
  });

  it("GP aprova mas não executa sem papel de secretaria; financeiro não recebe a fila acadêmica", async () => {
    const id = await pedidoAprovado();
    entrar(gp.id);
    expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    const fin = await criarUsuario([Papel.FINANCEIRO]);
    entrar(fin.id);
    expect((await listarSolicitacoesAcademicas()).ok).toBe(false);
    expect((await listarContextoMudancaAcademica(alunoId)).ok).toBe(false);
    expect((await registrarParecerMudanca(id, { conteudo: parecer })).ok).toBe(false);
    expect(await movimentos()).toHaveLength(0);
  });

  it("usuário sem papel e sessão inválida não consultam ou alteram pedidos por ID", async () => {
    const id = await solicitar();
    const semPapel = await criarUsuario([]);
    for (const usuarioId of [semPapel.id, "usuario-inexistente"]) {
      entrar(usuarioId);
      expect((await listarSolicitacoesAcademicas({ alunoId })).ok).toBe(false);
      expect((await registrarParecerMudanca(id, { conteudo: parecer })).ok).toBe(false);
      expect((await decidirMudancaAcademica(id, { aprovar: true, motivo, justificativaDispensaParecer: dispensa })).ok).toBe(false);
      expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    }
    expect((await pedido(id)).status).toBe("PENDENTE");
  });

  it("IDs adversariais não viram aluno, turma, aprovação ou execução válidos", async () => {
    const id = await solicitar();
    const antes = { pedido: await pedido(id), alocacoes: await alocacoes(), eventos: await eventosDo("Aluno", alunoId) };
    const inexistentes = ["inexistente", "' OR 1=1 --"];
    for (const invalido of [...inexistentes, destino.id, alocacaoId, id]) {
      entrar(sec.id);
      expect((await solicitarMudancaAcademica(invalido, { turmaDestinoId: destino.id, motivo, horarioCompativel: true })).ok).toBe(false);
    }
    for (const invalido of [...inexistentes, alunoId, alocacaoId, id]) {
      entrar(sec.id);
      expect((await solicitarMudancaAcademica(alunoId, { turmaDestinoId: invalido, motivo, horarioCompativel: true })).ok).toBe(false);
    }
    for (const invalido of [...inexistentes, alunoId, destino.id, alocacaoId]) {
      entrar(sec.id);
      expect((await executarMudancaAcademica(invalido, execucao)).ok).toBe(false);
      entrar(gp.id);
      expect((await decidirMudancaAcademica(invalido, { aprovar: true, motivo, justificativaDispensaParecer: dispensa })).ok).toBe(false);
    }
    entrar(sec.id);
    expect(sucesso(await solicitarMudancaAcademica(alunoId, { turmaDestinoId: destino.id, motivo, horarioCompativel: true })).solicitacaoId).toBe(id);
    expect(await prisma.solicitacaoMudancaAcademica.count()).toBe(1);
    expect((await pedido(id)).status).toBe("PENDENTE");
    expect(await movimentos()).toHaveLength(0);
    expect({ pedido: await pedido(id), alocacoes: await alocacoes(), eventos: await eventosDo("Aluno", alunoId) }).toEqual(antes);
  });
});

describe("movimentação equivalente e limite contratual da exceção", () => {
  it("troca direta não utiliza outra matrícula, nem transfere a alocação escolhida", async () => {
    entrar(sec.id);
    const outra = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } });
    const entrada = { turmaDestinoId: equivalente.id, justificativa: "Transferência do contrato escolhido", horarioCompativel: true as const };
    expect((await trocarTurma(alunoId, { ...entrada, matriculaId: outra.id })).ok).toBe(false);
    expect((await trocarTurma(alunoId, { ...entrada, matriculaId: "contrato-inexistente" })).ok).toBe(false);
    expect((await trocarTurma(alunoId, { ...entrada, matriculaId, alocacaoOrigemId: "origem-substituida" })).ok).toBe(false);
    expect(await movimentos()).toHaveLength(0);
    const contextoAtual = sucesso(await listarContextoMudancaAcademica(alunoId));
    expect(contextoAtual.origem).toMatchObject({ alocacaoId, matriculaId });
    expect((await trocarTurma(alunoId, { ...entrada, matriculaId, alocacaoOrigemId: alocacaoId })).ok).toBe(false);
    expect((await alocacoes()).filter((a) => a.ativa)).toMatchObject([{ matriculaId, turmaId: origem.id }]);
    expect(await prisma.alocacaoTurma.count({ where: { matriculaId: outra.id } })).toBe(0);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: outra.id } })).status).toBe("ATIVA");
    expect(await movimentos()).toHaveLength(0);
  });

  it.each([Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR])("%s não transfere equivalente pela ação antiga", async (papel) => {
    const usuario = await criarUsuario([papel]);
    entrar(usuario.id);
    const financeiro = await memorizarContrato();
    expect((await trocarTurma(alunoId, { turmaDestinoId: destino.id, justificativa: "Direção já concordou verbalmente", horarioCompativel: true })).ok).toBe(false);
    expect(await movimentos()).toHaveLength(0);
    expect((await trocarTurma(alunoId, { turmaDestinoId: equivalente.id, justificativa: "Ajuste de horário equivalente", horarioCompativel: true })).ok).toBe(false);
    expect((await alocacoes()).every((a) => a.matriculaId === matriculaId)).toBe(true);
    expect((await alocacoes()).filter((a) => a.ativa).map((a) => a.turmaId)).toEqual([origem.id]);
    expect(await movimentos()).toHaveLength(0);
    expect(await memorizarContrato()).toEqual(financeiro);
  });

  it("pedido excepcional não substitui transferência equivalente e não muda idioma ou modalidade", async () => {
    const outraModalidade = await prisma.modalidade.create({ data: { nome: "Particular", frequencia: "1x/semana", duracaoPorNivel: "6 meses" } });
    const outroIdioma = await prisma.idioma.create({ data: { nome: "Inglês" } });
    const outroNivel = await prisma.nivel.create({ data: { idiomaId: outroIdioma.id, codigo: "A1", ordem: 1 } });
    const particular = await criarTurma(destino.nivelId, { modalidadeId: outraModalidade.id });
    const inglesa = await criarTurma(outroNivel.id);
    entrar(adm.id);
    for (const turma of [equivalente, particular, inglesa]) {
      expect((await solicitarMudancaAcademica(alunoId, { turmaDestinoId: turma.id, motivo, horarioCompativel: true })).ok).toBe(false);
    }
    expect((await trocarTurma(alunoId, { turmaDestinoId: particular.id, justificativa: motivo, horarioCompativel: true })).ok).toBe(false);
    expect((await trocarTurma(alunoId, { turmaDestinoId: inglesa.id, justificativa: motivo, horarioCompativel: true })).ok).toBe(false);
    expect(await prisma.solicitacaoMudancaAcademica.count()).toBe(0);
    expect(await movimentos()).toHaveLength(0);
  });

  it.each(["RASCUNHO", "AGUARDANDO", "ENCERRADA", "CANCELADA"] as const)("matrícula %s não autoriza mudança acadêmica de aluno ativo", async (status) => {
    await prisma.matricula.update({ where: { id: matriculaId }, data: { status } });
    expect((await solicitarMudancaAcademica(alunoId, { turmaDestinoId: destino.id, motivo, horarioCompativel: true })).ok).toBe(false);
    expect((await trocarTurma(alunoId, { turmaDestinoId: equivalente.id, horarioCompativel: true })).ok).toBe(false);
    expect(await movimentos()).toHaveLength(0);
  });

  it("matrícula ativa de outro curso não autoriza a transferência; vínculo legado não progride sem fechamento", async () => {
    const modalidade = await prisma.modalidade.create({ data: { nome: "Intensivo", frequencia: "5x/semana", duracaoPorNivel: "1 mês" } });
    const produto = await prisma.produto.create({ data: { idiomaId: catalogo.idioma.id, modalidadeId: modalidade.id } });
    await prisma.matricula.update({ where: { id: matriculaId }, data: { produtoId: produto.id } });
    expect((await solicitarMudancaAcademica(alunoId, { turmaDestinoId: destino.id, motivo, horarioCompativel: true })).ok).toBe(false);
    expect((await trocarTurma(alunoId, { turmaDestinoId: equivalente.id, horarioCompativel: true })).ok).toBe(false);
    const legado = await criarAluno("Aluno legado sem matrícula", false);
    const id = await solicitar(legado.pessoa.id);
    await opinar(id);
    entrar(gp.id);
    expect((await decidirMudancaAcademica(id, { aprovar: true, motivo: "Fechamento não pode ser inferido para vínculo legado" })).ok).toBe(false);
    entrar(sec.id);
    expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    expect((await alocacoes(legado.pessoa.id)).filter((a) => a.ativa).map((a) => a.turmaId)).toEqual([origem.id]);
    expect(await prisma.matricula.count({ where: { alunoId: legado.pessoa.id } })).toBe(0);
  });
});

describe("decisão não pode ser aplicada sobre um estado diferente", () => {
  it("nova contratação não invalida uma proposta vinculada à matrícula original", async () => {
    const id = await solicitar();
    await opinar(id);
    const outra = await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "AGUARDANDO" } });
    await aprovar(id);
    entrar(sec.id);
    sucesso(await executarMudancaAcademica(id, execucao));
    expect((await pedido(id)).status).toBe("EXECUTADA");
    expect(await prisma.matricula.findUniqueOrThrow({ where: { id: outra.id } })).toEqual(outra);
    expect((await alocacoes()).filter(a => a.ativa)).toMatchObject([{ matriculaId, turmaId: destino.id }]);
  });

  it.each(["horário", "nível", "modalidade", "matrícula", "produto", "professor"])("aprovação é recusada após alteração de %s", async (alteracao) => {
    const id = await solicitar();
    await opinar(id);
    if (alteracao === "horário") await prisma.turma.update({ where: { id: destino.id }, data: { horarioInicio: "20:00" } });
    if (alteracao === "nível") await prisma.nivel.update({ where: { id: destino.nivelId }, data: { ordem: 5 } });
    if (alteracao === "modalidade") await prisma.modalidade.update({ where: { id: catalogo.modalidade.id }, data: { duracaoPorNivel: "6 meses" } });
    if (alteracao === "matrícula") await prisma.matricula.update({ where: { id: matriculaId }, data: { status: "ENCERRADA" } });
    if (alteracao === "produto") {
      const p = await prisma.produto.create({ data: { idiomaId: catalogo.idioma.id, modalidadeId: catalogo.modalidade.id } });
      await prisma.matricula.update({ where: { id: matriculaId }, data: { produtoId: p.id } });
    }
    if (alteracao === "professor") await prisma.turma.update({ where: { id: origem.id }, data: { professorId: proAlheio.id } });
    const estadoPosterior = { alocacoes: await alocacoes(), contrato: await memorizarContrato() };
    entrar(gp.id);
    expect((await decidirMudancaAcademica(id, { aprovar: true, motivo })).ok).toBe(false);
    expect((await pedido(id)).status).toBe("PENDENTE");
    expect({ alocacoes: await alocacoes(), contrato: await memorizarContrato() }).toEqual(estadoPosterior);
    expect(await movimentos()).toHaveLength(0);
    entrar(sec.id);
    sucesso(await cancelarMudancaAcademica(id, { motivo: "Condições alteradas; solicitação obsoleta" }));
    expect((await pedido(id)).status).toBe("CANCELADA");
  });

  it("execução revalida horário alterado depois da aprovação", async () => {
    const id = await pedidoAprovado();
    await prisma.turma.update({ where: { id: destino.id }, data: { diasSemana: [5] } });
    entrar(sec.id);
    expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    expect((await pedido(id)).status).toBe("APROVADA");
    expect(await movimentos()).toHaveLength(0);
  });

  it("pausa e retomada legadas preservam o bloqueio de progressão sem matrícula", async () => {
    // O caminho global só atende o vínculo legado ainda sem matrícula atribuída.
    // A progressão não pode aprovar nem executar sem o fechamento contratual identificável.
    await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { matriculaId: null } });
    const id = await solicitar();
    await opinar(id);
    entrar(gp.id);
    expect((await decidirMudancaAcademica(id, { aprovar: true, motivo })).ok).toBe(false);
    expect((await pedido(id)).status).toBe("PENDENTE");
    entrar(sec.id);
    sucesso(await pausarAluno(alunoId, { motivo: "Pausa temporária solicitada pelo aluno" }));
    const retomadaId = sucesso(await solicitarRetomada(alunoId, { opcao: "MANTER_VENCIMENTOS", motivo: "Retomada acordada mantendo vencimentos" })).propostaId;
    entrar(adm.id);
    sucesso(await decidirRetomada(retomadaId, { aprovar: true, motivo: "Financeiro conferiu retomada solicitada" }));
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: alunoId } })).status).toBe("ATIVO");
    expect((await alocacoes()).find((a) => a.ativa)!.id).toBe(alocacaoId);
    entrar(sec.id);
    expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    expect((await pedido(id)).status).toBe("PENDENTE");
    expect(await movimentos()).toHaveLength(0);
  });

  it("alocação encerrada e recriada na mesma turma não reutiliza aprovação anterior", async () => {
    const id = await pedidoAprovado();
    await prisma.alocacaoTurma.update({ where: { id: alocacaoId }, data: { ativa: false, encerradaEm: new Date() } });
    const novaAlocacao = await prisma.alocacaoTurma.create({ data: { alunoId, turmaId: origem.id } });
    entrar(sec.id);
    expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    expect((await alocacoes()).find((a) => a.ativa)!.id).toBe(novaAlocacao.id);
    expect(await movimentos()).toHaveLength(0);
  });

  it.each(["solicitante", "aprovador", "executor"])("revogação do %s impede execução sem apagar aprovação", async (participante) => {
    const id = await pedidoAprovado();
    const executor = await criarUsuario([Papel.SECRETARIA_ACADEMICA]);
    const revogado = participante === "solicitante" ? sec : participante === "aprovador" ? gp : executor;
    await prisma.usuario.update({ where: { id: revogado.id }, data: { papeis: [Papel.VENDEDOR] } });
    entrar(executor.id);
    expect((await executarMudancaAcademica(id, execucao)).ok).toBe(false);
    expect((await pedido(id)).status).toBe("APROVADA");
    expect(await movimentos()).toHaveLength(0);
  });
});

function sinal() {
  let liberar!: () => void;
  const promessa = new Promise<void>((resolve) => { liberar = resolve; });
  return { promessa, liberar };
}

describe("concorrência, revogação durante espera e repetição", () => {
  it.each(["aprovação", "execução", "aprovador na execução"])("revogação durante lock real invalida %s com sessão já carregada", async (etapa) => {
    const id = etapa === "aprovação" ? await solicitar() : await pedidoAprovado();
    if (etapa === "aprovação") await opinar(id);
    entrar(etapa === "aprovação" ? gp.id : sec.id);
    const pronto = sinal();
    const liberar = sinal();
    let pidBloqueador = 0;
    const bloqueador = prisma.$transaction(async (tx) => {
      const [conexao] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      pidBloqueador = conexao.pid;
      await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${destino.id} FOR UPDATE`;
      pronto.liberar();
      await liberar.promessa;
    }, { timeout: 8000 });
    await Promise.race([pronto.promessa, bloqueador]);
    const operacao = etapa === "aprovação"
      ? decidirMudancaAcademica(id, { aprovar: true, motivo })
      : executarMudancaAcademica(id, execucao);
    try {
      let aguardou = false;
      const limite = Date.now() + 3000;
      while (Date.now() < limite) {
        const [linha] = await prisma.$queryRaw<{ aguardando: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity atividade
            WHERE ${pidBloqueador} = ANY(pg_blocking_pids(atividade.pid))
          ) AS aguardando
        `;
        if (linha.aguardando) { aguardou = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(aguardou, "A operação deve aguardar a turma depois de autenticar").toBe(true);
      await prisma.usuario.update({ where: { id: etapa === "execução" ? sec.id : gp.id }, data: { papeis: [Papel.VENDEDOR] } });
    } finally {
      liberar.liberar();
      await bloqueador;
      await operacao;
    }
    expect((await operacao).ok).toBe(false);
    expect((await pedido(id)).status).toBe(etapa === "aprovação" ? "PENDENTE" : "APROVADA");
    expect(await movimentos()).toHaveLength(0);
  });

  it("pedidos concorrentes ou repetidos mantêm no máximo um aberto por aluno", async () => {
    const input = { turmaDestinoId: destino.id, motivo, horarioCompativel: true as const };
    const resultados = await Promise.all([solicitarMudancaAcademica(alunoId, input), solicitarMudancaAcademica(alunoId, input)]);
    expect(resultados.some((r) => r.ok)).toBe(true);
    const abertos = await prisma.solicitacaoMudancaAcademica.findMany({ where: { alunoId, status: { in: ["PENDENTE", "APROVADA"] } } });
    expect(abertos).toHaveLength(1);
    await aprovar(abertos[0].id, gp.id, true);
    entrar(sec.id);
    await solicitarMudancaAcademica(alunoId, { ...input, motivo: "Outra solicitação não pode substituir a anterior" });
    expect(await prisma.solicitacaoMudancaAcademica.count({ where: { alunoId, status: { in: ["PENDENTE", "APROVADA"] } } })).toBe(1);
    expect(await movimentos()).toHaveLength(0);
  });

  it("execuções concorrentes e replay deixam exatamente uma nova alocação e movimentação", async () => {
    const id = await pedidoAprovado();
    entrar(sec.id);
    const resultados = await Promise.all([executarMudancaAcademica(id, execucao), executarMudancaAcademica(id, execucao)]);
    expect(resultados.some((r) => r.ok)).toBe(true);
    const depois = { alocacoes: await alocacoes(), movimentos: await movimentos(), pedido: await pedido(id), eventos: await eventosDo("Aluno", alunoId) };
    sucesso(await executarMudancaAcademica(id, execucao));
    expect({ alocacoes: await alocacoes(), movimentos: await movimentos(), pedido: await pedido(id), eventos: await eventosDo("Aluno", alunoId) }).toEqual(depois);
    expect(depois.alocacoes).toHaveLength(2);
    expect(depois.movimentos).toHaveLength(1);
    expect(depois.eventos.filter((e) => e.tipo === "TrocaTurma")).toHaveLength(1);
  });

  it("duas aprovações não reservam a última vaga; somente uma execução a ocupa", async () => {
    await prisma.turma.update({ where: { id: destino.id }, data: { capacidade: 1 } });
    const outro = await criarAluno("Outro aluno para última vaga");
    const primeiroId = await pedidoAprovado();
    const segundoId = await pedidoAprovado(outro.pessoa.id);
    expect(await prisma.alocacaoTurma.count({ where: { turmaId: destino.id, ativa: true } })).toBe(0);
    entrar(sec.id);
    const resultados = await Promise.all([executarMudancaAcademica(primeiroId, execucao), executarMudancaAcademica(segundoId, execucao)]);
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.alocacaoTurma.count({ where: { turmaId: destino.id, ativa: true } })).toBe(1);
    const pedidos = await prisma.solicitacaoMudancaAcademica.findMany({ where: { id: { in: [primeiroId, segundoId] } } });
    expect(pedidos.map((p) => p.status).sort()).toEqual(["APROVADA", "EXECUTADA"]);
    const perdedor = pedidos.find((p) => p.status === "APROVADA")!;
    expect((await alocacoes(perdedor.alunoId)).filter((a) => a.ativa).map((a) => a.turmaId)).toEqual([origem.id]);
    expect(await prisma.movimentacaoAluno.count({ where: { tipo: "TROCA_TURMA" } })).toBe(1);
  });

  it("cancelamento e execução concorrentes produzem um único estado terminal coerente", async () => {
    const id = await pedidoAprovado();
    entrar(sec.id);
    const resultados = await Promise.all([
      cancelarMudancaAcademica(id, { motivo: "Aluno desistiu durante preparação da mudança" }),
      executarMudancaAcademica(id, execucao),
    ]);
    expect(resultados.some((r) => r.ok)).toBe(true);
    const final = await pedido(id);
    expect(["CANCELADA", "EXECUTADA"]).toContain(final.status);
    const executada = final.status === "EXECUTADA";
    expect(await movimentos()).toHaveLength(Number(executada));
    expect((await alocacoes()).filter((a) => a.ativa).map((a) => a.turmaId)).toEqual([executada ? destino.id : origem.id]);
    expect(final.executorId).toBe(executada ? sec.id : null);
    expect(final.canceladorId).toBe(executada ? null : sec.id);
  });
});
