import { beforeEach, expect, it, vi } from "vitest";
import { FormaPagamento, Papel } from "@prisma/client";

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
  return {
    ...atual,
    exigirSessao: sessao,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const usuario = await sessao(); atual.exigirPapel(usuario, ...papeis); return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { preservarConclusaoAssinaturaTx } from "@/server/contratos/conclusao-assinatura-tx";
import { IdentidadeSignatarioSchema } from "@/server/contratos/participantes-schema";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { carregarRevisaoAceite } from "@/server/contratos/aceite-estado";
import { confirmarAceiteOriginalTx } from "@/server/contratos/aceite-tx";
import { prepararCondicoesEncerramento, decidirCondicoesEncerramento } from "./condicoes-encerramento";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";
import { decidirDesistenciaAdministrativa } from "./desistencia-administrativa";
import { prepararAcertoDesistenciaContratual, decidirAcertoDesistenciaContratual } from "./desistencia-acerto-contratual";
import { aplicarAcertoDesistenciaContratual } from "./desistencia-acerto-aplicacao";
import { efetivarPedidoDesistenciaPreparacao } from "./desistencia-efetivacao";
import { consultarReconferenciaDeltaDesistencia } from "./desistencia-reconferencia-delta-consulta";
import {
  aplicarReconferenciaDeltaDesistencia,
  decidirAdministrativamenteReconferenciaDeltaDesistencia,
  decidirReconferenciaDeltaDesistencia,
  prepararReconferenciaDeltaDesistencia,
} from "./desistencia-reconferencia-delta";
import { carregarFontesReconferenciaDeltaTx } from "./desistencia-reconferencia-delta-fontes";
import { receberTx } from "@/server/financeiro/recebimentos";
import { registrarPagamento, registrarRecebimentoDestinado } from "@/server/financeiro/acoes";
import { proporDevolucaoCredito, decidirDevolucaoCredito } from "@/server/financeiro/devolucao-credito";
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
  const processo = await prisma.processoAssinaturaContratual.findUniqueOrThrow({
    where: { id: base.processoId }, include: { artefato: { include: { conferencia: true } } },
  });
  const participantes = z.object({ participantes: z.array(z.object({ identidade: IdentidadeSignatarioSchema })) }).parse(processo.artefato.conferencia.snapshot);
  const envio = await prisma.tentativaEnvioAssinatura.findFirstOrThrow({ where: { processoId: processo.id }, orderBy: { numero: "desc" } });
  const conclusao = await prisma.$transaction(tx => preservarConclusaoAssinaturaTx(tx, {
    processoId: processo.id, referenciaExterna: base.referenciaExternaFonte, originalHash: processo.artefato.pdfHash,
    concluidaEm: envio.iniciadaEm.toISOString(), pdfAssinado: Buffer.from("%PDF-assinado"), evidencias: Buffer.from("evidencia"),
    assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(participantes.participantes[0].identidade), referenciaAssinatura: "assinatura-q249", assinadaEm: envio.iniciadaEm.toISOString() }],
  }));
  const revisao = await prisma.$transaction(tx => carregarRevisaoAceite(tx, base.matriculaId, conclusao.id));
  await prisma.$transaction(tx => confirmarAceiteOriginalTx(tx, base.secretariaId, {
    matriculaId: base.matriculaId, conclusaoId: conclusao.id, revisaoHash: revisao.revisaoHash,
    evidenciasConferidas: true, motivo: "Aceite original conferido para a reconferência financeira.", chaveIdempotencia: "aceite-q249",
  }));
}
async function registrarPedido() {
  entrar(base.secretariaId);
  const consulta = dado(await consultarDesistenciaPreparacao({ matriculaId: base.matriculaId }));
  const pedido = dado(await registrarPedidoDesistenciaPreparacao({
    matriculaId: base.matriculaId, estadoHash: consulta.estadoHash,
    motivo: "Pessoa desistiu após aceitar o contrato, antes da ativação.",
    evidenciaPedido: "Atendimento e aceite contratual conferidos para o fluxo financeiro.", chaveIdempotencia: "pedido-q249",
  }));
  return prisma.pedidoDesistenciaPreparacao.findUniqueOrThrow({ where: { id: pedido.id } });
}
async function aplicarBase(pedido: { id: string; estadoHash: string }) {
  entrar(financeiroPreparador.id);
  const proposta = dado(await prepararAcertoDesistenciaContratual({
    pedidoId: pedido.id, condicoesId, motivo: "Acerto conforme a cláusula contratual aceita.", chaveIdempotencia: "preparo-base-q249",
  }));
  const persistida = await prisma.propostaAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: proposta.id } });
  entrar(financeiroAprovador.id);
  const decisao = dado(await decidirAcertoDesistenciaContratual({
    propostaId: proposta.id, fotografiaHash: persistida.fotografiaHash, aprovada: true,
    motivo: "Memória e fotografia conferidas por pessoa independente.", chaveIdempotencia: "decisao-base-q249",
  }));
  entrar(base.adminId);
  dado(await decidirDesistenciaAdministrativa({ pedidoId: pedido.id, estadoHash: pedido.estadoHash, aprovada: true,
    motivo: "Administração conferiu independentemente a desistência contratual Q249." }));
  entrar(financeiroAprovador.id);
  return dado(await aplicarAcertoDesistenciaContratual({ decisaoId: decisao.id, chaveIdempotencia: "aplicacao-base-q249" }));
}
async function prepararDelta(aplicacaoBaseId: string, chave = "preparo-delta-q249") {
  entrar(financeiroPreparador.id);
  return dado(await prepararReconferenciaDeltaDesistencia({
    aplicacaoBaseId, motivo: "Reconferência posterior de fato financeiro auditável.", chaveIdempotencia: chave,
  }));
}
async function aprovarDelta(propostaId: string, chave = "decisao-delta-q249", decisorFinanceiroId = financeiroAprovador.id, decisorAdministrativoId = base.adminId) {
  const proposta = await prisma.propostaReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: propostaId } });
  entrar(decisorFinanceiroId);
  const decisaoFinanceira = dado(await decidirReconferenciaDeltaDesistencia({ propostaId, fotografiaHash: proposta.fotografiaHash,
    aprovada: true, motivo: "Financeiro conferiu a fotografia posterior independentemente.", chaveIdempotencia: chave }));
  entrar(decisorAdministrativoId);
  dado(await decidirAdministrativamenteReconferenciaDeltaDesistencia({ propostaId, fotografiaHash: proposta.fotografiaHash,
    aprovada: true, motivo: "Administração conferiu a reconferência independentemente.", chaveIdempotencia: `admin-${chave}` }));
  return decisaoFinanceira;
}

