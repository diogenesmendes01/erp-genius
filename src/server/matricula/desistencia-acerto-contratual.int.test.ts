import { beforeEach, expect, it, vi } from "vitest";
import { FormaPagamento, Papel, Prisma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/server/_shared")>();
  const sessao = async () => {
    const autenticacao = await authMock();
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: autenticacao.user.id } });
    if (!usuario.ativo) throw new atual.ErroAutenticacao();
    return usuario;
  };
  return { ...atual, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); atual.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { preservarConclusaoAssinaturaTx } from "@/server/contratos/conclusao-assinatura-tx";
import { IdentidadeSignatarioSchema } from "@/server/contratos/participantes-schema";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { carregarRevisaoAceite } from "@/server/contratos/aceite-estado";
import { confirmarAceiteOriginalTx } from "@/server/contratos/aceite-tx";
import { prepararSubstituicaoContratualTx, decidirSubstituicaoContratualTx } from "@/server/contratos/substituicao-tx";
import { iniciarCancelamentoAssinaturaTx, registrarObservacaoCancelamentoTx, registrarObservacaoCancelamentoDesistenciaTx } from "@/server/contratos/cancelamento-assinatura-tx";
import { prepararProcessoEnvioTx, iniciarTentativaAssinaturaTx, registrarResultadoEnvioTx } from "@/server/contratos/envio-tx";
import { prepararCondicoesEncerramento, decidirCondicoesEncerramento } from "./condicoes-encerramento";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";
import { decidirDesistenciaAdministrativa } from "./desistencia-administrativa";
import { prepararAcertoDesistenciaContratual, decidirAcertoDesistenciaContratual } from "./desistencia-acerto-contratual";
import { aplicarAcertoDesistenciaContratual } from "./desistencia-acerto-aplicacao";
import { iniciarCancelamentoAssinaturaDesistencia } from "./desistencia-cancelamento-assinatura";
import { efetivarPedidoDesistenciaPreparacao } from "./desistencia-efetivacao";
import { receberTx } from "@/server/financeiro/recebimentos";
import { registrarPagamento, registrarRecebimentoDestinado } from "@/server/financeiro/acoes";
import { z } from "zod";

let base: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>;
let financeiroPreparador: Awaited<ReturnType<typeof criarUsuario>>;
let financeiroAprovador: typeof financeiroPreparador;
let condicoesId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const regras = {
  diaEncerramento: "EXCLUIR" as const, metodoDesconto: "ANTES_DO_PROPORCIONAL" as const,
  condicoesDescontos: "Condições de desistência transcritas do contrato aceito.",
  multa: { tipo: "SEM_PREVISAO" as const, motivo: "A regra específica substitui a multa genérica." },
  acertoDesistenciaPreparacao: { tipo: "VALOR_FIXO" as const, valor: "50.00", clausulaId: "7.6",
    condicoesAplicacao: { momento: "ANTES_ATIVACAO" as const, unidade: "POR_COBRANCA" as const,
      alcance: { tipo: "TODAS_COBRANCAS_MATRICULA" as const } } },
};

function dado<T>(r: { ok: boolean; dado?: T; erro?: string }): T {
  if (!r.ok || r.dado === undefined) throw new Error(r.erro ?? "Resultado ausente.");
  return r.dado;
}

async function confirmarContratoReal() {
  return confirmarContratoDoProcesso(base.processoId, base.referenciaExternaFonte, "aceite-q165");
}

async function confirmarContratoDoProcesso(processoId: string, referenciaExterna: string, chave: string) {
  const processo = await prisma.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: processoId }, include: { artefato: { include: { conferencia: true } } } });
  const participantes = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(processo.artefato.conferencia.snapshot);
  const envio = await prisma.tentativaEnvioAssinatura.findFirstOrThrow({ where: { processoId: processo.id }, orderBy: { numero: "desc" } });
  const conclusao = await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, {
    processoId: processo.id, referenciaExterna, originalHash: processo.artefato.pdfHash,
    concluidaEm: envio.iniciadaEm.toISOString(), pdfAssinado: Buffer.from("%PDF-assinado"), evidencias: Buffer.from("evidencia"),
    assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(participantes.participantes[0].identidade), referenciaAssinatura: "assinatura-q165", assinadaEm: envio.iniciadaEm.toISOString() }],
  }));
  const revisao = await prisma.$transaction(tx => carregarRevisaoAceite(tx, base.matriculaId, conclusao.id));
  await prisma.$transaction(tx => confirmarAceiteOriginalTx(tx, base.secretariaId, {
    matriculaId: base.matriculaId, conclusaoId: conclusao.id, revisaoHash: revisao.revisaoHash,
    evidenciasConferidas: true, motivo: "Aceite original conferido para o acerto contratual.", chaveIdempotencia: chave,
  }));
}

