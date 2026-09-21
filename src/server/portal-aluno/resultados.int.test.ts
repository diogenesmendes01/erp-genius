import { beforeEach, expect, it, vi } from "vitest";

const sessao = vi.hoisted(() => ({ atual: { sessaoId: "sessao-resultados", contaId: "conta-resultados", alunoId: "", email: "aluno@portal.test" } }));
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("./sessao", () => ({ exigirSessaoPortalAluno: async () => sessao.atual }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { prisma } from "@/lib/prisma";
import { HABILIDADES } from "@/server/avaliacoes/calculo";
import { proporCorrecaoNota, revisarCorrecaoNota, decidirCorrecaoNota } from "@/server/avaliacoes/correcao";
import { salvarLancamentoAvaliacao, oficializarLancamentoAvaliacao } from "@/server/avaliacoes/lancamentos";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "@/server/avaliacoes/regras-tx";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarResultadosPortalAluno } from "./resultados";
import { carregarFontesEquivalenciaTx } from "@/server/avaliacoes/fontes-equivalencia-tx";
import { conferirEstadoEquivalenciaTx } from "@/server/avaliacoes/equivalencia-estado-tx";
import { revisarEquivalenciaTransferencia, proporEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-proposta";
import { decidirEquivalenciaTransferencia } from "@/server/avaliacoes/equivalencia-decisao";
import { consultarPropostaEquivalencia, listarPropostasEquivalencia } from "@/server/avaliacoes/equivalencia-consulta";

let professorId: string, gestorId: string, alunoId: string, outroAlunoId: string, matriculaId: string, alocacaoId: string;
const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

async function salvar(codigoAvaliacao: "I1" | "F1", notas: Array<{ habilidade: typeof HABILIDADES[number]; nota: string | null; comentarioAluno: string }>, chave: string, submetida = true) {
  const resultado = await salvarLancamentoAvaliacao({
    alocacaoId, codigoAvaliacao, realizadaEm: "2026-01-10T10:00:00.000Z", notas, submetida,
    versaoEsperada: 0, chaveIdempotencia: chave,
  });
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  return prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: resultado.dado.id } });
}

async function oficializar(lancamento: { id: string; conteudoHash: string }) {
  entrar(gestorId);
  const resultado = await oficializarLancamentoAvaliacao({
    lancamentoId: lancamento.id, conteudoHash: lancamento.conteudoHash, aprovada: true, motivo: "Notas conferidas pela gestão pedagógica",
  });
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  entrar(professorId);
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const administradorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const regra = await prisma.$transaction((tx) => prepararRegraAvaliacaoTx(tx, gestorId, {
    nivelId: nivel.id, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(), motivo: "Regra de resultados no portal",
    chaveIdempotencia: "regra-resultados-portal",
  }));
  const regraPersistida = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction((tx) => decidirRegraAvaliacaoTx(tx, administradorId, {
    regraId: regra.id, conteudoHash: regraPersistida.conteudoHash, aprovada: true, motivo: "Publicação independente da regra",
  }));
  const turma = await prisma.turma.create({ data: {
    nome: "Turma Portal A1", modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"), vinculosDocentes: { create: { professorId, inicio } },
  } });
  await prisma.turma.update({ where: { id: turma.id }, data: { dataInicio: inicio, status: "EM_ANDAMENTO" } });
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna do portal", paisId: catalogo.pais.id } })).id;
  outroAlunoId = (await prisma.aluno.create({ data: { primeiroNome: "Outro aluno", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", codigo: "M-PORTAL-1", status: "ATIVA", ativadaEm: inicio,
  } })).id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turma.id, criadoEm: inicio } })).id;
  const outraMatricula = await prisma.matricula.create({ data: {
    alunoId: outroAlunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", codigo: "M-OUTRA-1", status: "ATIVA", ativadaEm: inicio,
  } });
  await prisma.alocacaoTurma.create({ data: { alunoId: outroAlunoId, matriculaId: outraMatricula.id, turmaId: turma.id, criadoEm: inicio } });
  const aulaPortal = await prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId, preparadorId: gestorId, inicio: new Date("2026-01-05T10:00:00.000Z"), fim: new Date("2026-01-05T11:00:00.000Z"),
    fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula da frequência do portal", chaveIdempotencia: "aula-resultados-portal", entradaHash: "fixture",
    diario: { create: {
      turmaId: turma.id, professorId, ocorridaEm: new Date("2026-01-05T10:00:00.000Z"), conteudo: "Aula realizada",
      registros: { create: { alunoId, matriculaId, nomeAluno: "Aluna do portal", presente: true, participacao: "PRESENTE" } },
    } },
  } });
  sessao.atual = { sessaoId: "sessao-resultados", contaId: "conta-resultados", alunoId, email: "aluna@portal.test" };
  await prisma.encontroAgenda.update({ where: { id: aulaPortal.id }, data: { status: "MINISTRADO" } });
  entrar(professorId);
});