async function criarBaseComCreditoExterno(sufixo: string) {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, {
    cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: `pagamento-base-${sufixo}`, valorRecebido: 100,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-12-10T12:00:00.000Z"), evidencia: "Pagamento identificado antes da aplicação base.", permitirExcedente: true,
  }));
  const pedido = await registrarPedido();
  const aplicacaoBase = await aplicarBase(pedido);
  entrar(financeiroPreparador.id);
  dado(await registrarRecebimentoDestinado({ titularMatriculaId: base.matriculaId, pagadorId: null,
    chaveIdempotencia: `credito-externo-${sufixo}`, valorRecebido: 10, moeda: "BRL", forma: FormaPagamento.DINHEIRO,
    dataPagamento: new Date("2099-12-11T12:00:00.000Z"), comentario: "Crédito externo auditável para reconferência.", comprovanteUrl: null, comprovanteNome: null,
    destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 10, evidencia: "Excedente posterior com lastro de recebimento.", chaveIdempotencia: `destino-externo-${sufixo}` }],
  }));
  const credito = await prisma.creditoMatricula.findFirstOrThrow({ where: { matriculaId: base.matriculaId, origemDestinacaoRecebimentoId: { not: null } } });
  return { pedido, aplicacaoBase, credito };
}
beforeEach(async () => {
  await truncarBanco();
  base = await prepararFixtureSubstituicaoContratual(authMock, { camposFinanceiros: true, semSubstituicao: true, ambiente: "PRODUCAO" });
  await confirmarContratoReal();
  [financeiroPreparador, financeiroAprovador] = await Promise.all([
    criarUsuario([Papel.FINANCEIRO], "Financeiro preparador Q249"), criarUsuario([Papel.FINANCEIRO], "Financeiro aprovador Q249"),
  ]);
  await prisma.usuario.update({ where: { id: financeiroAprovador.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  entrar(base.secretariaId);
  const preparado = dado(await prepararCondicoesEncerramento({ matriculaId: base.matriculaId,
    documentoId: (await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } })).contratoDocumentoId!, regras,
    motivo: "Condições estruturadas para a desistência antes da ativação." }));
  entrar(base.adminId);
  expect((await decidirCondicoesEncerramento({ id: preparado.id, aprovar: true, motivo: "Condições estruturadas conferidas independentemente." })).ok).toBe(true);
  condicoesId = preparado.id;
});

