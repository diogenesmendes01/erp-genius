import { beforeEach, expect, it, vi } from "vitest";
import { Papel, Prisma } from "@prisma/client";

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
import { carregarHistoricosContratuais } from "@/server/diario/historico-contratual";
import { situacaoMatriculaNaAula } from "@/server/matricula/historico-situacao";
import { solicitarPausaMatriculas, decidirPropostaPausaMatriculas } from "@/server/matricula/pausa-proposta";
import { aplicarPausaMatriculasTx } from "@/server/matricula/pausa-execucao";
import { solicitarRetomadaMatriculas, decidirRetomadaMatriculas } from "@/server/matricula/retomada-proposta";
import { aplicarRetomadaMatriculasTx } from "@/server/matricula/retomada-execucao";

let administrador: string;
let financeiro: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  await truncarBanco();
  administrador = (await criarUsuario([Papel.ADMINISTRADOR], "Admin paridade SQL migrada")).id;
  financeiro = (await criarUsuario([Papel.FINANCEIRO], "Financeiro paridade SQL migrada")).id;
  entrar(administrador);
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Costa_Rica" } });
});

async function situacaoSqlEmFuso(matriculaId: string, instante: Date, fusoSessao: "UTC" | "America/Sao_Paulo") {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT set_config('TimeZone', ${fusoSessao}, true)`;
    const linhas = await tx.$queryRaw<{ situacao: string }[]>(
      Prisma.sql`SELECT situacao_matricula_no_instante(
        ${matriculaId},
        (${instante.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      ) AS situacao`
    );
    if (linhas.length !== 1) throw new Error("Consulta SQL de situação não retornou uma linha.");
    return linhas[0]!.situacao;
  });
}

it("função SQL mantém paridade com o histórico TS migrado e operações posteriores em dois fusos de sessão", async () => {
  const catalogo = await seedCatalogoMinimo();
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, codigo: "M01-186-PARIDADE" } });
  const preparado = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: "m01-186-paridade", linhas: [{
    linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA",
    aluno: { id: "a-1", nome: "Ana Lima", email: "ana@example.test", documento: "DOC-1", pais: "CR", fuso: "America/Costa_Rica" },
    turma: { id: "t-1", codigo: "A" },
    matricula: { id: "m-1", produtoOrigem: "p-1", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
    alocacao: { inicio: "2025-01-01", fim: null }, consentimentoOrigem: "fonte",
  }] });
  if (!preparado.ok || !preparado.dado) throw new Error("Preparação falhou.");
  const linha = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: preparado.dado.loteId } });
  const aluno = await prisma.aluno.create({ data: {
    primeiroNome: "Ana", sobrenome: "Lima", email: "ana@example.test", documento: "DOC-1",
    paisId: catalogo.pais.id, fuso: "America/Costa_Rica", whatsapp: false, aceitaComunicacoes: false,
  } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { origem: "PLANILHA", alunoOrigemId: "a-1", alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({ origem: "PLANILHA", produtoOrigemId: "p-1", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true });
  await revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "t-1", turmaId: turma.id, ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const ensaio = await ensaiarVinculoMigracao({ linhaId: linha.id });
  if (!ensaio.ok || !ensaio.dado) throw new Error("Ensaio falhou.");
  const atual = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linha.id }, orderBy: { criadoEm: "desc" } });
  const aplicada = await aplicarVinculoMigracao({
    linhaId: linha.id, ensaioId: atual.id, entradaHash: linha.entradaHash, contextoHash: atual.contextoHash,
    fusoReferencia: "America/Costa_Rica", semanticaFim: "LIMITE_EXCLUSIVO",
    inicioAlocacao: "2025-01-01", fimAlocacao: null, diaVencimento: 10, mesesPlano: 9,
    evidenciaContrato: { arquivo: "contrato" }, evidenciaPagamento: { arquivo: "pagamento" },
    fatos: [
      { tipo: "ATIVACAO", data: "2025-01-01", evidencia: { etapa: "ativacao" } },
      { tipo: "PAUSA", data: "2025-02-01", evidencia: { etapa: "pausa" } },
      { tipo: "ATIVACAO", data: "2025-03-01", evidencia: { etapa: "retomada" } },
    ],
  });
  expect(aplicada.ok, aplicada.ok ? undefined : aplicada.erro).toBe(true);
  if (!aplicada.ok || !aplicada.dado) throw new Error("Aplicação migrada ausente.");
  const matriculaId = aplicada.dado.matriculaId;
  await prisma.matricula.update({ where: { id: matriculaId }, data: { referenciaCobertura: "MES_CIVIL" } });

  entrar(administrador);
  const pausa = await solicitarPausaMatriculas(aluno.id, {
    matriculaIds: [matriculaId], dataEfetiva: "2025-04-01", motivo: "Pausa operacional posterior à importação", chaveIdempotencia: "m01-186-pausa",
  });
  if (!pausa.ok || !pausa.dado) throw new Error("Pausa não preparada.");
  entrar(financeiro);
  expect(await decidirPropostaPausaMatriculas(pausa.dado.propostaId, { aprovar: true, motivo: "Pausa conferida independentemente" })).toMatchObject({ ok: true });
  await prisma.$transaction(tx => aplicarPausaMatriculasTx(tx, pausa.dado!.propostaId, administrador, new Date("2025-04-01T12:00:00Z")));

  entrar(administrador);
  const retomada = await solicitarRetomadaMatriculas(aluno.id, {
    retorno: "2025-05-01", motivo: "Retomada operacional posterior à pausa", chaveIdempotencia: "m01-186-retomada",
    matriculas: [{ matriculaId, vencimentos: { opcao: "MANTER_VENCIMENTOS" } }],
  });
  if (!retomada.ok || !retomada.dado) throw new Error("Retomada não preparada.");
  entrar(financeiro);
  expect(await decidirRetomadaMatriculas(retomada.dado.propostaId, { aprovar: true, motivo: "Retomada conferida independentemente" })).toMatchObject({ ok: true });
  await prisma.$transaction(tx => aplicarRetomadaMatriculasTx(tx, retomada.dado!.propostaId, administrador, new Date("2025-05-01T12:00:00Z")));

  const historico = (await carregarHistoricosContratuais(prisma, [matriculaId])).get(matriculaId);
  if (!historico) throw new Error("Histórico migrado ausente.");
  const casos = [
    ["antes da ativação", "2025-01-01T05:59:59.999Z", "NAO_ATIVADA"],
    ["na pausa importada", "2025-02-01T06:00:00.000Z", "PAUSADA"],
    ["na retomada importada", "2025-03-01T06:00:00.000Z", "ATIVA"],
    ["na pausa operacional", "2025-04-01T06:00:00.000Z", "PAUSADA"],
    ["na retomada operacional", "2025-05-01T06:00:00.000Z", "ATIVA"],
  ] as const;
  for (const [rotulo, iso, esperado] of casos) {
    const instante = new Date(iso);
    expect(situacaoMatriculaNaAula(historico, instante), `TS: ${rotulo}`).toBe(esperado);
    for (const fusoSessao of ["UTC", "America/Sao_Paulo"] as const)
      expect(await situacaoSqlEmFuso(matriculaId, instante, fusoSessao), `${rotulo} em ${fusoSessao}`).toBe(esperado);
  }
});