it("exibe somente notas oficializadas e comentário ao aluno, com consolidado explicitamente parcial", async () => {
  const oficial = await salvar("I1", [{ habilidade: "FALA", nota: "7", comentarioAluno: "Boa evolução na fala." }], "portal-i1-oficial");
  await oficializar(oficial);
  await salvar("F1", HABILIDADES.map((habilidade) => ({ habilidade, nota: "9", comentarioAluno: "Rascunho interno que não pode aparecer" })), "portal-f1-rascunho", false);

  const resultado = await consultarResultadosPortalAluno();
  expect(resultado).toMatchObject({
    situacao: "PARCIAL_NAO_FINAL", resultadoFinal: null,
    matriculas: [{ codigo: "M-PORTAL-1", alocacoes: [{
      alocacaoId, idioma: "Português", nivel: "A1", turma: "Turma Portal A1", situacao: "PARCIAL_NAO_FINAL", resultadoFinal: null,
      avaliacoes: [{ codigo: "I1", etapa: "INTERMEDIARIA", notas: [{ habilidade: "FALA", nota: "7", comentarioAluno: "Boa evolução na fala." }] }],
      frequencia: { base: 1, presencas: 1, faltas: 0, percentual: { numerador: "100", denominador: "1" } },
      consolidado: { completa: false },
    }] }],
  });
  expect(JSON.stringify(resultado)).not.toContain("Rascunho interno");
  expect(JSON.stringify(resultado)).not.toMatch(/conteudoHash|entradaHash|motivo|evidencia|pagador|cobranca/i);
});

it("mostra a correção aprovada como nota vigente e mantém a matrícula de outro aluno fora da resposta", async () => {
  const oficial = await salvar("I1", [{ habilidade: "FALA", nota: "7", comentarioAluno: "Comentário original" }], "portal-correcao-oficial");
  await oficializar(oficial);
  const proposta = await proporCorrecaoNota({
    lancamentoId: oficial.id, origemHash: oficial.conteudoHash, versaoEsperada: 0, chaveIdempotencia: "portal-correcao-aprovada",
    motivo: "Corrigir a nota publicada", notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Comentário corrigido para o aluno" }],
  });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  entrar(gestorId);
  const revisao = await revisarCorrecaoNota(proposta.dado.id);
  if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  const decisao = await decidirCorrecaoNota({
    propostaId: proposta.dado.id, propostaHash: revisao.dado.propostaHash, impactosHash: revisao.dado.impactosHash,
    aprovada: true, motivo: "Correção conferida independentemente",
  });
  expect(decisao, JSON.stringify(decisao)).toMatchObject({ ok: true });

  const resultado = await consultarResultadosPortalAluno();
  expect(resultado.matriculas).toHaveLength(1);
  expect(resultado.matriculas[0]).toMatchObject({ matriculaId, codigo: "M-PORTAL-1" });
  expect(resultado.matriculas[0]?.alocacoes[0]?.avaliacoes).toEqual([
    { codigo: "I1", titulo: "Intermediária de fala", etapa: "INTERMEDIARIA", notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Comentário corrigido para o aluno" }] },
  ]);
  expect(JSON.stringify(resultado)).not.toContain(outroAlunoId);
  expect(JSON.stringify(resultado)).not.toContain("M-OUTRA-1");
});

it("fonte de equivalência preserva autoria e muda apenas depois da correção oficial", async () => {
  const a = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId }, include: { turma: true } });
  const contexto = { matriculaId, alocacaoId, turmaId: a.turmaId, nivelId: a.turma.nivelId, regraId: a.turma.regraAvaliacaoId! };
  const ler = () => prisma.$transaction(tx => carregarFontesEquivalenciaTx(tx, contexto));
  const lancamento = await salvar("I1", [{ habilidade: "FALA", nota: "7", comentarioAluno: "Fonte original" }], "fonte-equiv");
  expect(await ler()).toEqual([]);
  await oficializar(lancamento);
  const original = (await ler())[0]!;
  expect(original).toMatchObject({ nota: "7", autorLancamentoId: professorId, lancamentoId: lancamento.id, correcaoId: null });
  const proposta = await proporCorrecaoNota({ lancamentoId: lancamento.id, origemHash: lancamento.conteudoHash, versaoEsperada: 0, chaveIdempotencia: "corrigir-fonte",
    motivo: "Correção da fonte para aproveitamento", notas: [{ habilidade: "FALA", nota: "8", comentarioAluno: "Fonte corrigida" }] });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect((await ler())[0]).toEqual(original);
  entrar(gestorId);
  const revisao = await revisarCorrecaoNota(proposta.dado.id);
  if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  expect(await decidirCorrecaoNota({ propostaId: proposta.dado.id, propostaHash: revisao.dado.propostaHash,
    impactosHash: revisao.dado.impactosHash, aprovada: true, motivo: "Fonte conferida independentemente" })).toMatchObject({ ok: true });
  const atual = (await ler())[0]!;
  expect(atual).toMatchObject({ nota: "8", autorLancamentoId: professorId, lancamentoId: lancamento.id, correcaoId: proposta.dado.id });
  expect(atual.fonteHash).not.toBe(original.fonteHash);
  expect(atual.referenciaId).toBe(original.referenciaId);
  await expect(prisma.$transaction(tx => carregarFontesEquivalenciaTx(tx, { ...contexto, matriculaId: "outro-contrato" }))).rejects.toThrow("vínculo");
});