it("aplica Q165 base, reconhece crédito externo posterior no delta e efetiva pela última aplicação", async () => {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, {
    cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: "pagamento-base-q249", valorRecebido: 100,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-11-10T12:00:00.000Z"), evidencia: "Pagamento identificado antes da aplicação base.", permitirExcedente: true,
  }));
  const pedido = await registrarPedido();
  const aplicacaoBase = await aplicarBase(pedido);
  entrar(financeiroPreparador.id);
  dado(await registrarRecebimentoDestinado({ titularMatriculaId: base.matriculaId, pagadorId: null,
    chaveIdempotencia: "credito-externo-posterior-q249", valorRecebido: 10, moeda: "BRL", forma: FormaPagamento.DINHEIRO,
    dataPagamento: new Date("2099-11-11T12:00:00.000Z"), comentario: "Crédito externo recebido depois da aplicação base.", comprovanteUrl: null, comprovanteNome: null,
    destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 10, evidencia: "Excedente posterior com lastro de recebimento.", chaveIdempotencia: "destino-externo-q249" }],
  }));
  const proposta = await prepararDelta(aplicacaoBase.id);
  expect(proposta.estado).toBe("PENDENTE");
  const decisao = await aprovarDelta(proposta.id);
  entrar(financeiroAprovador.id);
  const aplicacaoDelta = dado(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-delta-q249" }));
  const reconhecimento = await prisma.reconhecimentoCreditoReconferenciaDeltaDesistencia.findFirstOrThrow({ where: { aplicacaoId: aplicacaoDelta.id } });
  expect(reconhecimento.valor.toFixed(2)).toBe("10.00");
  const aplicacaoPersistida = await prisma.aplicacaoReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: aplicacaoDelta.id } });
  expect(aplicacaoPersistida.fotografiaPosteriorHash).toMatch(/^[a-f0-9]{64}$/);
  expect(aplicacaoPersistida.fotografiaPosterior).toMatchObject({ matriculaId: base.matriculaId });
  const memoriaBase = (await prisma.aplicacaoAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: aplicacaoBase.id }, select: { memoria: true } })).memoria;
  const fontesPosteriores = await prisma.$transaction(tx => carregarFontesReconferenciaDeltaTx(tx, base.matriculaId, memoriaBase));
  expect(aplicacaoPersistida.fotografiaPosterior).toEqual(fontesPosteriores.fotografia);
  expect(aplicacaoPersistida.fotografiaPosteriorHash).toBe(hashSubstituicao(fontesPosteriores.fotografia));
  expect((aplicacaoPersistida.fotografiaPosterior as { creditos: unknown[] }).creditos).toHaveLength(2);
  const versaoSemEfeito = (await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } })).versao;
  entrar(financeiroPreparador.id);
  expect(await prepararReconferenciaDeltaDesistencia({ aplicacaoBaseId: aplicacaoBase.id,
    motivo: "Não deve recriar delta sem fato financeiro posterior.", chaveIdempotencia: "preparo-delta-sem-fato-q255" })).toMatchObject({ ok: false });
  expect((await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } })).versao).toBe(versaoSemEfeito);
  dado(await registrarRecebimentoDestinado({ titularMatriculaId: base.matriculaId, pagadorId: null,
    chaveIdempotencia: "credito-externo-segundo-q255", valorRecebido: 5, moeda: "BRL", forma: FormaPagamento.DINHEIRO,
    dataPagamento: new Date("2099-11-12T12:00:00.000Z"), comentario: "Novo crédito externo, sem alterar a obrigação da cobrança.", comprovanteUrl: null, comprovanteNome: null,
    destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 5, evidencia: "Novo fato externo auditável depois da foto posterior.", chaveIdempotencia: "destino-externo-segundo-q255" }],
  }));
  const repetida = await prepararDelta(aplicacaoBase.id, "preparo-delta-fato-novo-q255");
  expect(repetida.estado).toBe("PENDENTE");
  const decisaoRepetida = await aprovarDelta(repetida.id, "decisao-delta-fato-novo-q255");
  entrar(financeiroAprovador.id);
  dado(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisaoRepetida.id, chaveIdempotencia: "aplicacao-delta-fato-novo-q255" }));
  expect(await prisma.reconhecimentoCreditoReconferenciaDeltaDesistencia.count()).toBe(2);
  entrar(base.secretariaId);
  const efetivacao = dado(await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacaoBase.id, motivo: "Secretaria efetivou após a reconferência financeira delta." }));
  expect(efetivacao.status).toBe("CANCELADA");
});




