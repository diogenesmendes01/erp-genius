import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const { prisma } = await import("@/lib/prisma");
  return {
    ...real,
    exigirSessao: async () => {
      const id = (await authMock())?.user?.id;
      const usuario = id && await prisma.usuario.findUnique({ where: { id } });
      if (!usuario?.ativo) throw new real.ErroAutenticacao();
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "./acoes";
import { aplicarCadastroPreparacaoMigracao } from "./aplicacao-cadastro";
import { consultarLotePreparacaoMigracao } from "./consultas";

let adminId = "";

beforeEach(async () => {
  await truncarBanco();
  adminId = (await criarUsuario([Papel.ADMINISTRADOR])).id;
  authMock.mockResolvedValue({ user: { id: adminId } });
  await prisma.pais.create({ data: { nome: "Brasil", codigoISO: "BR", moedaLocal: "BRL", ddi: "+55", status: "ATIVO" } });
});

it("revalida candidato criado depois do ensaio sem criar mapa ou outro cadastro", async () => {
  const preparo = await prepararLoteMigracao({
    origem: "FONTE",
    chaveLote: "candidato-pos-ensaio",
    linhas: [{
      linhaOrigem: "alunos!2",
      tipoEntrada: "CADASTRO",
      aluno: { id: "origem-ana", nome: "Ana Lima", email: "ana@example.test", documento: "000123", pais: "BR", fuso: "America/Sao_Paulo" },
    }],
  });
  expect(preparo.ok && preparo.dado).toBeTruthy();
  if (!preparo.ok || !preparo.dado) throw new Error("preparo não retornou lote");

  const ensaio = await aplicarCadastroPreparacaoMigracao({ loteId: preparo.dado.loteId, modo: "ENSAIO" });
  expect(ensaio).toMatchObject({ ok: true, dado: { ensaiadas: 1, bloqueadas: 0, confirmacaoHash: expect.any(String) } });
  const confirmacaoHash = ensaio.ok ? ensaio.dado?.confirmacaoHash : null;
  expect(confirmacaoHash).toEqual(expect.any(String));

  await prisma.aluno.create({ data: { primeiroNome: "Concorrente", email: "ana@example.test", paisId: (await prisma.pais.findFirstOrThrow()).id } });

  const aplicacao = await aplicarCadastroPreparacaoMigracao({ loteId: preparo.dado.loteId, modo: "APLICAR", confirmacaoHash: confirmacaoHash! });
  expect(aplicacao).toMatchObject({ ok: true, dado: { aplicadas: 0, bloqueadas: 1 } });
  expect(await prisma.aluno.count()).toBe(1);
  expect(await prisma.mapaOrigemAlunoMigracao.count()).toBe(0);
  expect(await prisma.aplicacaoCadastroMigracao.findMany({ where: { situacao: "BLOQUEADO" } })).toHaveLength(1);
});

it("mantém a evidência aplicada na consulta do lote depois de recarregar a página", async () => {
  const preparo = await prepararLoteMigracao({
    origem: "FONTE",
    chaveLote: "evidencia-pos-reload",
    linhas: [{
      linhaOrigem: "alunos!2",
      tipoEntrada: "CADASTRO",
      aluno: { id: "origem-ana", nome: "Ana Lima", email: "ana@example.test", documento: "000123", pais: "BR", fuso: "America/Sao_Paulo" },
    }],
  });
  if (!preparo.ok || !preparo.dado) throw new Error("preparo não retornou lote");
  const ensaio = await aplicarCadastroPreparacaoMigracao({ loteId: preparo.dado.loteId, modo: "ENSAIO" });
  const confirmacaoHash = ensaio.ok ? ensaio.dado?.confirmacaoHash : null;
  expect(confirmacaoHash).toEqual(expect.any(String));
  await aplicarCadastroPreparacaoMigracao({ loteId: preparo.dado.loteId, modo: "APLICAR", confirmacaoHash: confirmacaoHash! });

  const consulta = await consultarLotePreparacaoMigracao(preparo.dado.loteId);
  expect(consulta.ok && consulta.dado).toBeTruthy();
  const linha = (consulta.ok && consulta.dado ? consulta.dado.linhas[0] : null) as unknown as {
    aplicacoesCadastro?: { situacao: string; alunoId: string | null; detalhe: string | null; executadoPor: { nome: string | null } }[];
  } | null;
  expect(linha?.aplicacoesCadastro).toEqual(expect.arrayContaining([
    expect.objectContaining({ situacao: "ENSAIO_VALIDO", alunoId: null, executadoPor: { nome: expect.any(String) } }),
    expect.objectContaining({ situacao: "APLICADO", alunoId: expect.any(String), executadoPor: { nome: expect.any(String) } }),
  ]));
});
