import { beforeEach, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async original => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: async (...papeis: import("@prisma/client").Papel[]) => {
    const session = await authMock(); const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id } });
    if (!usuario.ativo) throw new real.ErroPermissao(); real.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { receberTx } from "@/server/financeiro/recebimentos";
import { prepararCondicoesHoras, decidirCondicoesHoras } from "./condicoes-horas";
import { registrarCompraHorasAntecipadas } from "./compra-horas";
import { reservarHorasCompradasParaEncontro } from "./reserva-horas-compradas";
import { conferirRealizacaoHoras } from "./consumo-horas";
import { registrarOcorrenciaParticular } from "./ocorrencia-particular";
import { preverConferenciaOcorrenciaHoras } from "./ocorrencia-financeira-previa";
import { conferirOcorrenciaHoras } from "./ocorrencia-financeira-conferir";
import { proporRevisaoFinanceiraCorrecaoAula, decidirRevisaoFinanceiraCorrecaoAula } from "@/server/financeiro/revisao-correcao-aula";
import { aprovarCorrecaoAula, proporCorrecaoAula, revisarCorrecaoAula, revisarImpactosCorrecaoAula } from "@/server/diario/correcao-aula";

let alunoId: string, matriculaId: string, financeiroId: string, aprovadorFinanceiroId: string, secretariaId: string, adminId: string, condicoesId: string;
const login = (id: string) => authMock.mockResolvedValue({ user: { id } });
const regras = { valorHora: "100.00", moeda: "CRC", unidadeMinutos: 60 as const, vigenteDesde: "2026-01-01T00:00:00Z", antecedenciaCancelamentoMinutos: 90, clausulaPreco: "Preço histórico", clausulaCancelamento: "Cancelamento histórico" };

beforeEach(async () => {
  await truncarBanco(); const catalogo = await seedCatalogoMinimo();
  financeiroId = (await criarUsuario(["FINANCEIRO"])).id; aprovadorFinanceiroId = (await criarUsuario(["FINANCEIRO"])).id;
  secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id; adminId = (await criarUsuario(["ADMINISTRADOR"])).id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Consumo Q23", paisId: catalogo.pais.id } }); alunoId = aluno.id;
  const matricula = await prisma.matricula.create({ data: { alunoId, paisId: catalogo.pais.id, produtoId: catalogo.produto.id, moeda: "CRC", status: "ATIVA" } }); matriculaId = matricula.id;
  const documento = await prisma.documento.create({ data: { matriculaId, categoria: "CONTRATO", nome: "Contrato de horas", url: "/api/files/q23-consumo.pdf" } });
  await prisma.matricula.update({ where: { id: matriculaId }, data: { contratoOk: true, contratoDocumentoId: documento.id, confirmacaoContratoPorId: secretariaId, confirmacaoContratoEm: new Date() } });
  login(secretariaId); const condicoes = await prepararCondicoesHoras({ matriculaId, documentoId: documento.id, regras, motivo: "Condições contratadas para a conferência Q92" });
  if (!condicoes.ok || !condicoes.dado) throw new Error("Condições ausentes");
  login(adminId); expect(await decidirCondicoesHoras({ id: condicoes.dado.id, aprovar: true, motivo: "Condições aprovadas por pessoa distinta" })).toMatchObject({ ok: true }); condicoesId = condicoes.dado.id;
});