async function substituirEConfirmarContrato(manterSubstitutoAberto = false) {
  const proposta = await prisma.$transaction(tx => prepararSubstituicaoContratualTx(tx, base.secretariaId, {
    processoFonteId: base.processoId, conferenciaSubstitutoId: base.conferenciaSubstitutoId,
    revisaoFonteEsperada: base.revisaoFonteHash, revisaoSubstitutoEsperada: base.revisaoSubstitutoHash,
    motivo: "Corrigir o original antes da confirmação contratual.", chaveIdempotencia: "substituicao-q165",
  }));
  await prisma.$transaction(tx => decidirSubstituicaoContratualTx(tx, base.adminId, {
    propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true,
    motivo: "Administração aprovou a substituição independentemente.",
  }));
  const intencao = await prisma.$transaction(tx => iniciarCancelamentoAssinaturaTx(tx, base.secretariaId, {
    propostaId: proposta.id, propostaHash: proposta.propostaHash,
  }));
  const observacao = await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, {
    intencaoId: intencao.id, processoId: base.processoId, propostaId: proposta.id, chave: "cancelamento-confirmado-q165",
    resultado: "CONFIRMADO", referenciaExterna: base.referenciaExternaFonte, evidenciaHash: "c".repeat(64),
  }));
  const substituto = await prisma.$transaction(tx => prepararProcessoEnvioTx(tx, {
    matriculaId: base.matriculaId, artefatoId: base.artefatoSubstitutoId, conferenciaId: base.conferenciaSubstitutoId,
    executorId: base.secretariaId, fornecedor: "ZAPSIGN", ambiente: "PRODUCAO",
    substituicao: { intencaoId: intencao.id, observacaoId: observacao.id, propostaHash: proposta.propostaHash },
  }));
  if (manterSubstitutoAberto) {
    await confirmarContratoDoProcesso(base.processoId, base.referenciaExternaFonte, "aceite-fonte-cancelada-q165");
    return;
  }
  const tentativa = await prisma.$transaction(tx => iniciarTentativaAssinaturaTx(tx, { processoId: substituto.id, executorId: base.secretariaId }));
  const referencia = "q165-substituto-confirmado";
  await prisma.$transaction(tx => registrarResultadoEnvioTx(tx, { processoId: substituto.id, tentativaId: tentativa.tentativaId,
    chave: "envio-substituto-q165", resultado: "REGISTRADO", referenciaExterna: referencia, evidenciaHash: "s".repeat(64) }));
  await confirmarContratoDoProcesso(substituto.id, referencia, "aceite-substituto-q165");
}

async function registrarPedido(chave = "pedido-q165") {
  entrar(base.secretariaId);
  const consulta = dado(await consultarDesistenciaPreparacao({ matriculaId: base.matriculaId }));
  const pedido = dado(await registrarPedidoDesistenciaPreparacao({ matriculaId: base.matriculaId, estadoHash: consulta.estadoHash,
    motivo: "Pessoa desistiu após aceitar o contrato, antes da ativação.", evidenciaPedido: "Atendimento e aceite contratual conferidos para o fluxo financeiro.", chaveIdempotencia: chave }));
  return prisma.pedidoDesistenciaPreparacao.findUniqueOrThrow({ where: { id: pedido.id } });
}

async function preparar(pedidoId: string, chave = "preparo-q165", reapresentacao?: { anteriorId: string; motivoReapresentacao: string }) {
  entrar(financeiroPreparador.id);
  return prepararAcertoDesistenciaContratual({ pedidoId, condicoesId, motivo: "Acerto conforme a cláusula contratual aceita.", ...reapresentacao, chaveIdempotencia: chave });
}
async function aprovar(propostaId: string, fotografiaHash: string, chave = "decisao-q165") {
  entrar(financeiroAprovador.id);
  return decidirAcertoDesistenciaContratual({ propostaId, fotografiaHash, aprovada: true, motivo: "Memória e fotografia conferidas por pessoa independente.", chaveIdempotencia: chave });
}
async function aprovarAdministracao(pedido: { id: string; estadoHash: string }, sufixo = "q165") {
  entrar(base.adminId);
  return decidirDesistenciaAdministrativa({ pedidoId: pedido.id, estadoHash: pedido.estadoHash, aprovada: true,
    motivo: `Administração conferiu independentemente a desistência contratual ${sufixo}.` });
}