it("destina pagamento posterior à cobrança já quitada como crédito sem duplicá-lo no delta", async () => {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  const receber = (chave: string, valor: number) => prisma.$transaction(tx => receberTx(tx, {
    cobrancaId: cobranca.id, autorId: financeiroPreparador.id, chaveIdempotencia: chave, valorRecebido: valor,
    forma: "TRANSFERENCIA", dataPagamento: new Date("2099-12-10T12:00:00.000Z"),
    evidencia: "Recebimento preservado para conferir excedente incremental.", permitirExcedente: true,
  }));
  await receber("pagamento-inicial-credito-delta", 100);
  const pedido = await registrarPedido();
  const aplicacaoBase = await aplicarBase(pedido);
  const creditosBase = await prisma.creditoMatricula.findMany({ where: { matriculaId: base.matriculaId } });
  expect(creditosBase.map(c => c.valorInicial.toFixed(2))).toEqual(["50.00"]);
  await receber("pagamento-posterior-credito-delta", 20);
  const proposta = await prepararDelta(aplicacaoBase.id, "preparo-pagamento-credito-delta");
  const decisao = await aprovarDelta(proposta.id, "decisao-pagamento-credito-delta");
  entrar(financeiroAprovador.id);
  const entrada = { decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicar-pagamento-credito-delta" };
  const [primeira, repetida] = await Promise.all([
    aplicarReconferenciaDeltaDesistencia(entrada), aplicarReconferenciaDeltaDesistencia(entrada),
  ]);
  const aplicada = dado(primeira);
  expect(dado(repetida).id).toBe(aplicada.id);
  const creditos = await prisma.creditoMatricula.findMany({ where: { matriculaId: base.matriculaId } });
  expect(creditos).toHaveLength(2);
  expect(creditos.find(c => c.id === creditosBase[0].id)?.valorInicial.toFixed(2)).toBe("50.00");
  expect(creditos.filter(c => c.origemDestinacaoRecebimentoId).map(c => c.valorInicial.toFixed(2))).toEqual(["20.00"]);
  expect(creditos.filter(c => c.origemReconferenciaDeltaDesistenciaId)).toHaveLength(0);
  expect(await prisma.recebimento.count()).toBe(2);
  const atual = await prisma.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
  expect(atual.valorNegociado.toFixed(2)).toBe("50.00");
  expect(atual.valorRecebido?.toFixed(2)).toBe("100.00");
  const memoriaBase = (await prisma.aplicacaoAcertoDesistenciaContratual.findUniqueOrThrow({ where: { id: aplicacaoBase.id } })).memoria;
  const fontes = await prisma.$transaction(tx => carregarFontesReconferenciaDeltaTx(tx, base.matriculaId, memoriaBase));
  const registro = await prisma.aplicacaoReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: aplicada.id } });
  expect(registro.fotografiaPosterior).toEqual(fontes.fotografia);
  expect(registro.fotografiaPosteriorHash).toBe(hashSubstituicao(fontes.fotografia));
  entrar(financeiroPreparador.id);
  expect(await prepararReconferenciaDeltaDesistencia({ aplicacaoBaseId: aplicacaoBase.id,
    motivo: "Não duplicar crédito sem novo fato financeiro.", chaveIdempotencia: "sem-novo-pagamento-credito-delta" })).toMatchObject({ ok: false });
});

