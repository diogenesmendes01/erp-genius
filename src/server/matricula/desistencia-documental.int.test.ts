import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararFixtureSubstituicaoContratual } from "@/test/substituicao-contratual";
import { prepararSubstituicaoContratualTx, decidirSubstituicaoContratualTx } from "@/server/contratos/substituicao-tx";
import { iniciarCancelamentoAssinaturaTx, registrarObservacaoCancelamentoTx } from "@/server/contratos/cancelamento-assinatura-tx";
import { consultarDocumentosDesistenciaPreparacao } from "./desistencia-documental";
import { consultarDesistenciaPreparacao, registrarPedidoDesistenciaPreparacao } from "./desistencia-preparacao";

let base: Awaited<ReturnType<typeof prepararFixtureSubstituicaoContratual>>;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  await truncarBanco();
  base = await prepararFixtureSubstituicaoContratual(authMock);
  entrar(base.secretariaId);
});

it("expõe apenas metadados documentais e conserva toda a fonte contratual", async () => {
  const documento = await prisma.documento.create({ data: {
    matriculaId: base.matriculaId, categoria: "CONTRATO", nome: "Contrato para conferência", url: "/api/files/segredo-nao-exposto.pdf",
  } });
  const antes = {
    matricula: await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } }),
    documentos: await prisma.documento.count({ where: { matriculaId: base.matriculaId } }),
    processos: await prisma.processoAssinaturaContratual.count({ where: { matriculaId: base.matriculaId } }),
    intencoes: await prisma.intencaoCancelamentoAssinatura.count(),
  };

  const resposta = await consultarDocumentosDesistenciaPreparacao({ matriculaId: base.matriculaId });
  expect(resposta.ok, resposta.ok ? undefined : resposta.erro).toBe(true);
  if (!resposta.ok || !resposta.dado) throw new Error("Consulta documental ausente.");
  expect(resposta.dado).toMatchObject({
    matricula: { id: base.matriculaId },
    pedido: null,
    documentos: [{ id: documento.id, categoria: "CONTRATO", nome: "Contrato para conferência" }],
    processos: [{ id: base.processoId, fornecedor: "ZAPSIGN", ambiente: "SANDBOX", referenciaExternaPresente: true, conclusaoRegistrada: false,
      cancelamentoSubstituicao: { situacao: "NAO_INICIADO" } }],
    possuiPendenciaDocumental: true,
  });
  const texto = JSON.stringify(resposta.dado);
  for (const segredo of ["url", "hash", "participantes", "assinaturas", base.referenciaExternaFonte, "segredo-nao-exposto.pdf"])
    expect(texto).not.toContain(segredo);
  expect(resposta.dado.processos[0]).not.toHaveProperty("referenciaExterna");
  expect(resposta.dado.pendencias).toContainEqual(expect.stringContaining("Processo de assinatura 1"));
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: base.matriculaId } })).toEqual(antes.matricula);
  expect(await prisma.documento.count({ where: { matriculaId: base.matriculaId } })).toBe(antes.documentos);
  expect(await prisma.processoAssinaturaContratual.count({ where: { matriculaId: base.matriculaId } })).toBe(antes.processos);
  expect(await prisma.intencaoCancelamentoAssinatura.count()).toBe(antes.intencoes);
});