async function prepararEDecidir(pedido: { id: string; estadoHash: string }, sufixo: string) {
  const proposta = dado(await preparar(pedido.id, `preparo-${sufixo}`));
  const fotografiaHash = (await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: proposta.id } })).fotografiaHash;
  return dado(await aprovar(proposta.id, fotografiaHash, `decisao-${sufixo}`));
}
async function aplicarDecisao(decisaoId: string, sufixo: string) {
  entrar(financeiroAprovador.id);
  return dado(await aplicarAcertoDesistenciaContratual({ decisaoId, chaveIdempotencia: `aplicacao-${sufixo}` }));
}
async function prepararAplicacaoSemPagamento(sufixo: string) {
  const pedido = await registrarPedido();
  const decisao = await prepararEDecidir(pedido, sufixo);
  expect((await aprovarAdministracao(pedido, sufixo)).ok).toBe(true);
  return { pedido, aplicacao: await aplicarDecisao(decisao.id, sufixo) };
}

beforeEach(async (contexto) => {
  await truncarBanco();
  const contratoSubstituido = contexto.task.name.includes("assinatura cancelada comprovada");
  const assinaturaAberta = contexto.task.name.includes("solicitação de assinatura aberta");
  base = await prepararFixtureSubstituicaoContratual(authMock, { camposFinanceiros: true, semSubstituicao: !contratoSubstituido && !assinaturaAberta, ambiente: "PRODUCAO" });
  if (contratoSubstituido) await substituirEConfirmarContrato(); else if (!assinaturaAberta) await confirmarContratoReal();
  [financeiroPreparador, financeiroAprovador] = await Promise.all([
    criarUsuario([Papel.FINANCEIRO], "Financeiro preparador Q165"), criarUsuario([Papel.FINANCEIRO], "Financeiro aprovador Q165"),
  ]);
  await prisma.usuario.update({ where: { id: financeiroAprovador.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  entrar(base.secretariaId);
  const preparado = dado(await prepararCondicoesEncerramento({ matriculaId: base.matriculaId,
    ...(assinaturaAberta ? { artefatoContratualId: base.artefatoFonteId, processoAssinaturaId: base.processoId } : { documentoId: (await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } })).contratoDocumentoId! }), regras,
    motivo: "Condições estruturadas para a desistência antes da ativação." }));
  entrar(base.adminId);
  expect((await decidirCondicoesEncerramento({ id: preparado.id, aprovar: true, motivo: "Condições estruturadas conferidas independentemente." })).ok).toBe(true);
  condicoesId = preparado.id;
});

it("revalida fotografia Node/SQL, aplica pagamento e crédito anterior e efetiva pelo vínculo Q121", async () => {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: "pagamento-q165", valorRecebido: 100,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-10T12:00:00.000Z"), evidencia: "Pagamento identificado antes do acerto contratual.", permitirExcedente: true }));
  const pedido = await registrarPedido();
  const proposta = dado(await preparar(pedido.id));
  const fotografiaHash = (await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: proposta.id } })).fotografiaHash;
  const decisao = dado(await aprovar(proposta.id, fotografiaHash));
  expect((await aprovarAdministracao(pedido)).ok).toBe(true);
  const aplicacao = await aplicarDecisao(decisao.id, "q165");
  const origem = await prisma.origemCreditoAcertoDesistenciaContratual.findFirstOrThrow({ where: { aplicacaoId: aplicacao.id } });
  expect(origem.valor.toFixed(2)).toBe("50.00");
  expect(await prisma.creditoMatricula.findFirstOrThrow({ where: { origemAcertoDesistenciaContratualId: origem.id } })).toMatchObject({ matriculaId: base.matriculaId, valorInicial: origem.valor });
  entrar(base.secretariaId);
  const efetivacao = dado(await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacao.id, motivo: "Secretaria efetivou a desistência após o acerto contratual." }));
  expect(efetivacao.status).toBe("CANCELADA");
  expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.findUniqueOrThrow({ where: { pedidoId: pedido.id } })).toMatchObject({ aplicacaoAcertoDesistenciaContratualId: aplicacao.id });
});