it("persiste pendência por informe posterior e não cria decisões", async () => {
  const pedido = await registrarPedido();
  const aplicacaoBase = await aplicarBase(pedido);
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  entrar(base.secretariaId);
  expect(await registrarPagamento(cobranca.id, {
    chaveIdempotencia: "informe-pendente-delta-q249", valorRecebido: 10, forma: FormaPagamento.DINHEIRO,
    dataPagamento: new Date("2099-11-12T12:00:00.000Z"), comentario: "Informe financeiro pendente após aplicação base.",
  })).toMatchObject({ ok: true, dado: { informado: true } });
  const proposta = await prepararDelta(aplicacaoBase.id, "preparo-pendencia-delta-q249");
  expect(proposta.estado).toBe("PENDENCIA_FINANCEIRA");
  expect(await consultarReconferenciaDeltaDesistencia({ matriculaId: base.matriculaId })).toMatchObject({
    ok: true, dado: { aplicacoesBase: [{ podePreparar: false, propostas: [{ podeAplicar: false }] }] },
  });
  const persistida = await prisma.propostaReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: proposta.id } });
  entrar(financeiroAprovador.id);
  expect(await decidirReconferenciaDeltaDesistencia({ propostaId: proposta.id, fotografiaHash: persistida.fotografiaHash,
    aprovada: true, motivo: "Tentativa financeira diante de informe ainda pendente.", chaveIdempotencia: "decisao-pendencia-fin-q249" })).toMatchObject({ ok: false });
  entrar(base.adminId);
  expect(await decidirAdministrativamenteReconferenciaDeltaDesistencia({ propostaId: proposta.id, fotografiaHash: persistida.fotografiaHash,
    aprovada: true, motivo: "Tentativa administrativa diante de informe ainda pendente.", chaveIdempotencia: "decisao-pendencia-admin-q249" })).toMatchObject({ ok: false });
  expect(await prisma.decisaoReconferenciaDeltaDesistencia.count({ where: { propostaId: proposta.id } })).toBe(0);
  expect(await prisma.decisaoAdministrativaReconferenciaDeltaDesistencia.count({ where: { propostaId: proposta.id } })).toBe(0);
});

it("rejeita aplicação depois de crédito externo posterior à aprovação", async () => {
  const cobranca = await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: base.matriculaId }, orderBy: { id: "asc" } });
  await prisma.$transaction(tx => receberTx(tx, { cobrancaId: cobranca.id, autorId: financeiroPreparador.id,
    chaveIdempotencia: "pagamento-base-obsoleta-q249", valorRecebido: 100, forma: "TRANSFERENCIA",
    dataPagamento: new Date("2099-11-13T12:00:00.000Z"), evidencia: "Pagamento antes da aplicação base da fotografia obsoleta.", permitirExcedente: true }));
  const pedido = await registrarPedido();
  const aplicacaoBase = await aplicarBase(pedido);
  entrar(financeiroPreparador.id);
  dado(await registrarRecebimentoDestinado({ titularMatriculaId: base.matriculaId, pagadorId: null,
    chaveIdempotencia: "credito-obsoleto-primeiro-q249", valorRecebido: 10, moeda: "BRL", forma: FormaPagamento.DINHEIRO,
    dataPagamento: new Date("2099-11-14T12:00:00.000Z"), comentario: "Crédito externo da fotografia aprovada.", comprovanteUrl: null, comprovanteNome: null,
    destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 10, evidencia: "Recebimento externo com origem de destinação auditável.", chaveIdempotencia: "destino-obsoleto-primeiro-q249" }],
  }));
  const proposta = await prepararDelta(aplicacaoBase.id, "preparo-obsoleta-delta-q249");
  const decisao = await aprovarDelta(proposta.id, "decisao-obsoleta-delta-q249");
  entrar(financeiroAprovador.id);
  expect(await consultarReconferenciaDeltaDesistencia({ matriculaId: base.matriculaId })).toMatchObject({
    ok: true, dado: { aplicacoesBase: [{ podePreparar: false, propostas: [{ podeAplicar: true }] }] },
  });
  entrar(financeiroPreparador.id);
  dado(await registrarRecebimentoDestinado({ titularMatriculaId: base.matriculaId, pagadorId: null,
    chaveIdempotencia: "credito-obsoleto-segundo-q249", valorRecebido: 5, moeda: "BRL", forma: FormaPagamento.DINHEIRO,
    dataPagamento: new Date("2099-11-15T12:00:00.000Z"), comentario: "Crédito externo posterior à aprovação.", comprovanteUrl: null, comprovanteNome: null,
    destinos: [{ tipo: "CREDITO_SEM_DESTINO", valor: 5, evidencia: "Recebimento posterior com origem de destinação auditável.", chaveIdempotencia: "destino-obsoleto-segundo-q249" }],
  }));
  entrar(financeiroAprovador.id);
  expect(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-obsoleta-delta-q249" })).toMatchObject({ ok: false });
  expect(await consultarReconferenciaDeltaDesistencia({ matriculaId: base.matriculaId })).toMatchObject({
    ok: true, dado: { aplicacoesBase: [{ podePreparar: true, propostas: [{ podeAplicar: false }] }] },
  });
  expect(await prisma.aplicacaoReconferenciaDeltaDesistencia.count({ where: { propostaId: proposta.id } })).toBe(0);
});

