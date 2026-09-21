import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { carregarOrigensExcedentePermutaTx } from "./excedente-permuta-origens-tx";

const d = (valor: string | number) => new Prisma.Decimal(valor);
const cobrancaBase = () => ({
  id: "cobranca", matriculaId: "matricula", versao: 7, moeda: "CRC", valorNegociado: d(100), valorRecebido: d(20), valorLiquidadoCredito: d(30), valorCompensadoPermuta: d(50), saldo: d(0),
  matricula: { moeda: "CRC" },
  informes: [] as Array<{ id: string; versao: number; valor: Prisma.Decimal; moeda: string }>,
  destinacoesRecebimento: [{ id: "destino-caixa", cobrancaId: "cobranca", valor: d(20), recebimento: { id: "recebimento", titularMatriculaId: "matricula", moeda: "CRC" } }],
  utilizacoesCreditoPropostas: [{ id: "uso-credito", cobrancaId: "cobranca", versao: 2, valor: d(30), decisao: { id: "decisao-credito", aprovada: true }, credito: { id: "credito", matriculaId: "matricula", moeda: "CRC" } }] as Array<{ id: string; cobrancaId: string; versao: number; valor: Prisma.Decimal; decisao: { id: string; aprovada: boolean } | null; credito: { id: string; matriculaId: string; moeda: string } }>,
  aplicacoesPermuta: [{ id: "aplicacao-permuta", cobrancaId: "cobranca", valor: d(50), decisaoId: "decisao-permuta", decisao: { id: "decisao-permuta", aprovada: true, propostaId: "proposta-permuta" }, destino: { id: "destino-permuta", cobrancaId: "cobranca", valor: d(50), propostaId: "proposta-permuta", proposta: { id: "proposta-permuta", decisao: { id: "decisao-permuta", aprovada: true }, confirmacao: { acordo: { matriculaId: "matricula", moeda: "CRC" } } } } }],
  ajusteAcerto: null, origensCreditoAcertoTaxaAditivo: [], aplicacoesPeriodoIntegral: [],
});
const txCom = (cobranca = cobrancaBase(), creditosAcerto: unknown[] = [], creditosDesistencia: unknown[] = []) => ({
  cobranca: { findFirst: vi.fn().mockResolvedValue(cobranca) },
  origemCreditoAcertoDesistenciaContratual: { findMany: vi.fn().mockResolvedValue(creditosDesistencia) },
  origemCreditoAcerto: { findMany: vi.fn().mockResolvedValue(creditosAcerto) },
}) as unknown as Prisma.TransactionClient;