it("efetiva com assinatura vigente concluída e assinatura antiga cancelada comprovada", async () => {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: "pagamento-cancelada-comprovada-q165", valorRecebido: 100,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-14T12:00:00.000Z"), evidencia: "Pagamento identificado antes do acerto contratual.", permitirExcedente: true }));
  const pedido = await registrarPedido();
  const decisao = await prepararEDecidir(pedido, "cancelada-comprovada-q165");
  expect((await aprovarAdministracao(pedido, "assinatura cancelada comprovada")).ok).toBe(true);
  const aplicacao = await aplicarDecisao(decisao.id, "cancelada-comprovada-q165");
  entrar(base.secretariaId);
  const efetivacao = await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacao.id, motivo: "Secretaria efetivou após a confirmação documental das assinaturas." });
  expect(efetivacao).toMatchObject({ ok: true, dado: { status: "CANCELADA" } });
});

it("bloqueia a efetivação Q165 sem decisão administrativa independente", async () => {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: "pagamento-sem-admin-q165", valorRecebido: 100,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-12T12:00:00.000Z"), evidencia: "Pagamento identificado antes do acerto contratual.", permitirExcedente: true }));
  const pedido = await registrarPedido();
  const decisao = await prepararEDecidir(pedido, "sem-admin-q165");
  expect(await aplicarAcertoDesistenciaContratual({ decisaoId: decisao.id, chaveIdempotencia: "aplicacao-sem-admin-q165" })).toMatchObject({ ok: false });
  expect(await prisma.aplicacaoAcertoDesistenciaContratual.count({ where: { decisaoId: decisao.id } })).toBe(0);
});

it("não aceita a aprovação administrativa da destinação antes do plano Q165", async () => {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: "pagamento-sem-plano-q165", valorRecebido: 100,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-15T12:00:00.000Z"), evidencia: "Pagamento identificado antes do acerto contratual.", permitirExcedente: true }));
  const pedido = await registrarPedido();
  expect(await aprovarAdministracao(pedido, "sem plano Q165")).toMatchObject({ ok: false });
  expect(await prisma.decisaoAdministrativaDesistencia.count({ where: { pedidoId: pedido.id } })).toBe(0);
});

it("bloqueia a efetivação Q165 enquanto houver solicitação de assinatura aberta", async () => {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: "pagamento-assinatura-aberta-q165", valorRecebido: 100,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-13T12:00:00.000Z"), evidencia: "Pagamento identificado antes do acerto contratual.", permitirExcedente: true }));
  const pedido = await registrarPedido();
  const decisao = await prepararEDecidir(pedido, "assinatura-aberta-q165");
  expect((await aprovarAdministracao(pedido, "assinatura aberta")).ok).toBe(true);
  const aplicacao = await aplicarDecisao(decisao.id, "assinatura-aberta-q165");
  entrar(base.secretariaId);
  const efetivacao = await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacao.id, motivo: "Secretaria tentou efetivar com solicitação externa ainda aberta." });
  expect(efetivacao).toMatchObject({ ok: false });
  expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count({ where: { pedidoId: pedido.id } })).toBe(0);
  entrar(financeiroAprovador.id);
  expect(await iniciarCancelamentoAssinaturaDesistencia({ pedidoId: pedido.id, processoId: base.processoId, estadoHash: pedido.estadoHash })).toMatchObject({ ok: false });
  expect(await prisma.intencaoCancelamentoAssinatura.count({ where: { processoId: base.processoId } })).toBe(0);
  entrar(base.secretariaId);
  const intencao = dado(await iniciarCancelamentoAssinaturaDesistencia({ pedidoId: pedido.id, processoId: base.processoId, estadoHash: pedido.estadoHash }));
  expect(dado(await iniciarCancelamentoAssinaturaDesistencia({ pedidoId: pedido.id, processoId: base.processoId, estadoHash: pedido.estadoHash }))).toMatchObject({ id: intencao.id, nova: false });
  const observacao = await prisma.$transaction(tx => registrarObservacaoCancelamentoDesistenciaTx(tx, { intencaoId: intencao.id, pedidoId: pedido.id, processoId: base.processoId, chave: "cancelamento-desistencia-q165", resultado: "CONFIRMADO", referenciaExterna: base.referenciaExternaFonte, evidenciaHash: "d".repeat(64) }));
  expect(observacao).toMatchObject({ cancelamentoConfirmado: true });
  expect(await prisma.$transaction(tx => registrarObservacaoCancelamentoDesistenciaTx(tx, { intencaoId: intencao.id, pedidoId: pedido.id, processoId: base.processoId, chave: "cancelamento-desistencia-q165", resultado: "CONFIRMADO", referenciaExterna: base.referenciaExternaFonte, evidenciaHash: "d".repeat(64) }))).toMatchObject({ id: observacao.id, cancelamentoConfirmado: true });
  const efetivada = await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacao.id, motivo: "Secretaria efetivou após o cancelamento externo comprovado." });
  expect(efetivada.ok, efetivada.ok ? undefined : efetivada.erro).toBe(true);
  expect(efetivada).toMatchObject({ ok: true, dado: { status: "CANCELADA" } });
});

