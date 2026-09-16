import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

const m = vi.hoisted(() => ({
  papeis: ["SECRETARIA_ACADEMICA"] as string[],
  $queryRaw: vi.fn(),
  aluno: { findUnique: vi.fn() },
  matricula: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  cobranca: { findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
  documento: { findFirst: vi.fn() },
  preparacaoComercialMatricula: { findUnique: vi.fn(), count: vi.fn() },
  aceiteOriginalContratual: { findUnique: vi.fn() },
  conclusaoAssinaturaContratual: { findFirst: vi.fn() },
  condicoesEntradaPreparacao: { findFirst: vi.fn() },
  pagadorPreparacaoMatricula: { findFirst: vi.fn() },
  evento: { findFirst: vi.fn() },
  configuracaoOperacional: { findUnique: vi.fn() },
  aprovacao: { count: vi.fn() },
  recebimento: { create: vi.fn() },
  versaoCondicoesAditivo: { findMany: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { ...m, $transaction: async (fn: (tx: typeof m) => Promise<unknown>) => fn(m) } }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, registrarEvento: vi.fn(), exigirSessao: async () => ({ id: "operador", nome: "Operador", papeis: m.papeis as Papel[] }) };
});

import { ativarMatricula, concluirMatricula } from "./acoes";
import { exigirContratoAceito } from "./ativacao";
import { exigirEntradaMensalRegistrada } from "./entrada-ativacao";
import { validarConclusaoAssinatura } from "@/server/contratos/conclusao-assinatura-schema";
import { hashPrevia } from "@/server/contratos/previa-estado";

function configurarAceiteIntegrado() {
  const identidade = { nome: "Aluno Teste", email: "aluno@example.test", documento: "TESTE" };
  const participantes = { participantes: [{ papel: "ALUNO", etapa: "CLIENTE", identidade }] };
  const pdf = Buffer.from("%PDF-1.7 original unitário"), pdfHash = createHash("sha256").update(pdf).digest("hex");
  const enviada = new Date("2026-08-30T10:00:00Z");
  const c = validarConclusaoAssinatura({ processoId: "processo", referenciaExterna: "externo", originalHash: pdfHash, concluidaEm: "2026-08-30T11:00:00Z",
    pdfAssinado: Buffer.from("%PDF-1.7 assinado unitário"), evidencias: Buffer.from("auditoria unitária"),
    assinaturas: [{ papel: "ALUNO", identidadeHash: hashPrevia(identidade), referenciaAssinatura: "assinatura", assinadaEm: "2026-08-30T11:00:00Z" }] }, participantes, enviada);
  m.conclusaoAssinaturaContratual.findFirst.mockResolvedValue({ ...c, id: "conclusao", processo: { id: "processo", ambiente: "PRODUCAO", estado: "ENVIADO", referenciaExterna: "externo",
    artefato: { pdf, pdfHash, conferencia: { snapshot: participantes } }, tentativas: [{ iniciadaEm: enviada }] } });
  m.aceiteOriginalContratual.findUnique.mockResolvedValue({ id: "aceite", conclusaoId: "conclusao", autorId: "secretaria", criadaEm: new Date("2026-09-01"),
    documento: { id: "contrato", matriculaId: "matricula", categoria: "CONTRATO", arquivado: false, url: "/api/matriculas/matricula/assinaturas/conclusao/pdf" },
    snapshot: { condicoesId: "condicoes", pagadorRegistroId: "pagador", conclusaoHash: c.entradaHash, originalHash: pdfHash } });
  m.condicoesEntradaPreparacao.findFirst.mockResolvedValue({ id: "condicoes" });
  m.pagadorPreparacaoMatricula.findFirst.mockResolvedValue({ id: "pagador" });
}

const decimal = (valor: number) => new Prisma.Decimal(valor);
function cobrancas() {
  return [
    { id: "taxa", tipo: "MATRICULA", status: "PAGO", valorOriginal: decimal(100), valorNegociado: decimal(100), valorRecebido: decimal(100), saldo: decimal(0), vencimento: new Date("2026-09-01"), pagoEm: new Date("2026-09-02") },
    { id: "primeira", tipo: "MENSALIDADE", coberturaInicio: new Date("2026-10-01"), coberturaFim: new Date("2026-10-31"), status: "PENDENTE", valorOriginal: decimal(200), valorNegociado: decimal(200), valorRecebido: null, saldo: decimal(200), vencimento: new Date("2026-10-05"), pagoEm: null },
  ];
}

beforeEach(() => {
  vi.resetAllMocks(); m.papeis = [Papel.SECRETARIA_ACADEMICA];
  // Locks do fluxo não retornam dados; a checagem da conclusão integrada, sim.
  m.$queryRaw.mockResolvedValue([{ existe: false }]);
  m.aluno.findUnique.mockResolvedValue({ status: "ATIVO" });
  m.matricula.findMany.mockResolvedValue([{ id: "matricula", leadId: null }]);
  m.matricula.findUnique.mockResolvedValue({
    id: "matricula", leadId: null, alunoId: "aluno", status: "AGUARDANDO", mesesPlano: 1, diaVencimento: 5,
    referenciaCobertura: "MES_CIVIL", dataReferenciaCobertura: null,
    contratoOk: true, contratoDocumentoId: "contrato", confirmacaoContratoEm: new Date("2026-09-01"), confirmacaoContratoPorId: "secretaria",
    cobrancas: cobrancas(), comissoes: [],
  });
  m.documento.findFirst.mockResolvedValue({ id: "contrato", url: "/api/files/contrato.pdf" });
  m.preparacaoComercialMatricula.findUnique.mockResolvedValue(null);
  m.preparacaoComercialMatricula.count.mockImplementation(async () => await m.preparacaoComercialMatricula.findUnique() ? 1 : 0);
  m.aceiteOriginalContratual.findUnique.mockResolvedValue(null);
  m.configuracaoOperacional.findUnique.mockResolvedValue(null);
  m.aprovacao.count.mockResolvedValue(0);
  m.cobranca.findUniqueOrThrow.mockResolvedValue(cobrancas()[0]);
  m.versaoCondicoesAditivo.findMany.mockResolvedValue([]);
});

describe("conclusão de matrícula — contrato aceito e pagamentos confirmados", () => {
  it.each([true, false])("guard contratual e política registrada preservam exigência=%s", async (exigir) => {
    configurarAceiteIntegrado();
    m.configuracaoOperacional.findUnique.mockResolvedValue({ exigirPrimeiraMensalidade: !exigir });
    m.preparacaoComercialMatricula.findUnique.mockResolvedValue({ regime: "MENSALIDADE", decisaoPreco: null, referencias: {
      politicaEntrada: { taxaPreviaAssinatura: false, exigirPrimeiraMensalidade: exigir },
      alcada: { componentes: ["MATRICULA", "MENSALIDADE"].map((tipo) => ({ tipo, referencia: "100", proposto: "100", limitePct: null, descontoPct: "0", resultado: "DENTRO_ALCADA" })) },
    } });
    const tx = m as unknown as Prisma.TransactionClient;
    await expect(exigirContratoAceito(tx, await m.matricula.findUnique())).resolves.toBe("contrato");
    await expect(exigirEntradaMensalRegistrada(tx, "matricula")).resolves.toBe(exigir);
    expect(m.matricula.update).not.toHaveBeenCalled();
    expect(m.configuracaoOperacional.findUnique).not.toHaveBeenCalled();
  });
  it("preparação com flags legadas não ativa sem aceite integrado", async () => {
    m.preparacaoComercialMatricula.findUnique.mockResolvedValue({ regime: "MENSALIDADE", referencias: {
      politicaEntrada: { taxaPreviaAssinatura: false, exigirPrimeiraMensalidade: false },
      alcada: { componentes: ["MATRICULA", "MENSALIDADE"].map(tipo => ({ tipo, referencia: "100", proposto: "100", limitePct: null, descontoPct: "0", resultado: "DENTRO_ALCADA" })) },
    } });
    await expect(exigirContratoAceito(m as unknown as Prisma.TransactionClient, await m.matricula.findUnique())).rejects.toThrow("fluxo integrado");
    expect(m.matricula.update).not.toHaveBeenCalled();
    expect(m.recebimento.create).not.toHaveBeenCalled();
  });
  it("recusa valor diferente do aceite e permite confirmação de pagamento sem mudar condições", async () => {
    const matricula = await m.matricula.findUnique();
    const c = matricula.cobrancas[1];
    m.evento.findFirst.mockResolvedValue({ payload: { documentoId: "contrato", condicoesMensais: {
      referenciaCobertura: "MES_CIVIL", dataReferenciaCobertura: null, diaVencimento: 5,
      mensalidades: [{ id: c.id, coberturaInicio: c.coberturaInicio.toISOString(), coberturaFim: c.coberturaFim.toISOString(), vencimento: c.vencimento.toISOString(), valorNegociado: "200", moeda: "CRC" }],
    } } });
    m.matricula.findUnique.mockResolvedValue({ ...matricula, cobrancas: [matricula.cobrancas[0], { ...c, moeda: "CRC", valorNegociado: decimal(210) }] });
    expect(await concluirMatricula("matricula")).toMatchObject({ ok: false, erro: expect.stringContaining("diferem do aceite") });
    expect(m.matricula.update).not.toHaveBeenCalled();
    m.matricula.findUnique.mockResolvedValue({ ...matricula, cobrancas: [matricula.cobrancas[0], { ...c, moeda: "CRC", status: "PAGO", valorRecebido: decimal(200), saldo: decimal(0), pagoEm: new Date() }] });
    expect((await concluirMatricula("matricula")).ok).toBe(true);
  });
  it("não ativa legado sem referência mesmo com aceite e taxa confirmados", async () => {
    const matricula = await m.matricula.findUnique();
    m.matricula.findUnique.mockResolvedValue({ ...matricula, referenciaCobertura: null });
    expect(await concluirMatricula("matricula")).toMatchObject({ ok: false, erro: expect.stringContaining("Confira") });
    expect(m.matricula.update).not.toHaveBeenCalled();
  });
  it.each([Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR])("%s conclui sem criar baixa; primeira mensalidade é opcional por padrão", async (papel) => {
    m.papeis = [papel];
    expect((await concluirMatricula("matricula")).ok).toBe(true);
    expect(m.matricula.update).toHaveBeenCalledWith({ where: { id: "matricula" }, data: expect.objectContaining({ status: "ATIVA", pagamentoTaxaOk: true, primeiraMensalidadeOk: false }) });
    expect(m.recebimento.create).not.toHaveBeenCalled();
    expect(m.cobranca.update).not.toHaveBeenCalled();
  });

  it.each(["contratoDocumentoId", "confirmacaoContratoEm", "confirmacaoContratoPorId"])("contratoOk sozinho não supre %s", async (campo) => {
    const matricula = await m.matricula.findUnique();
    m.matricula.findUnique.mockResolvedValue({ ...matricula, [campo]: null });
    const r = await concluirMatricula("matricula");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/contrato/i);
    expect(m.matricula.update).not.toHaveBeenCalled();
  });

  it("documento arquivado, ausente ou de outra matrícula não permite conclusão", async () => {
    m.documento.findFirst.mockResolvedValue(null);
    expect((await concluirMatricula("matricula")).ok).toBe(false);
    expect(m.documento.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: "contrato", categoria: "CONTRATO", arquivado: false, OR: [{ matriculaId: "matricula" }],
    } }));
    expect(m.matricula.update).not.toHaveBeenCalled();
  });

  it("um contrato do lead originador também pode ser evidência do aceite", async () => {
    const matricula = await m.matricula.findUnique();
    m.matricula.findUnique.mockResolvedValue({ ...matricula, leadId: "lead", lead: { etapa: "MATRICULADO" } });
    expect((await concluirMatricula("matricula")).ok).toBe(true);
    expect(m.documento.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: [{ matriculaId: "matricula" }, { leadId: "lead" }] }) }));
  });

  it("informe a conferir e flags antigas não completam a taxa parcialmente recebida", async () => {
    m.cobranca.findUniqueOrThrow.mockResolvedValue({ ...cobrancas()[0], status: "PENDENTE", valorRecebido: decimal(40), pagoEm: null });
    const r = await concluirMatricula("matricula");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/taxa|conferir/i);
    expect(m.matricula.update).not.toHaveBeenCalled();
    expect(m.recebimento.create).not.toHaveBeenCalled();
  });

  it.each([{ valorRecebido: null }, { pagoEm: null }, { valorRecebido: decimal(40) }])("status PAGO sem confirmação financeira suficiente não conta: %j", async (invalido) => {
    m.cobranca.findUniqueOrThrow.mockResolvedValue({ ...cobrancas()[0], ...invalido });
    expect((await concluirMatricula("matricula")).ok).toBe(false);
    expect(m.matricula.update).not.toHaveBeenCalled();
  });

  it("a opção de exigir primeira mensalidade é consultada na execução", async () => {
    m.configuracaoOperacional.findUnique.mockResolvedValue({ exigirPrimeiraMensalidade: true });
    const r = await concluirMatricula("matricula");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/primeira mensalidade/i);
    expect(m.matricula.update).not.toHaveBeenCalled();
    const matricula = await m.matricula.findUnique();
    matricula.cobrancas[1] = { ...matricula.cobrancas[1], status: "PAGO", valorRecebido: decimal(200), saldo: decimal(0), pagoEm: new Date("2026-09-02") };
    m.matricula.findUnique.mockResolvedValue(matricula);
    expect((await concluirMatricula("matricula")).ok).toBe(true);
    expect(m.matricula.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ primeiraMensalidadeOk: true }) }));
  });

  it("o caminho legado receber e ativar também nega antes da baixa se faltar aceite", async () => {
    m.papeis = [Papel.ADMINISTRADOR];
    const matricula = await m.matricula.findUnique();
    m.matricula.findUnique.mockResolvedValue({ ...matricula, contratoOk: false });
    expect((await ativarMatricula("matricula", { valorRecebido: 100, forma: "DINHEIRO", dataPagamento: new Date() })).ok).toBe(false);
    expect(m.recebimento.create).not.toHaveBeenCalled();
    expect(m.matricula.update).not.toHaveBeenCalled();
  });

  it("vendedor não conclui matrícula por chamada direta", async () => {
    m.papeis = [Papel.VENDEDOR];
    expect((await concluirMatricula("matricula")).ok).toBe(false);
    expect(m.matricula.findUnique).not.toHaveBeenCalled();
    expect(m.matricula.update).not.toHaveBeenCalled();
  });
});