it("permite replay idêntico e bloqueia replay com motivo ou alçada alterados", async () => {
  const pedido = await registrarPedido();
  const aplicacaoBase = await aplicarBase(pedido);
  const primeira = await prepararDelta(aplicacaoBase.id, "preparo-replay-delta-q249");
  expect(await prepararReconferenciaDeltaDesistencia({ aplicacaoBaseId: aplicacaoBase.id,
    motivo: "Reconferência posterior de fato financeiro auditável.", chaveIdempotencia: "preparo-replay-delta-q249" })).toMatchObject({ ok: true, dado: { id: primeira.id } });
  expect(await prepararReconferenciaDeltaDesistencia({ aplicacaoBaseId: aplicacaoBase.id,
    motivo: "Outro motivo não pode reutilizar a mesma chave de preparo.", chaveIdempotencia: "preparo-replay-delta-q249" })).toMatchObject({ ok: false });
  const decisao = await aprovarDelta(primeira.id, "decisao-replay-delta-q249");
  await prisma.usuario.update({ where: { id: financeiroAprovador.id }, data: { permissoes: [] } });
  entrar(financeiroAprovador.id);
  expect(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-replay-delta-q249" })).toMatchObject({ ok: false });
  expect(await prisma.aplicacaoReconferenciaDeltaDesistencia.count({ where: { propostaId: primeira.id } })).toBe(0);
});






it("bloqueia a efetivação quando reserva posterior reduz o saldo externo reconhecido", async () => {
  const { pedido, aplicacaoBase, credito } = await criarBaseComCreditoExterno("reserva-253-q249");
  const proposta = await prepararDelta(aplicacaoBase.id, "preparo-reserva-253-q249");
  const decisao = await aprovarDelta(proposta.id, "decisao-reserva-253-q249");
  entrar(financeiroAprovador.id);
  dado(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-reserva-253-q249" }));
  entrar(financeiroPreparador.id);
  const devolucao = dado(await proporDevolucaoCredito({ creditoId: credito.id, valor: "3.00",
    pedidoAluno: "Aluno solicitou devolução parcial do crédito externo.", evidenciaPedido: "Solicitação registrada para reservar o saldo do crédito.",
    destino: "Conta bancária indicada no pedido do aluno.", motivo: "Reservar crédito externo após a reconferência aplicada.", chaveIdempotencia: "devolucao-reserva-253-q249" }));
  entrar(financeiroAprovador.id);
  expect(await decidirDevolucaoCredito({ propostaId: devolucao.id, aprovar: true, motivo: "Reserva de devolução conferida por aprovador independente." })).toMatchObject({ ok: true });
  expect(await prisma.reservaDevolucaoCredito.count({ where: { creditoId: credito.id, estado: "AGUARDANDO_EXECUCAO" } })).toBe(1);
  entrar(base.secretariaId);
  expect(await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacaoBase.id, motivo: "Secretaria tenta efetivar após reserva de crédito posterior." })).toMatchObject({ ok: false });
});