describe("carregarOrigensExcedentePermutaTx", () => {
  it("não libera novamente valores já creditados por desistência contratual", async () => {
    const origem = { id: "origem-q165", matriculaId: "matricula", cobrancaId: "cobranca", valor: d(10), moeda: "CRC",
      credito: { id: "credito-q165", matriculaId: "matricula", valorInicial: d(10), moeda: "CRC" } };
    const resultado = await carregarOrigensExcedentePermutaTx(txCom(cobrancaBase(), [], [origem]), { matriculaId: "matricula", cobrancaId: "cobranca" });
    expect(resultado).toMatchObject({ status: "PENDENTE_ORIGEM_NAO_FINAL", pendencias: [{ origem: "DESISTENCIA_CONTRATUAL", ids: ["origem-q165", "credito-q165"], valor: "10.00" }] });
    origem.credito.valorInicial = d(9);
    await expect(carregarOrigensExcedentePermutaTx(txCom(cobrancaBase(), [], [origem]), { matriculaId: "matricula", cobrancaId: "cobranca" })).rejects.toThrow("origem comprovada");
  });
  it("preserva IDs materiais e a versão atual na fotografia pronta", async () => {
    const resultado = await carregarOrigensExcedentePermutaTx(txCom(), { matriculaId: "matricula", cobrancaId: "cobranca" });
    expect(resultado).toMatchObject({ status: "PRONTA", fotografia: { versaoCobranca: 7, obrigacaoAtual: "100.00", recebido: "20.00", creditoLiquidado: "30.00", permutaCompensada: "50.00" },
      origens: [{ id: "destino-caixa", tipo: "CAIXA", versaoCobranca: 7 }, { id: "uso-credito", tipo: "CREDITO", versaoCobranca: 7 }, { id: "aplicacao-permuta", tipo: "PERMUTA", versaoCobranca: 7 }],
    });
    expect(resultado).not.toHaveProperty("valorDevido");
  });

  it("recusa contador que não corresponde às fontes identificadas", async () => {
    const cobranca = cobrancaBase(); cobranca.valorRecebido = d(21);
    await expect(carregarOrigensExcedentePermutaTx(txCom(cobranca), { matriculaId: "matricula", cobrancaId: "cobranca" })).rejects.toThrow("contador de caixa");
  });

  it("recusa permuta sem a mesma decisão aprovada na proposta", async () => {
    const cobranca = cobrancaBase(); cobranca.aplicacoesPermuta[0].destino.proposta.decisao.id = "outra-decisao";
    await expect(carregarOrigensExcedentePermutaTx(txCom(cobranca), { matriculaId: "matricula", cobrancaId: "cobranca" })).rejects.toThrow("cadeia aprovada");
  });

  it("mantém pendente crédito anterior sem atribuição material às fontes", async () => {
    const c = cobrancaBase(); (c as { ajusteAcerto: unknown }).ajusteAcerto = { id: "ajuste", versaoAnterior: 6, valorAnterior: d(120), valorNovo: d(100), creditoApurado: d(20), moeda: "CRC", origem: { id: "cobranca", matriculaId: "matricula", versao: 6, moeda: "CRC" } };
    const credito = { id: "origem-credito", decisaoId: "decisao", matriculaId: "matricula", origemTipo: "COBRANCA", origemId: "cobranca", valor: d(20), moeda: "CRC" };
    await expect(carregarOrigensExcedentePermutaTx(txCom(c, [credito]), { matriculaId: "matricula", cobrancaId: "cobranca" })).resolves.toMatchObject({ status: "PENDENTE_ORIGEM_NAO_FINAL", pendencias: [{ origem: "ENCERRAMENTO_LEGADO", ids: ["ajuste", "origem-credito"], valor: "20.00" }] });
  });

  it("recusa ajuste histórico que não prova o estado da cobrança", async () => {
    const c = cobrancaBase(); (c as { ajusteAcerto: unknown }).ajusteAcerto = { id: "ajuste", versaoAnterior: 7, valorAnterior: d(120), valorNovo: d(100), creditoApurado: d(0), moeda: "CRC", origem: { id: "cobranca", matriculaId: "matricula", versao: 7, moeda: "CRC" } };
    await expect(carregarOrigensExcedentePermutaTx(txCom(c), { matriculaId: "matricula", cobrancaId: "cobranca" })).rejects.toThrow("evidência estruturada");
  });

  it("mantém pendentes o informe sem conferência e a proposta de crédito sem decisão", async () => {
    const c = cobrancaBase();
    c.informes.push({ id: "informe", versao: 3, valor: d(10), moeda: "CRC" });
    c.utilizacoesCreditoPropostas.push({ id: "uso-pendente", cobrancaId: "cobranca", versao: 3, valor: d(10), decisao: null, credito: { id: "credito-pendente", matriculaId: "matricula", moeda: "CRC" } });
    await expect(carregarOrigensExcedentePermutaTx(txCom(c), { matriculaId: "matricula", cobrancaId: "cobranca" })).resolves.toMatchObject({
      status: "PENDENTE_ORIGEM_NAO_FINAL",
      fotografia: { informesAConferir: [{ id: "informe", versao: 3, valor: "10.00", moeda: "CRC" }], propostasUsoCreditoAguardarDecisao: [{ id: "uso-pendente", creditoId: "credito-pendente", versao: 3, valor: "10.00" }] },
      pendencias: [{ codigo: "INFORME_PAGAMENTO_A_CONFERIR", ids: ["informe"] }, { codigo: "PROPOSTA_USO_CREDITO_A_DECIDIR", ids: ["uso-pendente"] }],
    });
  });
});