it("conferência da transferência liga fontes oficiais e requisitos da regra de destino", async () => {
  const origem = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId }, include: { turma: true } });
  const destino = await prisma.turma.create({ data: {
    nome: "Destino do aproveitamento", modalidadeId: origem.turma.modalidadeId, nivelId: origem.turma.nivelId,
    professorId, dataInicio: new Date("2099-01-01T00:00:00.000Z"), capacidade: 10, status: "ABERTA",
  } });
  const entrada = { matriculaId, alocacaoOrigemId: alocacaoId, turmaDestinoId: destino.id, mapeamentos: [] };
  const antes = await prisma.$transaction(tx => conferirEstadoEquivalenciaTx(tx, entrada));
  expect(antes.projecao.itens.every(i => i.situacao === "PENDENTE")).toBe(true);
  expect((await prisma.$transaction(tx => conferirEstadoEquivalenciaTx(tx, entrada))).estadoHash).toBe(antes.estadoHash);
  const lancamento = await salvar("I1", [{ habilidade: "FALA", nota: "7", comentarioAluno: "Fonte para transferência" }], "conferencia-equiv");
  await oficializar(lancamento);
  const atual = await prisma.$transaction(tx => conferirEstadoEquivalenciaTx(tx, { ...entrada, mapeamentos: [{
    referenciaFonteId: `${lancamento.id}:FALA`, codigoAvaliacaoDestino: "I1", habilidadeDestino: "FALA",
  }] }));
  expect(atual.estadoHash).not.toBe(antes.estadoHash);
  expect(atual.projecao.itens.find(i => i.codigoAvaliacao === "I1")).toMatchObject({ situacao: "APROVEITADO", fonte: { lancamentoId: lancamento.id } });
  expect(await prisma.alocacaoTurma.count({ where: { matriculaId, turmaId: destino.id } })).toBe(0);
  entrar(gestorId);
  const previa = await revisarEquivalenciaTransferencia(entrada);
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  const propostaInput = { ...entrada, estadoHash: previa.dado.estadoHash, versaoEsperada: previa.dado.versaoAtual,
    motivo: "Revisão do aproveitamento para outra turma", chaveIdempotencia: "proposta-equivalencia-1" };
  expect(await proporEquivalenciaTransferencia({ ...propostaInput, estadoHash: "0".repeat(64) })).toMatchObject({ ok: false });
  expect(await prisma.propostaEquivalenciaAvaliacao.count()).toBe(0);
  const proposta = await proporEquivalenciaTransferencia(propostaInput);
  expect(proposta, JSON.stringify(proposta)).toMatchObject({ ok: true });
  if (!proposta.ok || !proposta.dado) throw new Error(JSON.stringify(proposta));
  expect(await proporEquivalenciaTransferencia(propostaInput)).toEqual(proposta);
  expect(await proporEquivalenciaTransferencia({ ...propostaInput, motivo: "Outro conteúdo com mesma chave" })).toMatchObject({ ok: false });
  expect(await prisma.propostaEquivalenciaAvaliacao.count()).toBe(1);
  await expect(prisma.propostaEquivalenciaAvaliacao.update({ where: { id: proposta.dado.id }, data: { motivo: "Alteração do histórico" } })).rejects.toThrow("histórico");
  await expect(prisma.decisaoEquivalenciaAvaliacao.create({ data: { propostaId: proposta.dado.id,
    decisorId: gestorId, aprovada: true, motivo: "Tentativa de autoaprovação" } })).rejects.toThrow("outra pessoa");
  const decisaoInput = { propostaId: proposta.dado.id, estadoHash: previa.dado.estadoHash,
    aprovar: true, motivo: "Aproveitamento revisado pela administração" };
  expect(await decidirEquivalenciaTransferencia(decisaoInput)).toMatchObject({ ok: false });
  const aprovador = await criarUsuario(["ADMINISTRADOR"]);
  entrar(aprovador.id);
  const decisao = await decidirEquivalenciaTransferencia(decisaoInput);
  expect(decisao, JSON.stringify(decisao)).toMatchObject({ ok: true });
  expect(await decidirEquivalenciaTransferencia(decisaoInput)).toEqual(decisao);
  expect(await prisma.decisaoEquivalenciaAvaliacao.count()).toBe(1);
  const gestao = await consultarPropostaEquivalencia({ propostaId: proposta.dado.id });
  expect(gestao).toMatchObject({ ok: true, dado: { visao: "PEDAGOGICA", estado: "APROVADA", snapshot: expect.any(Object) } });
  const secretaria = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  entrar(secretaria.id);
  const operacional = await consultarPropostaEquivalencia({ propostaId: proposta.dado.id });
  expect(operacional).toMatchObject({ ok: true, dado: { visao: "EXECUCAO", estado: "APROVADA", podeDecidir: false, podeExecutar: true } });
  if (!operacional.ok || !operacional.dado) throw new Error(JSON.stringify(operacional));
  expect(operacional.dado).not.toHaveProperty("snapshot");
  expect(operacional.dado).not.toHaveProperty("mapeamentos");
  expect(JSON.stringify(operacional.dado)).not.toContain(lancamento.id);
  expect(await listarPropostasEquivalencia({ matriculaId })).toMatchObject({ ok: true,
    dado: { itens: [{ id: proposta.dado.id, estado: "APROVADA" }], proximoCursor: null } });
  const outroContrato = await prisma.matricula.findFirstOrThrow({ where: { alunoId: outroAlunoId }, select: { id: true } });
  expect(await listarPropostasEquivalencia({ matriculaId: outroContrato.id })).toMatchObject({ ok: true, dado: { itens: [] } });
  expect(await prisma.alocacaoTurma.count({ where: { matriculaId, turmaId: destino.id } })).toBe(0);
  entrar(professorId);
  expect(await consultarPropostaEquivalencia({ propostaId: proposta.dado.id })).toMatchObject({ ok: false });
  expect(await revisarEquivalenciaTransferencia(entrada)).toMatchObject({ ok: false });
});