it("preserva pagamento informado posterior e bloqueia a efetivação até nova conferência", async () => {
  const { pedido, aplicacao } = await prepararAplicacaoSemPagamento("informe-posterior-q165");
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  entrar(base.secretariaId);
  expect(await registrarPagamento(cobranca.id, { chaveIdempotencia: "informe-posterior-q165-0001", valorRecebido: 10,
    forma: FormaPagamento.DINHEIRO, dataPagamento: new Date("2099-10-16T12:00:00.000Z"), comentario: "Recebimento comunicado depois da aplicação." })).toMatchObject({ ok: true, dado: { informado: true } });
  expect(await prisma.pagamentoInformado.count({ where: { cobrancaId: cobranca.id } })).toBe(1);
  entrar(base.secretariaId);
  expect(await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacao.id, motivo: "Secretaria tenta efetivar após informe financeiro posterior." })).toMatchObject({ ok: false });
  expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count({ where: { pedidoId: pedido.id } })).toBe(0);
});

it("preserva crédito sem destino posterior e bloqueia a efetivação até nova conferência", async () => {
  const { pedido, aplicacao } = await prepararAplicacaoSemPagamento("credito-sem-destino-posterior-q165");
  entrar(financeiroPreparador.id);
  expect(await registrarRecebimentoDestinado({ titularMatriculaId: base.matriculaId, pagadorId: null,
    chaveIdempotencia: "credito-sem-destino-posterior-q165-0001", valorRecebido: 10, moeda: "BRL", forma: FormaPagamento.DINHEIRO,
    dataPagamento: new Date("2099-10-17T12:00:00.000Z"), comentario: "Crédito recebido depois da aplicação.", comprovanteUrl: null, comprovanteNome: null,
    destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 10, evidencia: "Excedente recebido após o acerto aplicado.", chaveIdempotencia: "credito-sem-destino" }],
  })).toMatchObject({ ok: true });
  expect(await prisma.creditoMatricula.count({ where: { matriculaId: base.matriculaId } })).toBe(1);
  entrar(base.secretariaId);
  expect(await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacao.id, motivo: "Secretaria tenta efetivar após crédito financeiro posterior." })).toMatchObject({ ok: false });
  expect(await prisma.efetivacaoPedidoDesistenciaPreparacao.count({ where: { pedidoId: pedido.id } })).toBe(0);
});

it("não permite novo Q165 do mesmo pedido depois de uma aplicação", async () => {
  const { pedido } = await prepararAplicacaoSemPagamento("segunda-aplicacao-q165");
  entrar(financeiroPreparador.id);
  expect(await prepararAcertoDesistenciaContratual({ pedidoId: pedido.id, condicoesId,
    motivo: "Tentativa de reaplicar um acerto já materializado.", chaveIdempotencia: "preparo-segunda-aplicacao-q165" })).toMatchObject({ ok: false });
  expect(await prisma.aplicacaoAcertoDesistenciaContratual.count({ where: { decisao: { proposta: { pedidoId: pedido.id } } } })).toBe(1);
});