it("bloqueia aplicação e efetivação quando o decisor administrativo delta perde a alçada", async () => {
  const { pedido, aplicacaoBase } = await criarBaseComCreditoExterno("admin-revogado-253-q249");
  const adminDelta = await criarUsuario([Papel.ADMINISTRADOR], "Admin delta Q249 revogado");
  const proposta = await prepararDelta(aplicacaoBase.id, "preparo-admin-revogado-253-q249");
  const decisao = await aprovarDelta(proposta.id, "decisao-admin-revogado-253-q249", financeiroAprovador.id, adminDelta.id);
  await prisma.usuario.update({ where: { id: adminDelta.id }, data: { ativo: false } });
  entrar(financeiroAprovador.id);
  expect(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-admin-revogado-253-q249" })).toMatchObject({ ok: false });
  expect(await prisma.aplicacaoReconferenciaDeltaDesistencia.count({ where: { propostaId: proposta.id } })).toBe(0);
  await prisma.usuario.update({ where: { id: adminDelta.id }, data: { ativo: true } });
  entrar(financeiroAprovador.id);
  dado(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-admin-reabilitado-253-q249" }));
  await prisma.usuario.update({ where: { id: adminDelta.id }, data: { ativo: false } });
  entrar(base.secretariaId);
  expect(await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacaoBase.id, motivo: "Secretaria tenta efetivar após revogação administrativa delta." })).toMatchObject({ ok: false });
  entrar(financeiroPreparador.id);
  const revisao = await prepararDelta(aplicacaoBase.id, "preparo-revisao-alcada-q255");
  const propostaRevisao = await prisma.propostaReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: revisao.id } });
  expect(propostaRevisao.memoriaDelta).toMatchObject({ revisaoAutorizacao: true, tipo: "SEM_EFEITO" });
  const decisaoRevisao = await aprovarDelta(revisao.id, "decisao-revisao-alcada-q255");
  entrar(financeiroAprovador.id);
  dado(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisaoRevisao.id, chaveIdempotencia: "aplicacao-revisao-alcada-q255" }));
  entrar(base.secretariaId);
  expect(await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacaoBase.id, motivo: "Secretaria efetiva após nova dupla alçada válida." })).toMatchObject({ ok: true });
});

it("aceita o mesmo decisor financeiro e administrativo quando ele é independente do preparador", async () => {
  const { pedido, aplicacaoBase } = await criarBaseComCreditoExterno("dupla-alcada-253-q249");
  const aprovadorDuplo = await criarUsuario([Papel.FINANCEIRO, Papel.ADMINISTRADOR], "Aprovador financeiro e administrativo Q249");
  await prisma.usuario.update({ where: { id: aprovadorDuplo.id }, data: { permissoes: ["financeiro.aprovar_acertos"] } });
  const proposta = await prepararDelta(aplicacaoBase.id, "preparo-dupla-alcada-253-q249");
  const decisao = await aprovarDelta(proposta.id, "decisao-dupla-alcada-253-q249", aprovadorDuplo.id, aprovadorDuplo.id);
  entrar(aprovadorDuplo.id);
  expect(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-dupla-alcada-253-q249" })).toMatchObject({ ok: true });
  entrar(base.secretariaId);
  expect(await efetivarPedidoDesistenciaPreparacao({ pedidoId: pedido.id, estadoHash: pedido.estadoHash,
    aplicacaoAcertoDesistenciaContratualId: aplicacaoBase.id, motivo: "Secretaria efetiva após duas alçadas da mesma pessoa independente." })).toMatchObject({ ok: true });
});

it("rejeita inserção SQL que omite o reconhecimento obrigatório do crédito externo", async () => {
  const { aplicacaoBase } = await criarBaseComCreditoExterno("omissao-sql-253-q249");
  const propostaResultado = await prepararDelta(aplicacaoBase.id, "preparo-omissao-sql-253-q249");
  const decisao = await aprovarDelta(propostaResultado.id, "decisao-omissao-sql-253-q249");
  const proposta = await prisma.propostaReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: propostaResultado.id } });
  await expect(prisma.$transaction(async tx => {
    await tx.$executeRaw`
      INSERT INTO "AplicacaoReconferenciaDeltaDesistencia"
        (id,"propostaId","decisaoFinanceiraId","aplicacaoBaseId","aplicacaoDeltaAnteriorId","executorId","fotografiaHash",fotografia,"fotografiaPosteriorHash","fotografiaPosterior","memoriaDelta","chaveIdempotencia")
      VALUES
        (${'omissao-reconhecimento-sql-253'},${proposta.id},${decisao.id},${aplicacaoBase.id},${proposta.aplicacaoDeltaAnteriorId},${financeiroAprovador.id},${proposta.fotografiaHash},${JSON.stringify(proposta.fotografia)}::jsonb,${proposta.fotografiaHash},${JSON.stringify(proposta.fotografia)}::jsonb,${JSON.stringify(proposta.memoriaDelta)}::jsonb,${'omissao-reconhecimento-chave-253'})
    `;
    await tx.propostaReconferenciaDeltaDesistencia.update({ where: { id: proposta.id }, data: { estado: "APLICADA" } });
    await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  })).rejects.toThrow("Crédito externo positivo exige reconhecimento auditável na cadeia delta");
  expect(await prisma.aplicacaoReconferenciaDeltaDesistencia.count({ where: { propostaId: proposta.id } })).toBe(0);
});