async function prepararCompraEReservas() {
  const cobranca = await prisma.cobranca.create({ data: { matriculaId, tipo: "HORA_PARTICULAR", moeda: "CRC", valorOriginal: 300, valorNegociado: 300, valorRecebido: 0, saldo: 300, status: "PENDENTE", vencimento: new Date("2026-10-10T00:00:00Z") } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, chaveIdempotencia: "q23-consumo-recebimento", autorId: financeiroId, valorRecebido: 300, moeda: "CRC", forma: "TRANSFERENCIA", dataPagamento: new Date(), evidencia: "Recebimento quitado da compra antecipada" }));
  const atual = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } }); login(financeiroId);
  const compra = await registrarCompraHorasAntecipadas({ alunoId, matriculaId, cobrancaId: cobranca.id, versaoCobranca: atual.versao, minutosComprados: 180, evidenciaCondicoes: "Compra previamente quitada e conciliada", chaveIdempotencia: "q23-consumo-compra" });
  if (!compra.ok || !compra.dado) throw new Error(compra.ok ? "Compra ausente" : compra.erro);
  const inicio = new Date(Date.now() + 5_000), fim = new Date(inicio.getTime() + 60_000);
  const [professorDiario, professorFalta] = await Promise.all([criarUsuario(["PROFESSOR"]), criarUsuario(["PROFESSOR"])]);
  const encontros = await Promise.all([professorDiario, professorFalta].map((professor, indice) => prisma.encontroAgenda.create({ data: { matriculaId, professorId: professor.id, preparadorId: adminId, inicio, fim, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula particular reservada", chaveIdempotencia: `q23-consumo-encontro-${indice}`, entradaHash: "fixture" } })));
  const reservas = await Promise.all(encontros.map((encontro, indice) => reservarHorasCompradasParaEncontro({ compraId: compra.dado!.id, encontroId: encontro.id, motivo: "Reserva antecipada para a aula particular", chaveIdempotencia: `q23-consumo-reserva-${indice}` })));
  const reservasConfirmadas = reservas.map(r => {
    if (!r.ok || !r.dado) throw new Error("Reserva ausente");
    return r.dado;
  });
  const [diario, falta] = encontros;
  await prisma.aulaDiario.create({ data: { encontroId: diario.id, professorId: professorDiario.id, ocorridaEm: inicio, conteudo: "Aula realizada e registrada.", registros: { create: { alunoId, matriculaId, nomeAluno: "Consumo Q23", presente: true, participacao: "PRESENTE" } } } });
  await prisma.aulaDiario.create({ data: { encontroId: falta.id, professorId: professorFalta.id, ocorridaEm: inicio, conteudo: "Aula registrada como falta.", registros: { create: { alunoId, matriculaId, nomeAluno: "Consumo Q23", presente: false, participacao: "FALTA" } } } });
  await new Promise(resolve => setTimeout(resolve, Math.max(0, fim.getTime() - Date.now()) + 600));
  return { cobrancaId: cobranca.id, compraId: compra.dado.id, diario: { encontro: diario, reservaId: reservasConfirmadas[0].id, professorId: professorDiario.id }, falta: { encontro: falta, reservaId: reservasConfirmadas[1].id, professorId: professorFalta.id } };
}

const dinheiro = (valor: { toFixed: (casas: number) => string } | null) => valor?.toFixed(2) ?? null;

/** Todas as fontes financeiras que a revisão SEM_ALTERACAO_VALORES precisa preservar. */
async function fotografiaFinanceiraImutavel(cobrancaId: string, compraId: string) {
  const [cobranca, informes, recebimentos, destinacoes, compra, reservas] = await Promise.all([
    prisma.cobranca.findUniqueOrThrow({ where: { id: cobrancaId }, select: { id: true, versao: true, status: true, valorOriginal: true, valorNegociado: true, valorRecebido: true, saldo: true, valorLiquidadoCredito: true, valorCompensadoPermuta: true, moeda: true } }),
    prisma.pagamentoInformado.findMany({ where: { cobrancaId }, orderBy: { id: "asc" }, select: { id: true, cobrancaId: true, autorId: true, conferenteId: true, status: true, versao: true, hashDados: true, valor: true, moeda: true, forma: true, dataPagamento: true, permitirExcedente: true, motivoConferencia: true } }),
    prisma.recebimento.findMany({ where: { cobrancaId }, orderBy: { id: "asc" }, select: { id: true, cobrancaId: true, titularMatriculaId: true, informeId: true, autorId: true, valor: true, moeda: true, forma: true, dataPagamento: true, hashDados: true } }),
    prisma.destinacaoRecebimento.findMany({ where: { cobrancaId }, orderBy: { id: "asc" }, select: { id: true, recebimentoId: true, cobrancaId: true, autorId: true, tipo: true, valor: true, evidencia: true, origemLegada: true, chaveIdempotencia: true } }),
    prisma.compraHorasAntecipadas.findUniqueOrThrow({ where: { id: compraId }, select: { id: true, matriculaId: true, cobrancaId: true, documentoId: true, registradorId: true, minutosComprados: true, valorOriginal: true, descontoOriginal: true, valorPagoAlocado: true, moeda: true, evidenciaCondicoes: true, snapshot: true, entradaHash: true } }),
    prisma.reservaHorasCompradas.findMany({ where: { compraId }, orderBy: { id: "asc" }, select: { id: true, compraId: true, encontroId: true, autorId: true, minutos: true, inicio: true, fim: true, motivo: true, entradaHash: true } }),
  ]);
  const consumos = await prisma.consumoHorasCompradas.findMany({ where: { reservaId: { in: reservas.map(r => r.id) } }, orderBy: { id: "asc" }, select: { id: true, reservaId: true, conferenciaOcorrenciaId: true, autorId: true, motivo: true, estadoDiario: true } });
  return {
    cobranca: { ...cobranca, valorOriginal: dinheiro(cobranca.valorOriginal), valorNegociado: dinheiro(cobranca.valorNegociado), valorRecebido: dinheiro(cobranca.valorRecebido), saldo: dinheiro(cobranca.saldo), valorLiquidadoCredito: dinheiro(cobranca.valorLiquidadoCredito), valorCompensadoPermuta: dinheiro(cobranca.valorCompensadoPermuta) },
    informes: informes.map(i => ({ ...i, valor: dinheiro(i.valor), dataPagamento: i.dataPagamento.toISOString() })),
    recebimentos: recebimentos.map(r => ({ ...r, valor: dinheiro(r.valor), dataPagamento: r.dataPagamento.toISOString() })),
    destinacoes: destinacoes.map(d => ({ ...d, valor: dinheiro(d.valor) })),
    compra: { ...compra, valorOriginal: dinheiro(compra.valorOriginal), descontoOriginal: dinheiro(compra.descontoOriginal), valorPagoAlocado: dinheiro(compra.valorPagoAlocado) },
    reservas: reservas.map(r => ({ ...r, inicio: r.inicio.toISOString(), fim: r.fim.toISOString() })),
    consumos,
  };
}

async function aprovarCondicaoPosterior(documentoId: string) {
  login(secretariaId);
  const posterior = await prepararCondicoesHoras({ matriculaId, documentoId, regras: { ...regras, valorHora: "900.00", vigenteDesde: "2026-12-01T00:00:00Z", clausulaPreco: "Preço posterior que não reprifica consumo passado" }, motivo: "Nova tabela contratual somente para períodos futuros" });
  if (!posterior.ok || !posterior.dado) throw new Error(posterior.ok ? "Condições posteriores ausentes" : posterior.erro);
  login(adminId);
  expect(await decidirCondicoesHoras({ id: posterior.dado.id, aprovar: true, motivo: "Condições posteriores aprovadas por pessoa distinta" })).toMatchObject({ ok: true });
}

async function proporQ23(encontroId: string, professorId: string, participacao: "PRESENTE" | "FALTA", chave: string) {
  login(professorId); const atual = await revisarCorrecaoAula({ encontroId });
  if (!atual.ok || !atual.dado) throw new Error(atual.ok ? "Q23 sem revisão" : atual.erro);
  const proposta = await proporCorrecaoAula({ encontroId, estadoHash: atual.dado.estadoHash, versaoEsperada: atual.dado.versaoAtual, motivo: "Correção documental da participação da aula.", evidencia: "Evidência pedagógica preservada para correção.", chaveIdempotencia: chave, alteracao: { conteudo: atual.dado.snapshot.conteudo, registros: atual.dado.snapshot.registros.map(r => ({ registroId: r.registroId, participacao, observacao: r.observacao ?? "" })) } });
  if (!proposta.ok || !proposta.dado) throw new Error(proposta.ok ? "Proposta Q23 ausente" : proposta.erro);
  return proposta.dado;
}

async function prepararEAprovarRevisao(propostaId: string, chave: string) {
  login(financeiroId); const revisao = await proporRevisaoFinanceiraCorrecaoAula({ propostaCorrecaoAulaId: propostaId, motivo: "Q92 mantém o consumo e o valor histórico da compra.", chaveIdempotencia: chave });
  if (!revisao.ok || !revisao.dado) throw new Error(revisao.ok ? "Revisão financeira ausente" : revisao.erro);
  login(aprovadorFinanceiroId); const decisao = await decidirRevisaoFinanceiraCorrecaoAula({ propostaId: revisao.dado.id, aprovada: true, motivo: "Equivalência financeira conferida por pessoa distinta." });
  if (!decisao.ok || !decisao.dado) throw new Error(decisao.ok ? "Decisão financeira ausente" : decisao.erro);
  return { revisaoId: revisao.dado.id, decisaoId: decisao.dado.id };
}

async function publicarCorrecao(propostaId: string, decisaoId: string) {
  const gestor = await criarUsuario(["GERENTE_PEDAGOGICO"]); login(gestor.id); const impactos = await revisarImpactosCorrecaoAula({ propostaId });
  if (!impactos.ok || !impactos.dado) throw new Error(impactos.ok ? "Impactos ausentes" : impactos.erro);
  return aprovarCorrecaoAula({ propostaId, propostaHash: impactos.dado.propostaHash, impactosHash: impactos.dado.impactosHash, motivo: "Gestão publica a correção com revisão financeira válida.", revisaoFinanceiraDecisaoId: decisaoId });
}

async function decidirEPublicar(propostaId: string, chave: string) {
  const { revisaoId, decisaoId } = await prepararEAprovarRevisao(propostaId, chave);
  expect(await publicarCorrecao(propostaId, decisaoId)).toMatchObject({ ok: true });
  return revisaoId;
}

it("Q23 corrige presença para falta com reserva já consumida pelo diário, sem duplicar cobrança ou consumo", async () => {
  const fonte = await prepararCompraEReservas(); login(financeiroId);
  const previa = await conferirRealizacaoHoras({ reservaId: fonte.diario.reservaId }); if (!previa.ok || !previa.dado?.estadoDiario) throw new Error("Prévia do diário ausente");
  expect(await conferirRealizacaoHoras({ reservaId: fonte.diario.reservaId, estadoDiario: previa.dado.estadoDiario, motivo: "Realização original conferida pelo Financeiro" })).toMatchObject({ ok: true });
  await prisma.encontroAgenda.update({ where: { id: fonte.diario.encontro.id }, data: { status: "MINISTRADO" } });
  const antes = await fotografiaFinanceiraImutavel(fonte.cobrancaId, fonte.compraId);
  const documentoId = (await prisma.compraHorasAntecipadas.findUniqueOrThrow({ where: { id: fonte.compraId }, select: { documentoId: true } })).documentoId;
  await aprovarCondicaoPosterior(documentoId);
  const q23 = await proporQ23(fonte.diario.encontro.id, fonte.diario.professorId, "FALTA", "q23-consumo-diario-proposta");
  login(financeiroId);
  const revisao = await proporRevisaoFinanceiraCorrecaoAula({ propostaCorrecaoAulaId: q23.id, motivo: "Q92 mantém o consumo e o valor histórico da compra.", chaveIdempotencia: "q23-consumo-diario-revisao" });
  if (!revisao.ok || !revisao.dado) throw new Error(revisao.ok ? "Revisão financeira ausente" : revisao.erro);
  expect(await decidirRevisaoFinanceiraCorrecaoAula({ propostaId: revisao.dado.id, aprovada: true, motivo: "O preparador não pode autoaprovar a revisão." })).toMatchObject({ ok: false });
  login(aprovadorFinanceiroId);
  const decisao = await decidirRevisaoFinanceiraCorrecaoAula({ propostaId: revisao.dado.id, aprovada: true, motivo: "Equivalência financeira conferida por pessoa distinta." });
  if (!decisao.ok || !decisao.dado) throw new Error(decisao.ok ? "Decisão financeira ausente" : decisao.erro);
  login((await criarUsuario(["GERENTE_PEDAGOGICO"])).id);
  const impactos = await revisarImpactosCorrecaoAula({ propostaId: q23.id });
  if (!impactos.ok || !impactos.dado) throw new Error(impactos.ok ? "Impactos ausentes" : impactos.erro);
  expect(await aprovarCorrecaoAula({ propostaId: q23.id, propostaHash: impactos.dado.propostaHash, impactosHash: impactos.dado.impactosHash, motivo: "Gestão não publica sem decisão financeira vinculada." })).toMatchObject({ ok: false });
  expect(await aprovarCorrecaoAula({ propostaId: q23.id, propostaHash: impactos.dado.propostaHash, impactosHash: impactos.dado.impactosHash, motivo: "Gestão publica a correção com revisão financeira válida.", revisaoFinanceiraDecisaoId: decisao.dado.id })).toMatchObject({ ok: true });
  const revisaoId = revisao.dado.id;
  const revisaoPersistida = await prisma.propostaRevisaoFinanceiraCorrecaoAula.findUniqueOrThrow({ where: { id: revisaoId } });
  expect(revisaoPersistida.fotografia).toMatchObject({ reservaConsumida: { id: fonte.diario.reservaId, fonte: "DIARIO_REALIZADO" }, compraAntecipada: { id: fonte.compraId, valorPagoAlocado: 300 }, fundamento: { participacaoAnterior: "PRESENTE", participacaoProposta: "FALTA", valorPreservado: 1.67 } });
  expect((revisaoPersistida.fotografia as { fundamento: { valorPreservado: number } }).fundamento.valorPreservado).not.toBe(15);
  expect(await fotografiaFinanceiraImutavel(fonte.cobrancaId, fonte.compraId)).toEqual(antes);
  expect(await prisma.aprovacaoCorrecaoAula.count({ where: { propostaId: q23.id } })).toBe(1);
}, 90_000);

it("Q23 corrige falta para presença com consumo por conferência Q92, preservando a fonte imutável", async () => {
  const fonte = await prepararCompraEReservas(); login(fonte.falta.professorId);
  const ocorrencia = await registrarOcorrenciaParticular({ encontroId: fonte.falta.encontro.id, versaoAnterior: 0, tipo: "FALTA_ALUNO", evidencia: "Falta comunicada após o encontro", chaveIdempotencia: "q23-consumo-falta-ocorrencia" });
  if (!ocorrencia.ok || !ocorrencia.dado) throw new Error(ocorrencia.ok ? "Ocorrência ausente" : ocorrencia.erro);
  login(financeiroId); const entrada = { alunoId, matriculaId, ocorrenciaId: ocorrencia.dado.id, condicoesId };
  const previa = await preverConferenciaOcorrenciaHoras(entrada); if (!previa.ok || !previa.dado) throw new Error(previa.ok ? "Prévia Q92 ausente" : previa.erro);
  expect(await conferirOcorrenciaHoras({ ...entrada, estadoPrevia: previa.dado.estadoPrevia, motivo: "Falta cobrável conferida contra compra antecipada", chaveIdempotencia: "q23-consumo-falta-conferencia" })).toMatchObject({ ok: true });
  await prisma.encontroAgenda.update({ where: { id: fonte.falta.encontro.id }, data: { status: "MINISTRADO" } });
  const antes = await fotografiaFinanceiraImutavel(fonte.cobrancaId, fonte.compraId);
  const q23 = await proporQ23(fonte.falta.encontro.id, fonte.falta.professorId, "PRESENTE", "q23-consumo-falta-proposta");
  const revisaoId = await decidirEPublicar(q23.id, "q23-consumo-falta-revisao");
  const revisao = await prisma.propostaRevisaoFinanceiraCorrecaoAula.findUniqueOrThrow({ where: { id: revisaoId } });
  expect(revisao.fotografia).toMatchObject({ reservaConsumida: { id: fonte.falta.reservaId, fonte: "OCORRENCIA_Q92" }, conferencia: { desfecho: "FALTA_COBRAVEL" }, fundamento: { participacaoAnterior: "FALTA", participacaoProposta: "PRESENTE", valorPreservado: 1.67 } });
  expect(await fotografiaFinanceiraImutavel(fonte.cobrancaId, fonte.compraId)).toEqual(antes);
  expect(await prisma.aprovacaoCorrecaoAula.count({ where: { propostaId: q23.id } })).toBe(1);
}, 90_000);

it("Q23 ancora a matrícula: condição aplicável aguarda a foto e invalida a publicação antiga", async () => {
  const fonte = await prepararCompraEReservas(); login(financeiroId);
  const previa = await conferirRealizacaoHoras({ reservaId: fonte.diario.reservaId }); if (!previa.ok || !previa.dado?.estadoDiario) throw new Error("Prévia do diário ausente");
  expect(await conferirRealizacaoHoras({ reservaId: fonte.diario.reservaId, estadoDiario: previa.dado.estadoDiario, motivo: "Realização original conferida para provar a âncora" })).toMatchObject({ ok: true });
  await prisma.encontroAgenda.update({ where: { id: fonte.diario.encontro.id }, data: { status: "MINISTRADO" } });
  const q23 = await proporQ23(fonte.diario.encontro.id, fonte.diario.professorId, "FALTA", "q23-ancora-proposta");
  const { decisaoId } = await prepararEAprovarRevisao(q23.id, "q23-ancora-revisao");

  let liberar!: () => void, fotoPronta!: () => void;
  const aguardarLiberacao = new Promise<void>(resolve => { liberar = resolve; });
  const aguardandoFoto = new Promise<void>(resolve => { fotoPronta = resolve; });
  let pidFoto = 0;
  const fotoTravada = prisma.$transaction(async tx => {
    const [linha] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid`;
    pidFoto = linha.pid;
    const foto = await tx.$queryRaw<{ fotografiaHash: string }[]>`SELECT "fotografiaHash" FROM q23_fotografia_financeira_materializada_257(${q23.id})`;
    expect(foto).toHaveLength(1);
    fotoPronta();
    await aguardarLiberacao;
  });
  await aguardandoFoto;
  const documentoId = (await prisma.compraHorasAntecipadas.findUniqueOrThrow({ where: { id: fonte.compraId }, select: { documentoId: true } })).documentoId;
  login(secretariaId);
  const preparar = prepararCondicoesHoras({ matriculaId, documentoId, regras: { ...regras, vigenteDesde: "2026-01-01T00:00:00Z", valorHora: "900.00", clausulaPreco: "Preço aplicável que torna a foto anterior obsoleta" }, motivo: "Condição aplicável preparada durante conferência financeira" });
  const limite = Date.now() + 5_000;
  let bloqueada = false;
  while (Date.now() < limite && !bloqueada) {
    const linhas = await prisma.$queryRaw<{ esperando: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity atividade
        WHERE atividade.wait_event_type='Lock'
          AND atividade.query LIKE '%FROM "Matricula"%'
          AND ${pidFoto}=ANY(pg_blocking_pids(atividade.pid))
      ) AS esperando`;
    bloqueada = linhas[0]?.esperando === true;
    if (!bloqueada) await new Promise(resolve => setTimeout(resolve, 50));
  }
  expect(bloqueada).toBe(true);
  liberar();
  await fotoTravada;
  const condicao = await preparar;
  expect(condicao).toMatchObject({ ok: true });

  login((await criarUsuario(["GERENTE_PEDAGOGICO"])).id);
  const impactos = await revisarImpactosCorrecaoAula({ propostaId: q23.id });
  if (!impactos.ok || !impactos.dado) throw new Error(impactos.ok ? "Impactos ausentes" : impactos.erro);
  const publicacao = await aprovarCorrecaoAula({ propostaId: q23.id, propostaHash: impactos.dado.propostaHash, impactosHash: impactos.dado.impactosHash, motivo: "Tentativa com fotografia financeira que já ficou obsoleta.", revisaoFinanceiraDecisaoId: decisaoId });
  expect(publicacao).toMatchObject({ ok: false });
  expect(await prisma.aprovacaoCorrecaoAula.count({ where: { propostaId: q23.id } })).toBe(0);
}, 100_000);

it("Q175 horas pré-pagas: aula não cobrável estorna o consumo e devolve os minutos à mesma compra, sem mover dinheiro", async () => {
  const fonte = await prepararCompraEReservas(); login(financeiroId);
  const previa = await conferirRealizacaoHoras({ reservaId: fonte.diario.reservaId }); if (!previa.ok || !previa.dado?.estadoDiario) throw new Error("Prévia do diário ausente");
  expect(await conferirRealizacaoHoras({ reservaId: fonte.diario.reservaId, estadoDiario: previa.dado.estadoDiario, motivo: "Realização original conferida pelo Financeiro" })).toMatchObject({ ok: true });
  await prisma.encontroAgenda.update({ where: { id: fonte.diario.encontro.id }, data: { status: "MINISTRADO" } });
  const antes = await fotografiaFinanceiraImutavel(fonte.cobrancaId, fonte.compraId);
  const consumo = await prisma.consumoHorasCompradas.findUniqueOrThrow({ where: { reservaId: fonte.diario.reservaId } });
  const { consultarComprasHorasAntecipadas: consultarComprasHoras } = await import("./compra-horas");
  const saldo = async () => { login(financeiroId); const r = await consultarComprasHoras({ alunoId, matriculaId }); if (!r.ok || !r.dado) throw new Error(JSON.stringify(r)); return r.dado.compras.find(c => c.id === fonte.compraId)!; };
  expect(await saldo()).toMatchObject({ minutosConsumidos: 1, minutosReservados: 1, minutosDisponiveis: 178 });

  // Opção A: o diário registra o fato no conteúdo, sem mexer na presença; o Financeiro declara a aula não cobrável.
  login(fonte.diario.professorId); const atual = await revisarCorrecaoAula({ encontroId: fonte.diario.encontro.id }); if (!atual.ok || !atual.dado) throw new Error("Q23 ausente");
  const q23 = await proporCorrecaoAula({ encontroId: fonte.diario.encontro.id, estadoHash: atual.dado.estadoHash, versaoEsperada: atual.dado.versaoAtual, motivo: "Aula lançada, mas não realizada por falha da escola.", evidencia: "Registro da coordenação sobre a indisponibilidade.", chaveIdempotencia: "q175b-proposta",
    alteracao: { conteudo: "Aula não realizada: indisponibilidade de responsabilidade da escola.", registros: atual.dado.snapshot.registros.map(r => ({ registroId: r.registroId, participacao: r.participacao, observacao: r.observacao })) } });
  if (!q23.ok || !q23.dado) throw new Error(JSON.stringify(q23));
  login(financeiroId); const revisao = await proporRevisaoFinanceiraCorrecaoAula({ propostaCorrecaoAulaId: q23.dado.id, tipo: "AULA_NAO_COBRAVEL", motivo: "Aula não ocorreu; os minutos pré-pagos devem voltar ao saldo.", chaveIdempotencia: "q175b-revisao" });
  if (!revisao.ok || !revisao.dado) throw new Error(JSON.stringify(revisao));
  expect((await prisma.propostaRevisaoFinanceiraCorrecaoAula.findUniqueOrThrow({ where: { id: revisao.dado.id } })).fotografia).toMatchObject({ tipo: "AULA_NAO_COBRAVEL", efeito: { tipo: "DEVOLVE_MINUTOS", consumoId: consumo.id, compraId: fonte.compraId, minutos: 1 } });
  login(aprovadorFinanceiroId); const decisao = await decidirRevisaoFinanceiraCorrecaoAula({ propostaId: revisao.dado.id, aprovada: true, motivo: "Efeito conferido por outra pessoa do Financeiro." });
  if (!decisao.ok || !decisao.dado) throw new Error(JSON.stringify(decisao));
  // Estorno direto, sem a aplicação aprovada, é recusado pelo banco.
  await expect(prisma.estornoConsumoHorasCompradas.create({ data: { consumoId: consumo.id, aplicacaoId: "inexistente", compraId: fonte.compraId, minutos: 1 } })).rejects.toThrow();
  const publicada = await publicarCorrecao(q23.dado.id, decisao.dado.id); if (!publicada.ok) throw new Error(JSON.stringify(publicada));

  expect(await prisma.aplicacaoRevisaoFinanceiraCorrecaoAula.findMany()).toMatchObject([{ efeito: "DEVOLVE_MINUTOS", minutosDevolvidos: 1, cobrancaId: null, creditoValor: null }]);
  expect(await prisma.estornoConsumoHorasCompradas.findMany()).toMatchObject([{ consumoId: consumo.id, compraId: fonte.compraId, minutos: 1 }]);
  await expect(prisma.estornoConsumoHorasCompradas.deleteMany()).rejects.toThrow();
  // Nenhum dinheiro se move e o histórico (reserva e consumo) permanece.
  expect(await fotografiaFinanceiraImutavel(fonte.cobrancaId, fonte.compraId)).toEqual(antes);
  expect(await prisma.creditoMatricula.count()).toBe(0);
  expect(await prisma.consumoHorasCompradas.findUnique({ where: { id: consumo.id } })).toEqual(consumo);
  // Os minutos voltaram ao saldo visível e ao guard de reserva do banco.
  expect(await saldo()).toMatchObject({ minutosConsumidos: 0, minutosEstornados: 1, minutosReservados: 1, minutosDisponiveis: 179 });
  const novoInicio = new Date(Date.now() + 3_600_000), novoFim = new Date(novoInicio.getTime() + 179 * 60_000);
  const novo = await prisma.encontroAgenda.create({ data: { matriculaId, professorId: fonte.diario.professorId, preparadorId: adminId, inicio: novoInicio, fim: novoFim, fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula remarcada com os minutos devolvidos", chaveIdempotencia: "q175b-encontro-novo", entradaHash: "fixture" } });
  login(financeiroId);
  expect(await reservarHorasCompradasParaEncontro({ compraId: fonte.compraId, encontroId: novo.id, motivo: "Reserva usando todos os minutos disponíveis", chaveIdempotencia: "q175b-reserva-nova" })).toMatchObject({ ok: true });
  expect(await saldo()).toMatchObject({ minutosDisponiveis: 0 });
  // A mesma aula não admite segunda declaração.
  login(financeiroId);
  const { consultarRevisoesFinanceirasCorrecaoAula } = await import("@/server/financeiro/revisao-correcao-aula");
  expect(await consultarRevisoesFinanceirasCorrecaoAula({ matriculaId })).toMatchObject({ ok: true, dado: { candidatas: [] } });
}, 120_000);
