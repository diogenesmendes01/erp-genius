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
import { prepararLoteMigracao } from "./acoes";
import {
  ensaiarVinculoMigracao,
  revisarCorrespondenciaProdutoMigracao,
  revisarCorrespondenciaStatusMatriculaMigracao,
  revisarCorrespondenciaTurmaMigracao,
} from "./ensaio-vinculo";
import { aplicarVinculoMigracao } from "./aplicar-vinculo";

let adminId = "";
beforeEach(async () => {
  await truncarBanco();
  adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin migração")).id;
  authMock.mockResolvedValue({ user: { id: adminId } });
});

it("aplica vínculo histórico ATIVA sem criar efeitos comerciais e repete a mesma aplicação", async () => {
  const catalogo = await seedCatalogoMinimo();
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, codigo: "MIG-T1" } });
  const preparado = await prepararLoteMigracao({
    origem: "PLANILHA", chaveLote: "ativa-replay",
    linhas: [{
      linhaOrigem: "vinculos!2", tipoEntrada: "VINCULO_MATRICULA",
      aluno: { id: "a-1", nome: "Ana Lima", email: "ana@example.test", documento: "DOC-1", pais: "CR", fuso: "America/Costa_Rica" },
      turma: { id: "t-1", codigo: "T1" },
      matricula: { id: "m-1", produtoOrigem: "p-1", situacao: "ATIVA", inicio: "2025-01-01", moeda: "CRC", pais: "CR" },
      alocacao: { inicio: "2025-01-01" }, consentimentoOrigem: "fonte",
    }],
  });
  expect(preparado).toMatchObject({ ok: true });
  if (!preparado.ok || !preparado.dado) throw new Error("Lote não preparado.");
  const linha = await prisma.linhaPreparacaoMigracao.findFirstOrThrow({ where: { loteId: preparado.dado.loteId } });
  const aluno = await prisma.aluno.create({ data: {
    primeiroNome: "Ana", email: "ana@example.test", documento: "DOC-1", paisId: catalogo.pais.id,
    fuso: "America/Costa_Rica", whatsapp: false, aceitaComunicacoes: false,
  } });
  await prisma.mapaOrigemAlunoMigracao.create({ data: { id: "mapa-a", origem: "PLANILHA", alunoOrigemId: "a-1", alunoId: aluno.id } });
  await revisarCorrespondenciaProdutoMigracao({
    origem: "PLANILHA", produtoOrigemId: "p-1", produtoId: catalogo.produto.id,
    paisId: catalogo.pais.id, moeda: "CRC", ativa: true,
  });
  await revisarCorrespondenciaTurmaMigracao({ origem: "PLANILHA", turmaOrigemId: "t-1", turmaId: turma.id, ativa: true });
  await revisarCorrespondenciaStatusMatriculaMigracao({ origem: "PLANILHA", statusOrigem: "ATIVA", statusDestino: "ATIVA", ativa: true });
  const ensaio = await ensaiarVinculoMigracao({ linhaId: linha.id });
  expect(ensaio).toMatchObject({ ok: true, dado: { resultado: "PRONTO_PARA_REVISAO" } });
  const e = await prisma.ensaioVinculoMigracao.findFirstOrThrow({ where: { linhaId: linha.id }, orderBy: { criadoEm: "desc" } });
  const input = {
    linhaId: linha.id, ensaioId: e.id, entradaHash: linha.entradaHash, contextoHash: e.contextoHash,
    fusoReferencia: "America/Costa_Rica" as const, semanticaFim: "LIMITE_EXCLUSIVO" as const,
    inicioAlocacao: "2025-01-01", fimAlocacao: null, diaVencimento: 10, mesesPlano: 9,
    evidenciaContrato: { referencia: "contrato legado" }, evidenciaPagamento: { referencia: "pagamento não confirmado" },
    fatos: [{ tipo: "ATIVACAO" as const, data: "2025-01-01", evidencia: { referencia: "estado ativo" } }],
  };
  const primeira = await aplicarVinculoMigracao(input);
  expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
  const segunda = await aplicarVinculoMigracao(input);
  expect(segunda).toMatchObject({ ok: true, dado: { repetida: true } });
  if (!primeira.ok || !primeira.dado || !segunda.ok || !segunda.dado) throw new Error("Aplicação falhou.");
  expect(segunda.dado).toMatchObject({ id: primeira.dado.id, matriculaId: primeira.dado.matriculaId, alocacaoId: primeira.dado.alocacaoId });
  expect(await prisma.matricula.count()).toBe(1);
  expect(await prisma.alocacaoTurma.count()).toBe(1);
  expect(await prisma.aplicacaoVinculoMigracao.count()).toBe(1);
  expect(await prisma.matricula.findUniqueOrThrow({ where: { id: primeira.dado.matriculaId } })).toMatchObject({
    status: "ATIVA", contratoOk: false, pagamentoTaxaOk: false, primeiraMensalidadeOk: false, ativadaEm: null,
  });
  expect(await prisma.cobranca.count()).toBe(0);
});
