import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prepararCondicoesEncerramento, decidirCondicoesEncerramento } from "./condicoes-encerramento";
import { consultarContextoEncerramento } from "./encerramento-contexto";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
let dados: { matriculaId: string; documentoId: string; preparadorId: string; versao: number; regras: object; motivo: string }, decisorId: string;
beforeEach(async () => {
  await truncarBanco();
  const cat = await seedCatalogoMinimo();
  const preparador = await criarUsuario(["SECRETARIA_ACADEMICA"]);
  const decisor = await criarUsuario(["ADMINISTRADOR"]); decisorId = decisor.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Teste condições", paisId: cat.pais.id } });
  const m = await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: cat.pais.id, produtoId: cat.produto.id, moeda: "CRC" } });
  const doc = await prisma.documento.create({ data: { matriculaId: m.id, categoria: "CONTRATO", nome: "Contrato teste", url: "/api/files/condicoes-teste.pdf" } });
  dados = { matriculaId: m.id, documentoId: doc.id, preparadorId: preparador.id, versao: 1, regras: { diaEncerramento: "INCLUIR" }, motivo: "Transcrição das condições do contrato" };
});
it("prepara e aprova por outra pessoa, sem alterar versão decidida", async () => {
  const regras = { diaEncerramento: "INCLUIR" as const, metodoDesconto: "ANTES_DO_PROPORCIONAL" as const, condicoesDescontos: "Conforme desconto vigente", multa: { tipo: "SEM_PREVISAO" as const, motivo: "Contrato sem multa" } };
  authMock.mockResolvedValue({ user: { id: dados.preparadorId } });
  const input = { matriculaId: dados.matriculaId, documentoId: dados.documentoId, motivo: dados.motivo, regras };
  expect((await prepararCondicoesEncerramento(input)).ok).toBe(false);
  await prisma.matricula.update({ where: { id: dados.matriculaId }, data: { contratoOk: true, contratoDocumentoId: dados.documentoId, confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: dados.preparadorId } });
  const r = await prepararCondicoesEncerramento(input);
  expect(r.ok, r.ok ? undefined : r.erro).toBe(true);
  if (!r.ok) throw new Error(r.erro);
  expect((await prepararCondicoesEncerramento(input)).ok).toBe(false);
  await prisma.usuario.update({ where: { id: dados.preparadorId }, data: { papeis: ["ADMINISTRADOR"] } });
  expect((await decidirCondicoesEncerramento({ id: r.dado!.id, aprovar: true, motivo: "Conferido" })).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: decisorId } });
  expect((await decidirCondicoesEncerramento({ id: r.dado!.id, aprovar: true, motivo: "Conferido" })).ok).toBe(true);
  expect((await decidirCondicoesEncerramento({ id: r.dado!.id, aprovar: false, motivo: "Nova decisão" })).ok).toBe(false);
  expect((await prisma.condicoesEncerramentoMatricula.findUniqueOrThrow({ where: { id: r.dado!.id } })).status).toBe("APROVADA");
});
it("banco impede autoaprovação e decisão sem justificativa", async () => {
  const c = await prisma.condicoesEncerramentoMatricula.create({ data: dados });
  await expect(prisma.condicoesEncerramentoMatricula.update({ where: { id: c.id }, data: { status: "APROVADA", decisorId: dados.preparadorId, decididaEm: new Date(), motivoDecisao: "Conferido" } })).rejects.toThrow();
  await expect(prisma.condicoesEncerramentoMatricula.update({ where: { id: c.id }, data: { status: "APROVADA", decisorId, decididaEm: new Date() } })).rejects.toThrow();
  expect((await prisma.condicoesEncerramentoMatricula.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PENDENTE");
});
it("preserva versões e documento de origem sem substituir a anterior", async () => {
  const primeira = await prisma.condicoesEncerramentoMatricula.create({ data: dados });
  await prisma.condicoesEncerramentoMatricula.update({ where: { id: primeira.id }, data: { status: "APROVADA", decisorId, decididaEm: new Date(), motivoDecisao: "Conferência independente" } });
  await expect(prisma.condicoesEncerramentoMatricula.create({ data: dados })).rejects.toThrow();
  await prisma.condicoesEncerramentoMatricula.create({ data: { ...dados, versao: 2 } });
  await expect(prisma.documento.delete({ where: { id: dados.documentoId } })).rejects.toThrow();
  expect(await prisma.condicoesEncerramentoMatricula.count({ where: { matriculaId: dados.matriculaId } })).toBe(2);
});

it("contexto financeiro respeita matrícula, papel e versão vigente, sem usar revisão pendente", async () => {
  const m = await prisma.matricula.update({ where: { id: dados.matriculaId }, data: {
    status: "ATIVA", contratoOk: true, contratoDocumentoId: dados.documentoId,
    confirmacaoContratoEm: new Date(), confirmacaoContratoPorId: dados.preparadorId,
  } });
  const input = { alunoId: m.alunoId, matriculaId: m.id };
  authMock.mockResolvedValue({ user: { id: dados.preparadorId } });
  expect((await consultarContextoEncerramento(input)).ok).toBe(false);
  authMock.mockResolvedValue({ user: { id: decisorId } });
  expect((await consultarContextoEncerramento({ ...input, alunoId: "outro-aluno" })).ok).toBe(false);
  const regras = { diaEncerramento: "EXCLUIR", metodoDesconto: "DEPOIS_DO_PROPORCIONAL", condicoesDescontos: "Somente desconto vigente", multa: { tipo: "SEM_PREVISAO", motivo: "Sem previsão no contrato" } };
  const v = await prisma.condicoesEncerramentoMatricula.create({ data: { ...dados, regras, status: "APROVADA", decisorId, decididaEm: new Date(), motivoDecisao: "Conferido contrato" } });
  await prisma.cobranca.create({ data: { matriculaId: m.id, tipo: "MENSALIDADE", valorOriginal: 500, valorNegociado: 400, moeda: m.moeda, vencimento: new Date("2026-09-10") } });
  const r = await consultarContextoEncerramento(input);
  expect(r.ok).toBe(true); if (!r.ok) throw new Error(r.erro);
  expect(r.dado!.condicoes?.id).toBe(v.id);
  expect(r.dado!.cobrancas).toHaveLength(1);
  expect(r.dado!.cobrancas[0].conferencias).toContain("Cobertura ausente ou inválida.");
  expect(r.dado!.cobrancas[0].valorNegociado).toBe("400.00");
  await prisma.condicoesEncerramentoMatricula.create({ data: { ...dados, regras, versao: 2 } });
  const pendente = await consultarContextoEncerramento(input);
  expect(pendente.ok).toBe(true); if (!pendente.ok) throw new Error(pendente.erro);
  expect(pendente.dado!.condicoes).toBeNull();
  expect(pendente.dado!.pendencias).toContain("Há uma revisão das condições contratuais aguardando decisão.");
  expect((await prisma.cobranca.findFirstOrThrow({ where: { matriculaId: m.id } })).valorNegociado.toFixed(2)).toBe("400.00");
});