it("rejeita fotografia posterior ausente ou inventada fora da aplicação transacional", async () => {
  const { aplicacaoBase, credito } = await criarBaseComCreditoExterno("foto-posterior-sql-255");
  const propostaResultado = await prepararDelta(aplicacaoBase.id, "preparo-foto-posterior-sql-255");
  const decisao = await aprovarDelta(propostaResultado.id, "decisao-foto-posterior-sql-255");
  const proposta = await prisma.propostaReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: propostaResultado.id } });
  const inserir = async (fotografiaPosterior: unknown, hashPosterior: string | null, id: string) => prisma.$transaction(async tx => {
    await tx.$executeRaw`
      INSERT INTO "AplicacaoReconferenciaDeltaDesistencia"
        (id,"propostaId","decisaoFinanceiraId","aplicacaoBaseId","aplicacaoDeltaAnteriorId","executorId","fotografiaHash",fotografia,"fotografiaPosteriorHash","fotografiaPosterior","memoriaDelta","chaveIdempotencia")
      VALUES
        (${id},${proposta.id},${decisao.id},${aplicacaoBase.id},${proposta.aplicacaoDeltaAnteriorId},${financeiroAprovador.id},${proposta.fotografiaHash},${JSON.stringify(proposta.fotografia)}::jsonb,${hashPosterior},${fotografiaPosterior === null ? null : JSON.stringify(fotografiaPosterior)}::jsonb,${JSON.stringify(proposta.memoriaDelta)}::jsonb,${`${id}-chave`})
    `;
    await tx.reconhecimentoCreditoReconferenciaDeltaDesistencia.create({ data: { aplicacaoId: id, creditoId: credito.id, valor: 10 } });
    await tx.propostaReconferenciaDeltaDesistencia.update({ where: { id: proposta.id }, data: { estado: "APLICADA" } });
    await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  });
  await expect(inserir(null, null, "foto-posterior-ausente-255")).rejects.toThrow("fotografia posterior completa");
  const inventada = { matriculaId: base.matriculaId, cobrancas: [], creditos: [] };
  await expect(inserir(inventada, hashSubstituicao(inventada), "foto-posterior-inventada-255")).rejects.toThrow("não corresponde integralmente ao ledger");
  expect(await prisma.aplicacaoReconferenciaDeltaDesistencia.count({ where: { propostaId: proposta.id } })).toBe(0);
});

it("não permite completar fotografia posterior depois de a aplicação ter sido persistida", async () => {
  const { aplicacaoBase } = await criarBaseComCreditoExterno("foto-posterior-imutavel-255");
  const proposta = await prepararDelta(aplicacaoBase.id, "preparo-foto-posterior-imutavel-255");
  const decisao = await aprovarDelta(proposta.id, "decisao-foto-posterior-imutavel-255");
  entrar(financeiroAprovador.id);
  const aplicacao = dado(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-foto-posterior-imutavel-255" }));
  await expect(prisma.$executeRaw`
    UPDATE "AplicacaoReconferenciaDeltaDesistencia"
    SET "fotografiaPosterior"=${JSON.stringify({ matriculaId: base.matriculaId, cobrancas: [], creditos: [] })}::jsonb
    WHERE id=${aplicacao.id}
  `).rejects.toThrow("imutável fora da fotografia posterior única");
});

it("recupera somente o replay idêntico da aplicação delta sem repetir efeitos", async () => {
  const { aplicacaoBase } = await criarBaseComCreditoExterno("replay-aplicacao-253-q249");
  const proposta = await prepararDelta(aplicacaoBase.id, "preparo-replay-aplicacao-253-q249");
  const decisao = await aprovarDelta(proposta.id, "decisao-replay-aplicacao-253-q249");
  entrar(financeiroAprovador.id);
  const primeira = dado(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-replay-identica-253-q249" }));
  const repetida = dado(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-replay-identica-253-q249" }));
  expect(repetida.id).toBe(primeira.id);
  expect(await prisma.aplicacaoReconferenciaDeltaDesistencia.count({ where: { propostaId: proposta.id } })).toBe(1);
  expect(await prisma.reconhecimentoCreditoReconferenciaDeltaDesistencia.count({ where: { aplicacaoId: primeira.id } })).toBe(1);
  expect(await aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId: decisao.id, chaveIdempotencia: "aplicacao-replay-outra-chave-253-q249" })).toMatchObject({ ok: false });
});