it("bloqueia nova aplicação na matrícula por Node e inserção direta", async () => {
  const { pedido } = await prepararAplicacaoSemPagamento("primeira-aplicacao-matricula-q165");
  const novoPedido = await registrarPedido("pedido-depois-aplicacao-q165");
  expect(novoPedido.id).not.toBe(pedido.id);
  const proposta = dado(await preparar(novoPedido.id, "preparo-depois-aplicacao-q165"));
  const propostaPersistida = await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: proposta.id } });
  const decisao = dado(await aprovar(proposta.id, propostaPersistida.fotografiaHash, "decisao-depois-aplicacao-q165"));
  expect((await aprovarAdministracao(novoPedido, "segunda aplicação bloqueada")).ok).toBe(true);

  entrar(financeiroAprovador.id);
  expect(await aplicarAcertoDesistenciaContratual({
    decisaoId: decisao.id, chaveIdempotencia: "node-segunda-aplicacao-matricula-q165",
  })).toMatchObject({ ok: false, erro: expect.stringContaining("já possui aplicação Q165") });
  await expect(prisma.aplicacaoAcertoDesistenciaContratual.create({ data: {
    decisaoId: decisao.id, executorId: financeiroAprovador.id,
    memoria: propostaPersistida.memoria as Prisma.InputJsonValue,
    condicoesHash: propostaPersistida.condicoesHash, fotografiaHash: propostaPersistida.fotografiaHash,
    chaveIdempotencia: "sql-segunda-aplicacao-matricula-q165",
  } })).rejects.toThrow("já possui aplicação Q165");
  expect(await prisma.aplicacaoAcertoDesistenciaContratual.count({
    where: { decisao: { proposta: { pedido: { matriculaId: base.matriculaId } } } },
  })).toBe(1);
});

it("serializa aplicações concorrentes da mesma decisão", async () => {
  const pedido = await registrarPedido("pedido-concorrencia-aplicacao-q165");
  const decisao = await prepararEDecidir(pedido, "concorrencia-aplicacao-q165");
  expect((await aprovarAdministracao(pedido, "concorrência aplicação")).ok).toBe(true);
  entrar(financeiroAprovador.id);

  const resultados = await Promise.all([
    aplicarAcertoDesistenciaContratual({ decisaoId: decisao.id, chaveIdempotencia: "concorrencia-aplicacao-q165-a" }),
    aplicarAcertoDesistenciaContratual({ decisaoId: decisao.id, chaveIdempotencia: "concorrencia-aplicacao-q165-b" }),
  ]);
  expect(resultados.filter(resultado => resultado.ok)).toHaveLength(1);
  expect(resultados.filter(resultado => !resultado.ok)).toHaveLength(1);
  expect(await prisma.aplicacaoAcertoDesistenciaContratual.count({
    where: { decisao: { proposta: { pedido: { matriculaId: base.matriculaId } } } },
  })).toBe(1);
});

it("exige decisor independente da preparação", async () => {
  const pedido = await registrarPedido();
  const proposta = dado(await preparar(pedido.id));
  const fotografiaHash = (await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: proposta.id } })).fotografiaHash;
  entrar(financeiroPreparador.id);
  expect((await decidirAcertoDesistenciaContratual({ propostaId: proposta.id, fotografiaHash, aprovada: true,
    motivo: "Tentativa da mesma pessoa que preparou o acerto.", chaveIdempotencia: "decisao-sem-independencia" })).ok).toBe(false);
});

it("recusa aprovação depois de alteração da fotografia financeira", async () => {
  const pedido = await registrarPedido();
  const proposta = dado(await preparar(pedido.id));
  const fotografiaHash = (await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: proposta.id } })).fotografiaHash;
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: "pagamento-foto-mutada-q165", valorRecebido: 10,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-11T12:00:00.000Z"), evidencia: "Pagamento posterior à fotografia do acerto." }));
  expect((await aprovar(proposta.id, fotografiaHash, "decisao-foto-mutada-q165")).ok).toBe(false);
});

