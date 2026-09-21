import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sessao: vi.fn(), usuario: vi.fn(), proposta: vi.fn(), material: vi.fn(), publicacao: vi.fn(),
  fixar: vi.fn(), consultar: vi.fn(), decisao: vi.fn(), fonte: vi.fn(), evento: vi.fn(), tx: {} as Record<string, unknown>,
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: object) => unknown) => fn(m.tx) } }));
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
