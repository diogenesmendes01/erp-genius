import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { HABILIDADES } from "./calculo";
import { carregarAproveitamentoAplicadoTx } from "./aproveitamento-aplicado-tx";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { proporCorrecaoNota, revisarCorrecaoNota, decidirCorrecaoNota } from "./correcao";
import { decidirEquivalenciaTransferencia } from "./equivalencia-decisao";
import { executarEquivalenciaTransferencia } from "./equivalencia-execucao";
import { proporEquivalenciaTransferencia, revisarEquivalenciaTransferencia } from "./equivalencia-proposta";
import { confirmarFechamentoAcademico, revisarFechamentoAcademico } from "./fechamento";
import { carregarFontesEquivalenciaTx } from "./fontes-equivalencia-tx";
import { salvarLancamentoAvaliacao, oficializarLancamentoAvaliacao } from "./lancamentos";
import { decidirPlanoRecuperacao } from "./recuperacao-decisao";
import { registrarDisponibilizacaoRecuperacao } from "./recuperacao-disponibilizacao";
import { salvarNotaRecuperacao, decidirNotaRecuperacao } from "./recuperacao-nota";
import { proporPlanoRecuperacao } from "./recuperacao-proposta";
import { registrarRealizacaoRecuperacao } from "./recuperacao-realizacao";
import { reservarTentativaRecuperacao } from "./recuperacao-reserva";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { consultarResultadosPortalAluno } from "@/server/portal-aluno/resultados";

let professorId: string;
let gestorId: string;
let aprovadorId: string;
let secretariaId: string;
let alunoId: string;
let matriculaId: string;
let alocacaoOrigemId: string;
let turmaOrigemId: string;
let turmaDestinoId: string;
let nivelId: string;
let regraId: string;

const inicio = new Date("2026-01-01T00:00:00.000Z");
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

function assertOk<T extends { ok: boolean; dado?: unknown }>(resultado: T): asserts resultado is T & { ok: true; dado: NonNullable<T["dado"]> } {
  expect(resultado, JSON.stringify(resultado)).toMatchObject({ ok: true });
  if (!resultado.ok || resultado.dado === undefined || resultado.dado === null) throw new Error(JSON.stringify(resultado));
}

async function oficializarFala(alocacaoId: string, nota: string, chave: string) {
  entrar(professorId);
  const salvo = await salvarLancamentoAvaliacao({
    alocacaoId,
    codigoAvaliacao: "I1",
    realizadaEm: "2026-01-10T10:00:00.000Z",
    notas: [{ habilidade: "FALA", nota, comentarioAluno: `Resultado oficial ${chave}` }],
    submetida: true,
    versaoEsperada: 0,
    chaveIdempotencia: chave,
  });
  assertOk(salvo);
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.dado.id } });
  entrar(gestorId);
  assertOk(await oficializarLancamentoAvaliacao({
    lancamentoId: lancamento.id,
    conteudoHash: lancamento.conteudoHash,
    aprovada: true,
    motivo: "Conferência independente do lançamento de origem",
  }));
  return lancamento;
}

async function oficializarFinal(alocacaoId: string, nota: string, chave: string, notasPorHabilidade?: Partial<Record<(typeof HABILIDADES)[number], string>>) {
  entrar(professorId);
  const salvo = await salvarLancamentoAvaliacao({
    alocacaoId,
    codigoAvaliacao: "F1",
    realizadaEm: "2026-01-11T10:00:00.000Z",
    notas: HABILIDADES.map(habilidade => ({ habilidade, nota: notasPorHabilidade?.[habilidade] ?? nota, comentarioAluno: `Resultado oficial ${chave} ${habilidade}` })),
    submetida: true,
    versaoEsperada: 0,
    chaveIdempotencia: chave,
  });
  assertOk(salvo);
  const lancamento = await prisma.versaoLancamentoAvaliacao.findUniqueOrThrow({ where: { id: salvo.dado.id } });
  entrar(gestorId);
  assertOk(await oficializarLancamentoAvaliacao({
    lancamentoId: lancamento.id,
    conteudoHash: lancamento.conteudoHash,
    aprovada: true,
    motivo: "Conferência independente da avaliação final da origem",
  }));
  return lancamento;
}

