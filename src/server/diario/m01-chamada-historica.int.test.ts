import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async importOriginal => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const { prisma } = await import("@/lib/prisma");
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "@/server/migracao/acoes";
import { ensaiarVinculoMigracao, revisarCorrespondenciaProdutoMigracao, revisarCorrespondenciaStatusMatriculaMigracao, revisarCorrespondenciaTurmaMigracao } from "@/server/migracao/ensaio-vinculo";
import { aplicarVinculoMigracao } from "@/server/migracao/aplicar-vinculo";
import { carregarChamadaTx } from "./chamada-tx";

beforeEach(async () => {
  await truncarBanco();
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin migração");
  authMock.mockResolvedValue({ user: { id: admin.id } });
});

it("chamada usa a vigência migrada mesmo quando a importação ocorre depois da aula e respeita pausa histórica", async () => {
  const catalogo = await seedCatalogoMinimo();
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const [turmaA, turmaB] = await Promise.all([
    prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, codigo: "MIG-HIST-A" } }),
    prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, codigo: "MIG-HIST-B" } }),
  ]);
  const preparado = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: "chamada-historica", linhas: [
    { linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "a-1", nome: "Ana Lima", email: "ana@example.test", documento: "DOC-1", pais: "CR", fuso: "America/Costa_Rica" }, turma: { id: "t-a", codigo: "A" }, matricula: { id: "m-1", produtoOrigem: "p-1", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" }, alocacao: { inicio: "2025-01-01", fim: "2025-04-01" }, consentimentoOrigem: "fonte" },
    { linhaOrigem: "vinculos!3", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "a-1", nome: "Ana Lima", email: "ana@example.test", documento: "DOC-1", pais: "CR", fuso: "America/Costa_Rica" }, turma: { id: "t-b", codigo: "B" }, matricula: { id: "m-1", produtoOrigem: "p-1", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" }, alocacao: { inicio: "2025-04-01" }, consentimentoOrigem: "fonte" },
  ] });
  if (!preparado.ok || !preparado.dado) throw new Error("Preparação falhou.");
  const [linhaA, linhaB] = await prisma.linhaPreparacaoMigracao.findMany({ where: { loteId: preparado.dado.loteId }, orderBy: { linhaOrigem: "asc" } });
  if (!linhaA || !linhaB) throw new Error("Linhas ausentes.");
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", sobrenome: "Lima", email: "ana@example.test", documento: "DOC-1", paisId: catalogo.pais.id, fuso: "America/Costa_Rica", whatsapp: false, aceitaComunicacoes: false } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { origem: "PLANILHA", alunoOrigemId: "a-1", alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({ origem: "PLANILHA", produtoOrigemId: "p-1", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true });
  await Promise.all([
    revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "t-a", turmaId: turmaA.id, ativa: true }),
    revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "t-b", turmaId: turmaB.id, ativa: true }),
  ]);
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const [ensaioA, ensaioB] = await Promise.all([ensaiarVinculoMigracao({ linhaId: linhaA.id }), ensaiarVinculoMigracao({ linhaId: linhaB.id })]);
  if (!ensaioA.ok || !ensaioA.dado || !ensaioB.ok || !ensaioB.dado) throw new Error("Ensaio falhou.");
  const eA = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linhaA.id }, orderBy: { criadoEm: "desc" } });
  const eB = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linhaB.id }, orderBy: { criadoEm: "desc" } });
  const base = { fusoReferencia: "America/Costa_Rica" as const, semanticaFim: "LIMITE_EXCLUSIVO" as const, diaVencimento: 10, mesesPlano: 9, evidenciaContrato: { arquivo: "contrato" }, evidenciaPagamento: { arquivo: "pagamento" } };
  const fatos = [
    { tipo: "ATIVACAO" as const, data: "2025-01-01", evidencia: { etapa: "ativacao" } },
    { tipo: "PAUSA" as const, data: "2025-02-01", evidencia: { etapa: "pausa" } },
    { tipo: "ATIVACAO" as const, data: "2025-03-01", evidencia: { etapa: "retomada" } },
  ];
  const aplicadaA = await aplicarVinculoMigracao({ ...base, linhaId: linhaA.id, ensaioId: eA.id, entradaHash: linhaA.entradaHash, contextoHash: eA.contextoHash, inicioAlocacao: "2025-01-01", fimAlocacao: "2025-04-01", fatos });
  expect(aplicadaA.ok, aplicadaA.ok ? undefined : aplicadaA.erro).toBe(true);
  const aplicadaB = await aplicarVinculoMigracao({ ...base, linhaId: linhaB.id, ensaioId: eB.id, entradaHash: linhaB.entradaHash, contextoHash: eB.contextoHash, inicioAlocacao: "2025-04-01", fimAlocacao: null, fatos });
  expect(aplicadaB.ok, aplicadaB.ok ? undefined : aplicadaB.erro).toBe(true);
  // criadoEm é 2026; as leituras de 2025 devem usar inicio/fimVigencia da migração.
  const chamada = (turmaId: string, dia: string) => prisma.$transaction((tx) => carregarChamadaTx(tx, turmaId, new Date(`${dia}T12:00:00Z`)));
  expect(await chamada(turmaA.id, "2025-01-15")).toMatchObject({ alunos: [{ alunoId: aluno.id }], exigeConferencia: false });
  expect(await chamada(turmaA.id, "2025-02-15")).toMatchObject({ alunos: [], exigeConferencia: false });
  expect(await chamada(turmaA.id, "2025-04-01")).toMatchObject({ alunos: [] });
  expect(await chamada(turmaB.id, "2025-04-15")).toMatchObject({ alunos: [{ alunoId: aluno.id }], exigeConferencia: false });
});