it("encaminha fato posterior à proposta aprovada para novo pedido, Q121 e aplicação independentes", async () => {
  const pedido = await registrarPedido();
  const primeira = dado(await preparar(pedido.id, "preparo-obsoleta-q165"));
  const primeiraPersistida = await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: primeira.id } });
  const decisaoPrimeira = dado(await aprovar(primeira.id, primeiraPersistida.fotografiaHash, "decisao-obsoleta-q165"));

  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, {
    cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: "pagamento-depois-aprovacao-q165", valorRecebido: 10,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-10-20T12:00:00.000Z"), evidencia: "Recebimento comprovado depois da aprovação financeira.",
  }));

  expect(await preparar(pedido.id, "reapresentar-obsoleta-q165", {
    anteriorId: primeira.id, motivoReapresentacao: "Recebimento comprovado alterou a fotografia após a aprovação inicial.",
  })).toMatchObject({ ok: false, erro: expect.stringContaining("novo pedido") });
  expect(await prisma.propostaAcertoDesistenciaContratual.count({ where: { pedidoId: pedido.id } })).toBe(1);

  const novoPedido = await registrarPedido("pedido-fato-posterior-q165");
  expect(novoPedido.id).not.toBe(pedido.id);
  const segunda = dado(await preparar(novoPedido.id, "preparo-novo-pedido-q165"));
  const segundaPersistida = await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: segunda.id } });
  expect(segundaPersistida).toMatchObject({ anteriorId: null, versao: 1 });
  expect(segundaPersistida.fotografiaHash).not.toBe(primeiraPersistida.fotografiaHash);

  const decisaoSegunda = dado(await aprovar(segunda.id, segundaPersistida.fotografiaHash, "decisao-novo-pedido-q165"));
  expect((await aprovarAdministracao(novoPedido, "novo pedido após fato financeiro")).ok).toBe(true);
  await expect(prisma.aplicacaoAcertoDesistenciaContratual.create({ data: {
    decisaoId: decisaoPrimeira.id, executorId: financeiroAprovador.id,
    memoria: primeiraPersistida.memoria as Prisma.InputJsonValue,
    condicoesHash: primeiraPersistida.condicoesHash, fotografiaHash: primeiraPersistida.fotografiaHash,
    chaveIdempotencia: "sql-aplicar-pedido-obsoleto-q165",
  } })).rejects.toThrow();
  entrar(financeiroAprovador.id);
  expect(await aplicarAcertoDesistenciaContratual({ decisaoId: decisaoPrimeira.id, chaveIdempotencia: "aplicar-obsoleta-q165" })).toMatchObject({ ok: false });
  expect((await aplicarDecisao(decisaoSegunda.id, "novo-pedido-q165")).id).toBeTruthy();
  expect(await prisma.aplicacaoAcertoDesistenciaContratual.count({ where: { decisao: { proposta: { pedidoId: pedido.id } } } })).toBe(0);
  expect(await prisma.aplicacaoAcertoDesistenciaContratual.count({ where: { decisao: { proposta: { pedidoId: novoPedido.id } } } })).toBe(1);
});

it("encadeia reapresentação após rejeição com a mesma fotografia e bloqueia a antecessora", async () => {
  const pedido = await registrarPedido();
  const primeira = dado(await preparar(pedido.id, "preparo-rejeitado-q165"));
  const primeiraPersistida = await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: primeira.id } });
  entrar(financeiroAprovador.id);
  expect(await decidirAcertoDesistenciaContratual({
    propostaId: primeira.id, fotografiaHash: primeiraPersistida.fotografiaHash, aprovada: false,
    motivo: "A justificativa precisa detalhar a conferência financeira.", chaveIdempotencia: "rejeitar-primeira-q165",
  })).toMatchObject({ ok: true, dado: { aprovada: false } });

  const segunda = dado(await preparar(pedido.id, "reapresentar-rejeitado-q165", {
    anteriorId: primeira.id, motivoReapresentacao: "Justificativa ampliada após a rejeição financeira independente.",
  }));
  const segundaPersistida = await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: segunda.id } });
  expect(segundaPersistida).toMatchObject({ anteriorId: primeira.id, versao: primeiraPersistida.versao + 1 });
  expect(segundaPersistida.fotografiaHash).toBe(primeiraPersistida.fotografiaHash);

  entrar(financeiroAprovador.id);
  expect(await decidirAcertoDesistenciaContratual({
    propostaId: primeira.id, fotografiaHash: primeiraPersistida.fotografiaHash, aprovada: true,
    motivo: "Tentativa de alterar decisão imutável da versão anterior.", chaveIdempotencia: "decidir-antecessora-q165",
  })).toMatchObject({ ok: false });
});