async function instanteAtualConferido() {
  const [relogio] = await prisma.$queryRaw<{ agora: Date }[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS agora`;
  const espera = relogio.agora.getTime() - Date.now();
  if (espera > 0) await new Promise(resolve => setTimeout(resolve, espera + 2));
  return new Date();
}

async function contextoDestino(alocacaoDestinoId: string) {
  return {
    matriculaId,
    alocacaoDestinoId,
    turmaDestinoId,
    nivelDestinoId: nivelId,
    regraDestinoId: regraId,
  };
}

async function lerAplicacao(alocacaoDestinoId: string) {
  const contexto = await contextoDestino(alocacaoDestinoId);
  return prisma.$transaction(tx => carregarAproveitamentoAplicadoTx(
    tx,
    contexto,
    origem => carregarFontesEquivalenciaTx(tx, origem),
  ));
}

async function resultadoPortalDestino(alocacaoDestinoId: string) {
  const resultado = await consultarResultadosPortalAluno({
    sessaoId: "sessao-aproveitamento-aplicado",
    contaId: "conta-aproveitamento-aplicado",
    alunoId,
    email: "aluna-aproveitada@portal.test",
  });
  const alocacao = resultado.matriculas
    .find(item => item.matriculaId === matriculaId)
    ?.alocacoes.find(item => item.alocacaoId === alocacaoDestinoId);
  if (!alocacao) throw new Error("Vínculo de destino ausente do resultado do portal.");
  return alocacao;
}

async function aplicarFonteFala() {
  const lancamento = await oficializarFala(alocacaoOrigemId, "8", "fonte-origem-principal");
  entrar(gestorId);
  const base = {
    matriculaId,
    alocacaoOrigemId,
    turmaDestinoId,
    mapeamentos: [{
      referenciaFonteId: `${lancamento.id}:FALA`,
      codigoAvaliacaoDestino: "I1",
      habilidadeDestino: "FALA" as const,
    }],
  };
  const revisao = await revisarEquivalenciaTransferencia(base);
  assertOk(revisao);
  const proposta = await proporEquivalenciaTransferencia({
    ...base,
    estadoHash: revisao.dado.estadoHash,
    versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Aproveitamento de fala conferido para transferência equivalente",
    chaveIdempotencia: "aproveitamento-aplicado-proposta",
  });
  assertOk(proposta);
  entrar(aprovadorId);
  const decisao = await decidirEquivalenciaTransferencia({
    propostaId: proposta.dado.id,
    estadoHash: revisao.dado.estadoHash,
    aprovar: true,
    motivo: "Aprovação independente do aproveitamento de fala",
  });
  assertOk(decisao);
  entrar(secretariaId);
  const executada = await executarEquivalenciaTransferencia({
    decisaoId: decisao.dado.id,
    motivo: "Secretaria executou transferência aprovada com aproveitamento",
    horarioCompativel: true,
  });
  assertOk(executada);
  return { lancamento, decisaoId: decisao.dado.id, ...executada.dado };
}

async function aplicarFontesCompletasInsuficientes() {
  const intermediaria = await oficializarFala(alocacaoOrigemId, "5", "fonte-origem-recuperacao-i1");
  const final = await oficializarFinal(alocacaoOrigemId, "5", "fonte-origem-recuperacao-f1");
  entrar(gestorId);
  const base = {
    matriculaId,
    alocacaoOrigemId,
    turmaDestinoId,
    mapeamentos: [
      { referenciaFonteId: `${intermediaria.id}:FALA`, codigoAvaliacaoDestino: "I1", habilidadeDestino: "FALA" as const },
      ...HABILIDADES.map(habilidade => ({ referenciaFonteId: `${final.id}:${habilidade}`, codigoAvaliacaoDestino: "F1", habilidadeDestino: habilidade })),
    ],
  };
  const revisao = await revisarEquivalenciaTransferencia(base);
  assertOk(revisao);
  const proposta = await proporEquivalenciaTransferencia({
    ...base,
    estadoHash: revisao.dado.estadoHash,
    versaoEsperada: revisao.dado.versaoAtual,
    motivo: "Aproveitamento completo e insuficiente para recuperação posterior no destino",
    chaveIdempotencia: "aproveitamento-recuperacao-proposta",
  });
  assertOk(proposta);
  entrar(aprovadorId);
  const decisao = await decidirEquivalenciaTransferencia({
    propostaId: proposta.dado.id,
    estadoHash: revisao.dado.estadoHash,
    aprovar: true,
    motivo: "Aprovação independente das fontes aplicadas no destino",
  });
  assertOk(decisao);
  entrar(secretariaId);
  const executada = await executarEquivalenciaTransferencia({
    decisaoId: decisao.dado.id,
    motivo: "Secretaria executou transferência com fontes oficiais completas",
    horarioCompativel: true,
  });
  assertOk(executada);
  return { intermediaria, final, ...executada.dado };
}

async function recuperarFalaNoDestino(alocacaoDestinoId: string, nota: string, versaoEsperada: number, habilidades: readonly (typeof HABILIDADES)[number][] = HABILIDADES) {
  entrar(professorId);
  const plano = await proporPlanoRecuperacao({
    alocacaoId: alocacaoDestinoId,
    versaoEsperada,
    motivo: "Plano aprovado para recuperar habilidades ainda abaixo do mínimo no destino",
    chaveIdempotencia: `aproveitamento-recuperacao-plano-${versaoEsperada}`,
    atividades: habilidades.map(habilidade => ({
      habilidade,
      estrategia: "Atividade orientada com evidência individual de aprendizagem",
      avaliacaoProposta: "Avaliação individual registrada e conferida pelo professor",
    })),
  });
  assertOk(plano);
  const persistido = await prisma.propostaPlanoRecuperacao.findUniqueOrThrow({ where: { id: plano.dado.id } });
  entrar(gestorId);
  assertOk(await decidirPlanoRecuperacao({
    propostaId: persistido.id,
    propostaHash: persistido.entradaHash,
    aprovada: true,
    motivo: "Gestão aprova independentemente o plano de recuperação no destino",
  }));
  assertOk(await registrarDisponibilizacaoRecuperacao({
    propostaId: persistido.id,
    propostaHash: persistido.entradaHash,
    disponibilizadaEm: (await instanteAtualConferido()).toISOString(),
    condicoes: "Atividade, critério e prazo foram comunicados à aluna",
    evidenciaComunicacao: "Comunicado acadêmico registrado no atendimento da matrícula",
  }));
  const reserva = await reservarTentativaRecuperacao({
    propostaId: persistido.id,
    propostaHash: persistido.entradaHash,
    habilidades: ["FALA"],
    motivo: "Reserva da oportunidade de recuperação de fala no destino",
    chaveIdempotencia: `aproveitamento-recuperacao-reserva-${versaoEsperada}`,
  });
  assertOk(reserva);
  const item = await prisma.itemReservaTentativaRecuperacao.findFirstOrThrow({ where: { reservaId: reserva.dado.id, habilidade: "FALA" } });
  entrar(professorId);
  const realizacao = await registrarRealizacaoRecuperacao({
    itemReservaId: item.id,
    realizadaEm: (await instanteAtualConferido()).toISOString(),
    evidencia: "Evidência individual da realização de recuperação de fala no destino",
  });
  assertOk(realizacao);
  const notaSalva = await salvarNotaRecuperacao({
    realizacaoId: realizacao.dado.id,
    nota,
    comentarioAluno: "Devolutiva individual da recuperação de fala",
    submetida: true,
    versaoEsperada: 0,
    chaveIdempotencia: `aproveitamento-recuperacao-nota-${versaoEsperada}`,
  });
  assertOk(notaSalva);
  const notaPersistida = await prisma.notaRecuperacao.findUniqueOrThrow({ where: { id: notaSalva.dado.id } });
  entrar(gestorId);
  assertOk(await decidirNotaRecuperacao({
    notaId: notaPersistida.id,
    entradaHash: notaPersistida.entradaHash,
    aprovada: true,
    motivo: "Gestão oficializa independentemente a nota de recuperação",
  }));
  return { planoId: plano.dado.id, realizacaoId: realizacao.dado.id, notaId: notaPersistida.id };
}

async function registrarPresencaConferida(alocacaoId: string, turmaId: string, chave: string) {
  const encontro = await prisma.encontroAgenda.create({ data: {
    turmaId,
    professorId,
    preparadorId: gestorId,
    inicio: new Date("2026-01-12T10:00:00.000Z"),
    fim: new Date("2026-01-12T11:00:00.000Z"),
    fusoOrigem: "UTC",
    status: "PREVISTO",
    finalidade: "AULA",
    motivo: "Aula conferida para o fechamento da jornada ACA/V01.",
    chaveIdempotencia: chave,
    entradaHash: `fixture-${chave}`,
  } });
  await prisma.aulaDiario.create({ data: {
    encontroId: encontro.id,
    turmaId,
    professorId,
    ocorridaEm: encontro.inicio,
    conteudo: "Aula realizada com presença conferida para o fechamento.",
    registros: { create: { alunoId, matriculaId, nomeAluno: "Aluna aproveitada", presente: true, participacao: "PRESENTE" } },
  } });
  await prisma.encontroAgenda.update({ where: { id: encontro.id }, data: { status: "MINISTRADO" } });
  expect((await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: alocacaoId } })).matriculaId).toBe(matriculaId);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  aprovadorId = (await criarUsuario(["ADMINISTRADOR"])).id;
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  nivelId = nivel.id;
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestorId, {
    nivelId,
    versaoEsperada: 0,
    conteudo: regraAvaliacaoTeste(),
    motivo: "Regra para aproveitamento aplicado",
    chaveIdempotencia: "regra-aproveitamento-aplicado",
  }));
  const regraPersistida = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, aprovadorId, {
    regraId: regra.id,
    conteudoHash: regraPersistida.conteudoHash,
    aprovada: true,
    motivo: "Publicação independente da regra de aproveitamento",
  }));
  regraId = regra.id;
  const origem = await prisma.turma.create({ data: {
    nome: "Turma origem aproveitamento",
    modalidadeId: catalogo.modalidade.id,
    nivelId,
    professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  await prisma.turma.update({ where: { id: origem.id }, data: { dataInicio: inicio, status: "EM_ANDAMENTO" } });
  turmaOrigemId = origem.id;
  const destino = await prisma.turma.create({ data: {
    nome: "Turma destino aproveitamento",
    modalidadeId: catalogo.modalidade.id,
    nivelId,
    professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    status: "ABERTA",
    capacidade: 10,
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  turmaDestinoId = destino.id;
  regraId = (await prisma.turma.findUniqueOrThrow({ where: { id: turmaDestinoId } })).regraAvaliacaoId!;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluna aproveitada", paisId: catalogo.pais.id } });
  alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: {
    alunoId,
    produtoId: catalogo.produto.id,
    paisId: catalogo.pais.id,
    moeda: "CRC",
    status: "ATIVA",
    ativadaEm: inicio,
  } });
  matriculaId = matricula.id;
  alocacaoOrigemId = (await prisma.alocacaoTurma.create({ data: {
    alunoId,
    matriculaId,
    turmaId: turmaOrigemId,
    criadoEm: inicio,
  } })).id;
});

it("executa a cadeia aprovada e usa a nota de origem no consolidado sem lançamento no destino", async () => {
  const outroAluno = await prisma.aluno.create({ data: { primeiroNome: "Outra matrícula", paisId: (await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).paisId } });
  const contrato = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const outraMatricula = await prisma.matricula.create({ data: {
    alunoId: outroAluno.id,
    produtoId: contrato.produtoId,
    paisId: contrato.paisId,
    moeda: "CRC",
    status: "ATIVA",
    ativadaEm: inicio,
  } });
  const outraAlocacao = await prisma.alocacaoTurma.create({ data: {
    alunoId: outroAluno.id,
    matriculaId: outraMatricula.id,
    turmaId: turmaOrigemId,
    criadoEm: inicio,
  } });
  const outroLancamento = await oficializarFala(outraAlocacao.id, "9", "fonte-outra-matricula");

  const aplicada = await aplicarFonteFala();
  expect(await prisma.registroAvaliacaoMatricula.count({ where: { alocacaoId: aplicada.alocacaoDestinoId } })).toBe(0);
  const leitor = await lerAplicacao(aplicada.alocacaoDestinoId);
  expect(leitor?.aplicacaoId).toBe(aplicada.aplicacaoId);
  if (!leitor) throw new Error("Aplicação não encontrada no vínculo de destino.");
  expect(leitor.itens).toEqual(expect.arrayContaining([
    expect.objectContaining({
      codigoAvaliacao: "I1",
      habilidade: "FALA",
      situacao: "APROVEITADO",
      notaParaConsolidado: "8",
      referenciaFonteAplicadaId: `${aplicada.lancamento.id}:FALA`,
    }),
    expect.objectContaining({
      codigoAvaliacao: "F1",
      habilidade: "FALA",
      situacao: "PENDENTE_SEM_FONTE",
      notaParaConsolidado: null,
    }),
  ]));
  expect(leitor.fontesAproveitadas).toEqual(expect.arrayContaining([
    expect.objectContaining({
      tipoFonte: "APROVEITAMENTO",
      nota: "8",
      aplicacaoId: aplicada.aplicacaoId,
      alocacaoOrigemAplicacaoId: alocacaoOrigemId,
      alocacaoDestinoAplicacaoId: aplicada.alocacaoDestinoId,
      referenciaFonteAplicadaId: `${aplicada.lancamento.id}:FALA`,
    }),
  ]));
  expect(JSON.stringify(leitor)).not.toContain(outroLancamento.id);
  expect(JSON.stringify(leitor)).not.toContain(outraMatricula.id);

  const consolidado = await prisma.$transaction(tx => carregarConsolidadoAvaliacoesTx(tx, professorId, aplicada.alocacaoDestinoId, "ACOMPANHAMENTO"));
  const falaConsolidada = consolidado.resultado.habilidades.find(habilidade => habilidade.habilidade === "FALA");
  // I1 usa a nota aproveitada, mas F1 ainda não foi mapeada: o consolidado não
  // pode apresentar um resultado final de fala com requisito obrigatório aberto.
  expect(falaConsolidada).toMatchObject({
    habilidade: "FALA",
    resultado: null,
    memoria: expect.arrayContaining([
      expect.objectContaining({ avaliacaoId: "I1", nota: "8", pendencia: null }),
      expect.objectContaining({ avaliacaoId: "F1", nota: null, pendencia: "NOTA_AUSENTE" }),
    ]),
  });
  expect(consolidado.aproveitamento).toMatchObject({
    aplicacaoId: aplicada.aplicacaoId,
    fontes: [expect.objectContaining({
      habilidade: "FALA",
      tipoFonte: "APROVEITAMENTO",
      referenciaFonteAplicadaId: `${aplicada.lancamento.id}:FALA`,
    })],
  });
  const fonteDestino = (await prisma.$transaction(tx => carregarFontesEquivalenciaTx(tx, {
    matriculaId,
    alocacaoId: aplicada.alocacaoDestinoId,
    turmaId: turmaDestinoId,
    nivelId,
    regraId,
  }))).find(fonte => fonte.tipoFonte === "APROVEITAMENTO");
  expect(fonteDestino).toMatchObject({ referenciaFonteAplicadaId: `${aplicada.lancamento.id}:FALA`, nota: "8" });
  const portal = await resultadoPortalDestino(aplicada.alocacaoDestinoId);
  expect(portal.avaliacoes).toEqual([]);
  expect(portal.consolidado?.habilidades.find(habilidade => habilidade.habilidade === "FALA")).toMatchObject({
    resultado: null,
    pendencias: expect.arrayContaining(["NOTA_AUSENTE"]),
  });
  expect(await prisma.movimentacaoAluno.findUniqueOrThrow({ where: { id: aplicada.movimentacaoId } })).toMatchObject({ alunoId, matriculaId, turmaOrigemId, turmaDestinoId });
});

it("correção oficial na origem torna o requisito de destino pendente, sem atualizar a nota aplicada", async () => {
  const aplicada = await aplicarFonteFala();
  entrar(professorId);
  const proposta = await proporCorrecaoNota({
    lancamentoId: aplicada.lancamento.id,
    origemHash: aplicada.lancamento.conteudoHash,
    notas: [{ habilidade: "FALA", nota: "9", comentarioAluno: "Correção oficial da nota de origem" }],
    motivo: "Evidência posterior exige corrigir a nota oficial de origem",
    versaoEsperada: 0,
    chaveIdempotencia: "correcao-origem-aproveitada",
  });
  assertOk(proposta);
  entrar(gestorId);
  const revisao = await revisarCorrecaoNota(proposta.dado.id);
  assertOk(revisao);
  assertOk(await decidirCorrecaoNota({
    propostaId: proposta.dado.id,
    propostaHash: revisao.dado.propostaHash,
    impactosHash: revisao.dado.impactosHash,
    aprovada: true,
    motivo: "Correção de origem conferida por gestão independente",
  }));

  const leitor = await lerAplicacao(aplicada.alocacaoDestinoId);
  if (!leitor) throw new Error("Aplicação não encontrada no vínculo de destino.");
  expect(leitor.fontesAproveitadas).toEqual([]);
  expect(leitor.pendencias).toEqual(expect.arrayContaining([
    expect.objectContaining({
      codigoAvaliacao: "I1",
      habilidade: "FALA",
      situacao: "PENDENTE_FONTE_ALTERADA",
      referenciaFonteAplicadaId: `${aplicada.lancamento.id}:FALA`,
    }),
  ]));
  const consolidado = await prisma.$transaction(tx => carregarConsolidadoAvaliacoesTx(tx, professorId, aplicada.alocacaoDestinoId, "ACOMPANHAMENTO"));
  const falaConsolidada = consolidado.resultado.habilidades.find(habilidade => habilidade.habilidade === "FALA");
  expect(falaConsolidada).toMatchObject({
    habilidade: "FALA",
    resultado: null,
    memoria: expect.arrayContaining([expect.objectContaining({ avaliacaoId: "I1", nota: null })]),
  });
  expect(consolidado.aproveitamento?.pendencias).toEqual(expect.arrayContaining([
    expect.objectContaining({
      codigoAvaliacao: "I1",
      habilidade: "FALA",
      situacao: "PENDENTE_FONTE_ALTERADA",
    }),
  ]));
  const portal = await resultadoPortalDestino(aplicada.alocacaoDestinoId);
  expect(portal.consolidado?.habilidades.find(habilidade => habilidade.habilidade === "FALA")).toMatchObject({
    resultado: null,
    pendencias: expect.arrayContaining(["FONTE_APROVEITAMENTO_ALTERADA"]),
  });
  expect(await prisma.registroAvaliacaoMatricula.count({ where: { alocacaoId: aplicada.alocacaoDestinoId } })).toBe(0);
});

it("preserva a cadeia A→B→C e não duplica a fonte aproveitada no consolidado BASE_PLANO", async () => {
  const aplicadaEmB = await aplicarFonteFala();
  const turmaC = await prisma.turma.create({ data: {
    nome: "Turma C da cadeia de aproveitamento",
    modalidadeId: (await prisma.turma.findUniqueOrThrow({ where: { id: turmaDestinoId } })).modalidadeId,
    nivelId,
    professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    status: "ABERTA",
    capacidade: 10,
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  const regraC = await prisma.turma.findUniqueOrThrow({ where: { id: turmaC.id }, select: { regraAvaliacaoId: true } });
  const regraCId = regraC.regraAvaliacaoId;
  if (!regraCId) throw new Error("Turma C sem regra de avaliação publicada.");

  const fontesEmB = await prisma.$transaction((tx) => carregarFontesEquivalenciaTx(tx, {
    matriculaId,
    alocacaoId: aplicadaEmB.alocacaoDestinoId,
    turmaId: turmaDestinoId,
    nivelId,
    regraId,
  }));
  const fonteEmB = fontesEmB.find((fonte) => fonte.tipoFonte === "APROVEITAMENTO" && fonte.codigoAvaliacao === "I1" && fonte.habilidade === "FALA");
  if (!fonteEmB) throw new Error("Fonte aproveitada em B ausente.");
  expect(fonteEmB).toMatchObject({
    nota: "8",
    referenciaFonteAplicadaId: `${aplicadaEmB.lancamento.id}:FALA`,
    alocacaoOrigemAplicacaoId: alocacaoOrigemId,
    alocacaoDestinoAplicacaoId: aplicadaEmB.alocacaoDestinoId,
  });

  entrar(gestorId);
  const baseC = {
    matriculaId,
    alocacaoOrigemId: aplicadaEmB.alocacaoDestinoId,
    turmaDestinoId: turmaC.id,
    mapeamentos: [{
      referenciaFonteId: fonteEmB.referenciaId,
      codigoAvaliacaoDestino: "I1",
      habilidadeDestino: "FALA" as const,
    }],
  };
  const revisaoC = await revisarEquivalenciaTransferencia(baseC);
  assertOk(revisaoC);
  const propostaC = await proporEquivalenciaTransferencia({
    ...baseC,
    estadoHash: revisaoC.dado.estadoHash,
    versaoEsperada: revisaoC.dado.versaoAtual,
    motivo: "Cadeia de aproveitamento revisada entre as turmas B e C",
    chaveIdempotencia: "cadeia-aproveitamento-b-c",
  });
  assertOk(propostaC);
  entrar(aprovadorId);
  const decisaoC = await decidirEquivalenciaTransferencia({
    propostaId: propostaC.dado.id,
    estadoHash: revisaoC.dado.estadoHash,
    aprovar: true,
    motivo: "Decisão independente da cadeia de aproveitamento B para C",
  });
  assertOk(decisaoC);
  entrar(secretariaId);
  const aplicadaEmC = await executarEquivalenciaTransferencia({
    decisaoId: decisaoC.dado.id,
    motivo: "Secretaria executou a segunda transferência da cadeia",
    horarioCompativel: true,
  });
  assertOk(aplicadaEmC);

  const fontesEmC = await prisma.$transaction((tx) => carregarFontesEquivalenciaTx(tx, {
    matriculaId,
    alocacaoId: aplicadaEmC.dado.alocacaoDestinoId,
    turmaId: turmaC.id,
    nivelId,
    regraId: regraCId,
  }));
  const fonteEmC = fontesEmC.find((fonte) => fonte.tipoFonte === "APROVEITAMENTO" && fonte.codigoAvaliacao === "I1" && fonte.habilidade === "FALA");
  if (!fonteEmC) throw new Error("Fonte aproveitada em C ausente.");
  expect(fonteEmC).toMatchObject({
    nota: "8",
    alocacaoOrigemAplicacaoId: aplicadaEmB.alocacaoDestinoId,
    alocacaoDestinoAplicacaoId: aplicadaEmC.dado.alocacaoDestinoId,
    referenciaFonteAplicadaId: fonteEmB.referenciaId,
    fonteAplicadaHash: fonteEmB.fonteHash,
  });
  expect(await prisma.registroAvaliacaoMatricula.count({ where: { alocacaoId: aplicadaEmC.dado.alocacaoDestinoId } })).toBe(0);

  const basePlanoEmC = await prisma.$transaction((tx) => carregarConsolidadoAvaliacoesTx(tx, professorId, aplicadaEmC.dado.alocacaoDestinoId, "BASE_PLANO"));
  const fala = basePlanoEmC.resultado.habilidades.find((habilidade) => habilidade.habilidade === "FALA");
  expect(fala?.memoria.filter((memoria) => memoria.avaliacaoId === "I1")).toEqual([
    expect.objectContaining({ avaliacaoId: "I1", nota: "8", pendencia: null }),
  ]);
  expect(fala?.memoria.filter((memoria) => memoria.avaliacaoId === "F1")).toEqual([
    expect.objectContaining({ avaliacaoId: "F1", nota: null, pendencia: "NOTA_AUSENTE" }),
  ]);
  expect(basePlanoEmC.aproveitamento).toMatchObject({
    aplicacaoId: aplicadaEmC.dado.aplicacaoId,
    fontes: [expect.objectContaining({
      tipoFonte: "APROVEITAMENTO",
      codigoAvaliacao: "I1",
      habilidade: "FALA",
      referenciaFonteAplicadaId: fonteEmB.referenciaId,
    })],
  });
  const aplicacaoC = await prisma.aplicacaoEquivalenciaAvaliacao.findUniqueOrThrow({ where: { id: aplicadaEmC.dado.aplicacaoId } });
  expect(JSON.stringify(aplicacaoC.snapshotAplicado)).toContain(fonteEmB.referenciaId);
  expect(JSON.stringify(aplicacaoC.snapshotAplicado)).toContain(fonteEmB.fonteHash);
});

it("usa fontes aproveitadas na base de recuperação e conserva a melhor tentativa oficial posterior", async () => {
  const aplicada = await aplicarFontesCompletasInsuficientes();
  expect(await prisma.registroAvaliacaoMatricula.count({ where: { alocacaoId: aplicada.alocacaoDestinoId } })).toBe(0);

  const antes = await prisma.$transaction(tx => carregarConsolidadoAvaliacoesTx(tx, professorId, aplicada.alocacaoDestinoId, "BASE_PLANO"));
  const falaAntes = antes.resultado.habilidades.find(habilidade => habilidade.habilidade === "FALA");
  expect(falaAntes).toMatchObject({
    resultado: { numerador: "5", denominador: "1" },
    memoria: [
      expect.objectContaining({ avaliacaoId: "I1", nota: "5", pendencia: null }),
      expect.objectContaining({ avaliacaoId: "F1", nota: "5", pendencia: null }),
    ],
    memoriaRecuperacao: [],
  });
  expect(antes.aproveitamento?.fontes.filter(fonte => fonte.habilidade === "FALA")).toEqual(expect.arrayContaining([
    expect.objectContaining({ codigoAvaliacao: "F1", tipoFonte: "APROVEITAMENTO", referenciaFonteAplicadaId: `${aplicada.final.id}:FALA` }),
    expect.objectContaining({ codigoAvaliacao: "I1", tipoFonte: "APROVEITAMENTO", referenciaFonteAplicadaId: `${aplicada.intermediaria.id}:FALA` }),
  ]));
  expect(antes.aproveitamento?.fontes.filter(fonte => fonte.habilidade === "FALA")).toHaveLength(2);

  const melhor = await recuperarFalaNoDestino(aplicada.alocacaoDestinoId, "8", 0);
  const aposMelhor = await prisma.$transaction(tx => carregarConsolidadoAvaliacoesTx(tx, professorId, aplicada.alocacaoDestinoId, "BASE_PLANO"));
  const falaMelhor = aposMelhor.resultado.habilidades.find(habilidade => habilidade.habilidade === "FALA");
  expect(falaMelhor).toMatchObject({
    resultado: { numerador: "8", denominador: "1" },
    memoria: [
      expect.objectContaining({ avaliacaoId: "I1", nota: "5", pendencia: null }),
      expect.objectContaining({ avaliacaoId: "F1", nota: "5", pendencia: null }),
    ],
    memoriaRecuperacao: [expect.objectContaining({ tentativaId: melhor.realizacaoId, nota: "8", melhorou: true, pendencia: null })],
  });
  expect(falaMelhor?.memoria).toHaveLength(2);

  const pior = await recuperarFalaNoDestino(aplicada.alocacaoDestinoId, "4", 1);
  const aposPior = await prisma.$transaction(tx => carregarConsolidadoAvaliacoesTx(tx, professorId, aplicada.alocacaoDestinoId, "BASE_PLANO"));
  const falaFinal = aposPior.resultado.habilidades.find(habilidade => habilidade.habilidade === "FALA");
  expect(falaFinal).toMatchObject({
    resultado: { numerador: "8", denominador: "1" },
    memoria: [
      expect.objectContaining({ avaliacaoId: "I1", nota: "5", pendencia: null }),
      expect.objectContaining({ avaliacaoId: "F1", nota: "5", pendencia: null }),
    ],
    memoriaRecuperacao: [
      expect.objectContaining({ tentativaId: melhor.realizacaoId, nota: "8", melhorou: true, pendencia: null }),
      expect.objectContaining({ tentativaId: pior.realizacaoId, nota: "4", melhorou: false, pendencia: null }),
    ],
  });
  expect(falaFinal?.memoria).toHaveLength(2);
  expect(aposPior.aproveitamento?.fontes.filter(fonte => fonte.habilidade === "FALA")).toHaveLength(2);
  expect(await prisma.registroAvaliacaoMatricula.count({ where: { alocacaoId: aplicada.alocacaoDestinoId } })).toBe(0);
});

it("ACA/V01 transfere a recuperação oficial, fecha o destino e mantém isoladas duas matrículas da mesma aluna no portal", async () => {
  const intermediaria = await oficializarFala(alocacaoOrigemId, "5", "aca-v01-origem-i1");
  const final = await oficializarFinal(alocacaoOrigemId, "5", "aca-v01-origem-f1", {
    COMPREENSAO_ORAL: "8",
    LEITURA: "8",
    ESCRITA: "8",
  });
  const recuperacao = await recuperarFalaNoDestino(alocacaoOrigemId, "8", 0, ["FALA"]);
  await registrarPresencaConferida(alocacaoOrigemId, turmaOrigemId, "aca-v01-presenca-origem");

  const fontesOrigem = await prisma.$transaction(tx => carregarFontesEquivalenciaTx(tx, {
    matriculaId,
    alocacaoId: alocacaoOrigemId,
    turmaId: turmaOrigemId,
    nivelId,
    regraId,
  }));
  const fonteRecuperacao = fontesOrigem.find(fonte => fonte.tipoFonte === "RECUPERACAO" && fonte.notaRecuperacaoId === recuperacao.notaId);
  if (!fonteRecuperacao) throw new Error("A recuperação oficial da origem não ficou disponível para equivalência.");

  entrar(gestorId);
  const base = {
    matriculaId,
    alocacaoOrigemId,
    turmaDestinoId,
    mapeamentos: [
      { referenciaFonteId: fonteRecuperacao.referenciaId, codigoAvaliacaoDestino: "I1", habilidadeDestino: "FALA" as const },
      ...HABILIDADES.map(habilidade => ({ referenciaFonteId: `${final.id}:${habilidade}`, codigoAvaliacaoDestino: "F1", habilidadeDestino: habilidade })),
    ],
  };
  const revisaoEquivalencia = await revisarEquivalenciaTransferencia(base);
  assertOk(revisaoEquivalencia);
  const proposta = await proporEquivalenciaTransferencia({
    ...base,
    estadoHash: revisaoEquivalencia.dado.estadoHash,
    versaoEsperada: revisaoEquivalencia.dado.versaoAtual,
    motivo: "Recuperação oficial da origem aproveitada na transferência da jornada ACA/V01.",
    chaveIdempotencia: "aca-v01-equivalencia",
  });
  assertOk(proposta);
  entrar(aprovadorId);
  const decisao = await decidirEquivalenciaTransferencia({
    propostaId: proposta.dado.id,
    estadoHash: revisaoEquivalencia.dado.estadoHash,
    aprovar: true,
    motivo: "Aprovador independente conferiu o aproveitamento da recuperação oficial.",
  });
  assertOk(decisao);
  entrar(secretariaId);
  const executada = await executarEquivalenciaTransferencia({
    decisaoId: decisao.dado.id,
    motivo: "Secretaria executou a transferência após a equivalência aprovada.",
    horarioCompativel: true,
  });
  assertOk(executada);

  const contrato = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const turmaIsolada = await prisma.turma.create({ data: {
    nome: "Turma isolada ACA V01",
    modalidadeId: (await prisma.turma.findUniqueOrThrow({ where: { id: turmaOrigemId } })).modalidadeId,
    nivelId,
    professorId,
    dataInicio: new Date("2099-01-01T00:00:00.000Z"),
    capacidade: 10,
    vinculosDocentes: { create: { professorId, inicio } },
  } });
  await prisma.turma.update({ where: { id: turmaIsolada.id }, data: { dataInicio: inicio, status: "EM_ANDAMENTO" } });
  const matriculaIsolada = await prisma.matricula.create({ data: {
    alunoId,
    produtoId: contrato.produtoId,
    paisId: contrato.paisId,
    moeda: "CRC",
    status: "ATIVA",
    ativadaEm: inicio,
  } });
  const alocacaoIsolada = await prisma.alocacaoTurma.create({ data: {
    alunoId,
    matriculaId: matriculaIsolada.id,
    turmaId: turmaIsolada.id,
    criadoEm: inicio,
  } });
  const notaIsolada = await oficializarFala(alocacaoIsolada.id, "4", "aca-v01-isolada-i1");

  entrar(gestorId);
  const revisaoFechamento = await revisarFechamentoAcademico({ alocacaoId: executada.dado.alocacaoDestinoId });
  assertOk(revisaoFechamento);
  expect(revisaoFechamento.dado.elegibilidade).toMatchObject({ podeFechar: true, pendencias: [] });
  expect(revisaoFechamento.dado.snapshot.frequencia).toMatchObject({
    base: 1,
    presencas: 1,
    faltas: 0,
    percentual: { numerador: "100", denominador: "1" },
    atendeMinimo: true,
  });
  const fechamento = await confirmarFechamentoAcademico({
    alocacaoId: executada.dado.alocacaoDestinoId,
    estadoHash: revisaoFechamento.dado.estadoHash,
    versaoEsperada: revisaoFechamento.dado.versaoAtual,
    motivo: "Fechamento da matrícula transferida após recuperação oficial aproveitada.",
    chaveIdempotencia: "aca-v01-fechamento-destino",
  });
  assertOk(fechamento);
  expect(fechamento.dado).toMatchObject({ versao: 1, resultadoSuficiente: false });
  expect(await prisma.fechamentoAcademico.findUniqueOrThrow({ where: { id: fechamento.dado.id } })).toMatchObject({
    matriculaId,
    nivelId,
    alocacaoReferenciaId: executada.dado.alocacaoDestinoId,
    resultadoSuficiente: false,
  });

  const consolidadoDestino = await prisma.$transaction(tx => carregarConsolidadoAvaliacoesTx(
    tx,
    professorId,
    executada.dado.alocacaoDestinoId,
    "ACOMPANHAMENTO",
  ));
  expect(consolidadoDestino.resultado.habilidades.find(item => item.habilidade === "FALA")).toMatchObject({
    resultado: { numerador: "23", denominador: "4" },
    memoria: [
      expect.objectContaining({ avaliacaoId: "I1", nota: "8", pendencia: null }),
      expect.objectContaining({ avaliacaoId: "F1", nota: "5", pendencia: null }),
    ],
  });

  const portal = await consultarResultadosPortalAluno({
    sessaoId: "sessao-aca-v01",
    contaId: "conta-aca-v01",
    alunoId,
    email: "aluna-aca-v01@portal.test",
  });
  const principal = portal.matriculas.find(item => item.matriculaId === matriculaId);
  const isolada = portal.matriculas.find(item => item.matriculaId === matriculaIsolada.id);
  expect(portal.matriculas).toHaveLength(2);
  expect(principal?.alocacoes.find(item => item.alocacaoId === alocacaoOrigemId)?.frequencia).toMatchObject({
    base: 1,
    presencas: 1,
    faltas: 0,
    percentual: { numerador: "100", denominador: "1" },
    atendeMinimo: null,
    pendencias: 1,
  });
  const destinoPortal = principal?.alocacoes.find(item => item.alocacaoId === executada.dado.alocacaoDestinoId);
  expect(destinoPortal).toMatchObject({
    situacao: "PARCIAL_NAO_FINAL",
    resultadoFinal: null,
    avaliacoes: [],
    recuperacoes: [],
    frequencia: { base: 0, presencas: 0, faltas: 0, percentual: null, atendeMinimo: null, pendencias: 1 },
    consolidado: { completa: true, geral: { numerador: "119", denominador: "16" }, atendeGeral: true, atendeRequisitosNotas: false, recuperacoesPendentes: false },
  });
  expect(destinoPortal?.consolidado?.habilidades.find(item => item.habilidade === "FALA")).toMatchObject({
    resultado: { numerador: "23", denominador: "4" },
    atendeMinimo: false,
    pendencias: [],
  });
  expect(isolada).toMatchObject({ matriculaId: matriculaIsolada.id, alocacoes: [expect.objectContaining({ alocacaoId: alocacaoIsolada.id })] });
  expect(isolada?.alocacoes[0]?.avaliacoes).toEqual([expect.objectContaining({ codigo: "I1", notas: [expect.objectContaining({ habilidade: "FALA", nota: "4" })] })]);
  expect(JSON.stringify(isolada)).not.toContain(intermediaria.id);
  expect(JSON.stringify(isolada)).not.toContain(fonteRecuperacao.referenciaId);
  expect(JSON.stringify(isolada)).not.toContain(fechamento.dado.id);
  expect(notaIsolada.id).not.toBe(intermediaria.id);
});
