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
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { prepararLoteMigracao } from "@/server/migracao/acoes";
import { ensaiarVinculoMigracao, revisarCorrespondenciaProdutoMigracao, revisarCorrespondenciaStatusMatriculaMigracao, revisarCorrespondenciaTurmaMigracao } from "@/server/migracao/ensaio-vinculo";
import { aplicarVinculoMigracao } from "@/server/migracao/aplicar-vinculo";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { salvarLancamentoTx } from "./lancamento-tx";
import { decidirConferenciaRegraHistorica, proporConferenciaRegraHistorica, revisarConferenciaRegraHistorica } from "./conferencia-regra-historica";

beforeEach(async () => {
  await truncarBanco();
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin migração");
  authMock.mockResolvedValue({ user: { id: admin.id } });
});

it("aceita lançamento histórico de vínculo aplicado pela trilha M01", async () => {
  const catalogo = await seedCatalogoMinimo();
  const admin = await prisma.usuario.findFirstOrThrow({ where: { papeis: { has: Papel.ADMINISTRADOR } } });
  const aprovador = await criarUsuario([Papel.ADMINISTRADOR], "Aprovador independente");
  const professor = await criarUsuario([Papel.PROFESSOR], "Professor histórico");
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "M01-AV", ordem: 1 } });
  const regraPreparada = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, admin.id, {
    nivelId: nivel.id, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(), motivo: "Regra para lançamento histórico", chaveIdempotencia: "m01-regra-historica",
  }));
  const regra = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regraPreparada.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, aprovador.id, { regraId: regra.id, conteudoHash: regra.conteudoHash, aprovada: true, motivo: "Publicação independente da regra histórica" }));
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor.id, status: "EM_ANDAMENTO", vinculosDocentes: { create: { professorId: professor.id, inicio: new Date("2025-01-01T00:00:00Z") } } } });
  const revisao = await revisarConferenciaRegraHistorica({ turmaId: turma.id, destinoId: regra.id });
  expect(revisao.ok, revisao.ok ? undefined : revisao.erro).toBe(true);
  if (!revisao.ok || !revisao.dado) throw new Error("Revisão histórica ausente.");
  const proposta = await proporConferenciaRegraHistorica({ turmaId: turma.id, destinoId: regra.id, estadoHash: revisao.dado.estadoHash, versaoEsperada: revisao.dado.versaoEsperada, motivo: "Conferir critérios da turma importada", evidencia: "Ata pedagógica preservada confirma a versão institucional", chaveIdempotencia: "m01-conferencia-regra-historica" });
  expect(proposta.ok, proposta.ok ? undefined : proposta.erro).toBe(true);
  if (!proposta.ok || !proposta.dado) throw new Error("Proposta histórica ausente.");
  authMock.mockResolvedValue({ user: { id: aprovador.id } });
  const decisaoHistorica = await decidirConferenciaRegraHistorica({ propostaId: proposta.dado.id, estadoHash: revisao.dado.estadoHash, aprovada: true, motivo: "Conferência independente do legado" });
  expect(decisaoHistorica.ok, decisaoHistorica.ok ? undefined : decisaoHistorica.erro).toBe(true);
  authMock.mockResolvedValue({ user: { id: admin.id } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Ana", sobrenome: "Histórica", email: "ana.historica@example.test", documento: "M01-AV", paisId: catalogo.pais.id, fuso: "America/Costa_Rica", aceitaComunicacoes: false } });
  const preparado = await prepararLoteMigracao({ origem: "PLANILHA", chaveLote: "m01-lancamento-historico", linhas: [{
    linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA", aluno: { id: "aluno-1", nome: "Ana Histórica", email: aluno.email!, documento: "M01-AV", pais: "CR", fuso: "America/Costa_Rica" },
    turma: { id: "turma-1", codigo: "M01-AV" }, matricula: { id: "matricula-1", produtoOrigem: "produto-1", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" }, alocacao: { inicio: "2025-01-01" }, consentimentoOrigem: "fonte",
  }] });
  if (!preparado.ok || !preparado.dado) throw new Error("Preparação M01 falhou.");
  const linha = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: preparado.dado.loteId } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { origem: "PLANILHA", alunoOrigemId: "aluno-1", alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({ origem: "PLANILHA", produtoOrigemId: "produto-1", produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", ativa: true });
  await revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "turma-1", turmaId: turma.id, ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const ensaio = await ensaiarVinculoMigracao({ linhaId: linha.id });
  if (!ensaio.ok || !ensaio.dado || ensaio.dado.resultado !== "PRONTO_PARA_REVISAO") throw new Error("Ensaio M01 não ficou pronto.");
  const contextoHash = (await prisma.ensaioVinculoMigracao.findUniqueOrThrow({ where: { id: ensaio.dado.id } })).contextoHash;
  const aplicada = await aplicarVinculoMigracao({ linhaId: linha.id, ensaioId: ensaio.dado.id, entradaHash: linha.entradaHash, contextoHash, fusoReferencia: "America/Costa_Rica", semanticaFim: "LIMITE_EXCLUSIVO", inicioAlocacao: "2025-01-01", fimAlocacao: null, diaVencimento: 10, mesesPlano: 9, evidenciaContrato: { arquivo: "contrato" }, evidenciaPagamento: { arquivo: "pagamento" }, fatos: [{ tipo: "ATIVACAO", data: "2025-01-01", evidencia: { etapa: "ativacao" } }] });
  expect(aplicada.ok, aplicada.ok ? undefined : aplicada.erro).toBe(true);
  if (!aplicada.ok || !aplicada.dado) throw new Error("Aplicação M01 ausente.");
  const alocacaoHistoricaId = aplicada.dado.alocacaoId;
  const regraDaTurma = await prisma.turma.findUniqueOrThrow({ where: { id: turma.id }, select: { regraAvaliacaoId: true } });
  expect(regraDaTurma.regraAvaliacaoId).toBe(regra.id);
  const conteudo = regraAvaliacaoTeste();
  const habilidade = conteudo.avaliacoes.find(avaliacao => avaliacao.codigo === "I1")!.habilidades[0]!;
  await expect(prisma.$transaction(tx => salvarLancamentoTx(tx, professor.id, { alocacaoId: alocacaoHistoricaId, codigoAvaliacao: "I1", realizadaEm: "2025-01-15T12:00:00.000Z", notas: [{ habilidade, nota: "8", comentarioAluno: "Registro histórico conferido" }], submetida: true, versaoEsperada: 0, chaveIdempotencia: "m01-lancamento-historico" }))).resolves.toMatchObject({ versao: 1 });
});