it("mantém vínculos de contratos distintos do mesmo aluno em grupos separados", async () => {
  const catalogo = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId }, select: { produtoId: true, paisId: true } });
  const historica = await prisma.matricula.create({ data: {
    alunoId, produtoId: catalogo.produtoId, paisId: catalogo.paisId, moeda: "CRC", codigo: "M-PORTAL-HIST",
    status: "ATIVA", ativadaEm: new Date("2025-12-01T00:00:00.000Z"),
  } });
  const turma = await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId }, select: { turmaId: true } });
  await prisma.alocacaoTurma.create({ data: {
    alunoId, matriculaId: historica.id, turmaId: turma.turmaId, ativa: false,
    criadoEm: new Date("2025-12-01T00:00:00.000Z"), encerradaEm: new Date("2025-12-31T00:00:00.000Z"),
  } });

  const resultado = await consultarResultadosPortalAluno();
  expect(resultado.matriculas).toEqual(expect.arrayContaining([
    expect.objectContaining({ matriculaId, codigo: "M-PORTAL-1" }),
    expect.objectContaining({ matriculaId: historica.id, codigo: "M-PORTAL-HIST" }),
  ]));
  expect(resultado.matriculas.every((item) => item.alocacoes.every((alocacao) => alocacao.situacao !== undefined))).toBe(true);
});
