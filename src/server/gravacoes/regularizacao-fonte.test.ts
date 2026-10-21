import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  transacao: vi.fn(), sessao: vi.fn(), usuario: vi.fn(), proposta: vi.fn(), material: vi.fn(), publicacao: vi.fn(),
  fixar: vi.fn(), consultar: vi.fn(), decisao: vi.fn(), fonte: vi.fn(), evento: vi.fn(), tx: {} as Record<string, unknown>,
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (...args: unknown[]) => m.transacao(...args) } }));
vi.mock("@/server/_shared", () => ({
  ErroPermissao: class ErroPermissao extends Error {}, ErroRegra: class ErroRegra extends Error {},
  executarAcao: async (fn: () => unknown) => fn(), exigirSessaoComPapel: m.sessao, registrarEvento: m.evento,
}));
vi.mock("./credenciais", () => ({ obterDriveOrganizacaoId: () => "drive", obterTokenDrive: vi.fn() }));
vi.mock("./credenciais-publicacao", () => ({ obterTokenPublicacaoDrive: vi.fn() }));
vi.mock("./drive-revisao", () => ({ fixarRevisaoDriveOrganizacional: m.fixar, consultarRevisaoDriveFixada: m.consultar }));

import { decidirRegularizacaoFonteGravacao, proporRegularizacaoFonteGravacao } from "./regularizacao-fonte";

const dados = { alvo: "MATERIAL_REPOSICAO" as const, alvoId: "material", arquivoOficialId: "arquivo", motivo: "Regularização com evidência suficiente", chaveIdempotencia: "chave-regularizacao-1" };
const dadosPublicacao = { alvo: "PUBLICACAO_AULA" as const, alvoId: "publicacao-legada", arquivoOficialId: "arquivo", motivo: "Regularização da publicação institucional legada", chaveIdempotencia: "chave-publicacao-legada" };
const proposta = {
  id: "proposta", alvo: "MATERIAL_REPOSICAO", publicacaoAulaId: null, materialReposicaoId: "material", decisao: null,
  arquivoOficialId: "arquivo", driveOrganizacaoId: "drive", driveRevisionId: "rev-1", driveRevisionMd5: "a".repeat(32), driveRevisionSize: 10n, mimeType: "video/mp4", motivo: dados.motivo, preparadorId: "outro",
};

beforeEach(() => {
  vi.resetAllMocks();
  m.transacao.mockImplementation(async (fn: (tx: object) => unknown) => fn(m.tx));
  m.sessao.mockResolvedValue({ id: "gestor" });
  m.usuario.mockResolvedValue({ ativo: true, papeis: ["GERENTE_PEDAGOGICO"] });
  m.material.mockResolvedValue({ id: "material" });
  m.tx.usuario = { findUnique: m.usuario };
  m.tx.$queryRaw = vi.fn();
  m.tx.$executeRaw = vi.fn();
  m.tx.materialReposicaoGravacao = { findUnique: m.material };
  m.tx.publicacaoGravacaoAula = { findUnique: m.publicacao };
  m.tx.propostaRegularizacaoFonteGravacao = { findUnique: m.proposta };
  m.tx.decisaoRegularizacaoFonteGravacao = { create: m.decisao };
  m.tx.fonteRevisaoGravacao = { count: vi.fn(), create: m.fonte };
});

it("rejeita repetição com payload divergente antes de novo I/O ao Drive", async () => {
  m.proposta.mockResolvedValue({ ...proposta, arquivoOficialId: "arquivo-anterior" });

  await expect(proporRegularizacaoFonteGravacao(dados)).rejects.toThrow(/chave já identifica outra/i);

  expect(m.fixar).not.toHaveBeenCalled();
});

it("não decide nem cria fonte quando a revisão fixa foi revogada antes da aprovação", async () => {
  m.proposta.mockResolvedValue(proposta);
  m.consultar.mockRejectedValue(new Error("Revisão removida do Drive"));

  await expect(decidirRegularizacaoFonteGravacao({ propostaId: "proposta", aprovar: true, motivo: "Aprovação deve falhar se a revisão não existir" })).rejects.toThrow("Revisão removida");

  expect(m.decisao).not.toHaveBeenCalled();
  expect(m.fonte).not.toHaveBeenCalled();
});

it("mantém o preparo de gestão para publicação legada sem carregar diário", async () => {
  m.publicacao.mockResolvedValue({ id: dadosPublicacao.alvoId });
  m.proposta.mockResolvedValue({ ...proposta, alvo: "PUBLICACAO_AULA", publicacaoAulaId: dadosPublicacao.alvoId, materialReposicaoId: null,
    arquivoOficialId: dadosPublicacao.arquivoOficialId, motivo: dadosPublicacao.motivo, chaveIdempotencia: dadosPublicacao.chaveIdempotencia });

  await expect(proporRegularizacaoFonteGravacao(dadosPublicacao)).resolves.toEqual({ id: "proposta" });

  expect(m.publicacao).toHaveBeenCalledWith({ where: { id: dadosPublicacao.alvoId }, select: { id: true } });
  expect(m.fixar).not.toHaveBeenCalled();
});

// Revisão R1 do #208 (C3): o preparo roda em SERIALIZABLE com o lock do calendário; o
// perdedor concorrente recebe 40001/P2034 e deve ser repetido até cair no replay da chave.
const erroPrisma = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("falha", { code, clientVersion: "5.22.0", meta });