it("mantém resultado de substituição como pendência, sem autorização Q121", async () => {
  const entrada = { processoFonteId: base.processoId, conferenciaSubstitutoId: base.conferenciaSubstitutoId,
    revisaoFonteEsperada: base.revisaoFonteHash, revisaoSubstitutoEsperada: base.revisaoSubstitutoHash,
    motivo: "Corrigir o contrato para a conferência documental", chaveIdempotencia: "desistencia-documental-substituicao" };
  const proposta = await prisma.$transaction(tx => prepararSubstituicaoContratualTx(tx, base.secretariaId, entrada));
  await prisma.$transaction(tx => decidirSubstituicaoContratualTx(tx, base.adminId, {
    propostaId: proposta.id, propostaHashEsperado: proposta.propostaHash, aprovada: true, motivo: "Substituição conferida por outra pessoa",
  }));
  const intencao = await prisma.$transaction(tx => iniciarCancelamentoAssinaturaTx(tx, base.secretariaId, { propostaId: proposta.id, propostaHash: proposta.propostaHash }));
  await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, {
    intencaoId: intencao.id, processoId: base.processoId, propostaId: proposta.id, chave: "desistencia-documental-incerto",
    resultado: "INCERTO", referenciaExterna: base.referenciaExternaFonte, evidenciaHash: "d".repeat(64),
  }));

  const resposta = await consultarDocumentosDesistenciaPreparacao({ matriculaId: base.matriculaId });
  expect(resposta).toMatchObject({ ok: true, dado: { processos: [{ id: base.processoId,
    cancelamentoSubstituicao: { situacao: "RESULTADO_INCERTO" } }], possuiPendenciaDocumental: true } });
  if (!resposta.ok || !resposta.dado) throw new Error("Consulta documental ausente.");
  expect(resposta.dado.pendencias).toContain("A fonte de substituição contratual permanece distinta: nenhuma observação de cancelamento autoriza o pedido de desistência.");
  expect(JSON.stringify(resposta.dado)).not.toContain(base.referenciaExternaFonte);

  await prisma.$transaction(tx => registrarObservacaoCancelamentoTx(tx, {
    intencaoId: intencao.id, processoId: base.processoId, propostaId: proposta.id, chave: "desistencia-documental-confirmado",
    resultado: "CONFIRMADO", referenciaExterna: base.referenciaExternaFonte, evidenciaHash: "e".repeat(64),
  }));
  expect(await consultarDocumentosDesistenciaPreparacao({ matriculaId: base.matriculaId })).toMatchObject({ ok: true, dado: {
    processos: [{ id: base.processoId, cancelamentoSubstituicao: { situacao: "RESULTADO_CONFIRMADO" } }],
    possuiPendenciaDocumental: true,
  } });
});

it("não inventa pendência documental quando há pedido, mas não há documento ou processo", async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  const secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA]);
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Sem documento", paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "AGUARDANDO" } });
  entrar(secretaria.id);
  const preparacao = await consultarDesistenciaPreparacao({ matriculaId: matricula.id });
  if (!preparacao.ok || !preparacao.dado) throw new Error("Preparação ausente.");
  const pedidoResultado = await registrarPedidoDesistenciaPreparacao({ matriculaId: matricula.id, estadoHash: preparacao.dado.estadoHash,
    motivo: "Pedido de desistência registrado para a conferência.", evidenciaPedido: "Atendimento documentado e disponível para conferência posterior.",
    chaveIdempotencia: "desistencia-documental-sem-fontes" });
  if (!pedidoResultado.ok || !pedidoResultado.dado) throw new Error("Pedido ausente.");
  expect(await consultarDocumentosDesistenciaPreparacao({ matriculaId: matricula.id })).toMatchObject({ ok: true, dado: {
    matricula: { id: matricula.id }, pedido: { id: pedidoResultado.dado.id, versao: 1 }, documentos: [], processos: [], pendencias: [], possuiPendenciaDocumental: false,
  } });
});

it("permite Secretaria e Administração, e recusa papel ou sessão revogada", async () => {
  const vendedor = await criarUsuario([Papel.VENDEDOR]);
  entrar(vendedor.id);
  expect(await consultarDocumentosDesistenciaPreparacao({ matriculaId: base.matriculaId })).toMatchObject({ ok: false });
  entrar(base.adminId);
  expect(await consultarDocumentosDesistenciaPreparacao({ matriculaId: base.matriculaId })).toMatchObject({ ok: true });
  await prisma.usuario.update({ where: { id: base.secretariaId }, data: { ativo: false } });
  entrar(base.secretariaId);
  expect(await consultarDocumentosDesistenciaPreparacao({ matriculaId: base.matriculaId })).toMatchObject({ ok: false });
});