it("repete o preparo após P2034 e devolve o replay da chave, sem fixar o Drive de novo", async () => {
  const criar = vi.fn();
  m.tx.propostaRegularizacaoFonteGravacao = { findUnique: m.proposta, create: criar };
  m.publicacao.mockResolvedValue({ id: dadosPublicacao.alvoId });
  m.fixar.mockResolvedValue({ fileId: "arquivo", driveId: "drive", revisionId: "rev-1", md5Checksum: "a".repeat(32), size: "10", mimeType: "video/mp4" });
  const repetida = { ...proposta, alvo: "PUBLICACAO_AULA", publicacaoAulaId: dadosPublicacao.alvoId, materialReposicaoId: null,
    arquivoOficialId: dadosPublicacao.arquivoOficialId, motivo: dadosPublicacao.motivo };
  // Pré-conferência sem proposta; a concorrente vence e grava; a repetição a encontra.
  m.proposta.mockResolvedValueOnce(null).mockResolvedValueOnce(repetida);
  m.transacao
    .mockImplementationOnce(async (fn: (tx: object) => unknown) => fn(m.tx))
    .mockRejectedValueOnce(erroPrisma("P2034"));

  await expect(proporRegularizacaoFonteGravacao(dadosPublicacao)).resolves.toEqual({ id: "proposta" });

  expect(m.fixar).toHaveBeenCalledTimes(1);
  expect(m.transacao).toHaveBeenCalledTimes(3);
  expect(m.transacao.mock.calls[1][1]).toMatchObject({ isolationLevel: "Serializable" });
  expect(m.transacao.mock.calls[2][1]).toMatchObject({ isolationLevel: "Serializable" });
  expect(criar).not.toHaveBeenCalled();
});

it("repete o preparo após 40001 (P2010) e recalcula a versão esperada com o estado confirmado", async () => {
  const criar = vi.fn().mockResolvedValue({ id: "proposta-nova" });
  const contar = vi.fn().mockResolvedValue(1);
  m.tx.propostaRegularizacaoFonteGravacao = { findUnique: m.proposta, create: criar };
  m.tx.fonteRevisaoGravacao = { count: contar, create: m.fonte };
  m.fixar.mockResolvedValue({ fileId: "arquivo", driveId: "drive", revisionId: "rev-1", md5Checksum: "a".repeat(32), size: "10", mimeType: "video/mp4" });
  m.proposta.mockResolvedValue(null);
  m.transacao
    .mockImplementationOnce(async (fn: (tx: object) => unknown) => fn(m.tx))
    .mockRejectedValueOnce(erroPrisma("P2010", { code: "40001" }));

  await expect(proporRegularizacaoFonteGravacao(dados)).resolves.toEqual({ id: "proposta-nova" });

  expect(m.fixar).toHaveBeenCalledTimes(1);
  expect(m.transacao).toHaveBeenCalledTimes(3);
  expect(criar).toHaveBeenCalledTimes(1);
  expect(criar.mock.calls[0][0]).toMatchObject({ data: { versaoEsperada: 1, chaveIdempotencia: dados.chaveIdempotencia } });
});

// Revisão R1 do #209 (C1): a decisão concorrente perdedora recebe 40001/P2034. A nova
// tentativa enxerga a decisão já confirmada e devolve o ErroRegra claro, não "Erro inesperado".
it.each([
  ["P2034", erroPrisma("P2034")],
  ["40001 (P2010)", erroPrisma("P2010", { code: "40001" })],
])("repete a decisão após %s e devolve a mensagem de proposta indisponível", async (_nome, conflito) => {
  m.consultar.mockResolvedValue(undefined);
  // Preflight vê a proposta aberta; a repetição a encontra já decidida pela concorrente.
  m.proposta.mockResolvedValueOnce(proposta).mockResolvedValueOnce({ ...proposta, decisao: { id: "decisao-concorrente" } });
  m.transacao
    .mockImplementationOnce(async (fn: (tx: object) => unknown) => fn(m.tx))
    .mockRejectedValueOnce(conflito);

  await expect(decidirRegularizacaoFonteGravacao({ propostaId: "proposta", aprovar: true, motivo: "Aprovação concorrente perdedora" }))
    .rejects.toThrow("A proposta de regularização não está disponível.");

  expect(m.consultar).toHaveBeenCalledTimes(1);
  expect(m.transacao).toHaveBeenCalledTimes(3);
  expect(m.transacao.mock.calls[1][1]).toMatchObject({ isolationLevel: "Serializable" });
  expect(m.transacao.mock.calls[2][1]).toMatchObject({ isolationLevel: "Serializable" });
  expect(m.decisao).not.toHaveBeenCalled();
});

it("não repete a decisão quando a falha não é de serialização", async () => {
  m.consultar.mockResolvedValue(undefined);
  m.proposta.mockResolvedValue(proposta);
  m.transacao
    .mockImplementationOnce(async (fn: (tx: object) => unknown) => fn(m.tx))
    .mockRejectedValueOnce(erroPrisma("P2002"));

  await expect(decidirRegularizacaoFonteGravacao({ propostaId: "proposta", aprovar: false, motivo: "Rejeição com falha qualquer" }))
    .rejects.toMatchObject({ code: "P2002" });

  expect(m.transacao).toHaveBeenCalledTimes(2);
});
