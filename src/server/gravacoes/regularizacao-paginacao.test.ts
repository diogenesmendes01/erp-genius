import { expect, it, vi } from "vitest";

type Item = { id: string } & Record<string, unknown>;
const estado = vi.hoisted(() => ({ publicacoes: [] as Item[], materiais: [] as Item[], propostas: [] as Item[] }));
const pagina = (itens: Item[], args: { cursor?: { id: string }; skip?: number; take?: number }) => {
  const inicio = args.cursor ? itens.findIndex((item) => item.id === args.cursor!.id) + (args.skip ?? 0) : 0;
  return itens.slice(inicio, inicio + (args.take ?? itens.length));
};
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({
  usuario: { findUnique: vi.fn().mockResolvedValue({ ativo: true, papeis: ["ADMINISTRADOR"] }) },
  publicacaoGravacaoAula: { findMany: (args: never) => Promise.resolve(pagina(estado.publicacoes, args)) },
  materialReposicaoGravacao: { findMany: (args: never) => Promise.resolve(pagina(estado.materiais, args)) },
  propostaRegularizacaoFonteGravacao: { findMany: (args: never) => Promise.resolve(pagina(estado.propostas, args)) },
}) } }));
vi.mock("@/server/_shared", () => ({ ErroPermissao: class ErroPermissao extends Error {}, ErroRegra: class ErroRegra extends Error {}, executarAcao: (f: () => unknown) => f(), exigirSessaoComPapel: vi.fn().mockResolvedValue({ id: "admin" }), registrarEvento: vi.fn() }));
vi.mock("./credenciais", () => ({ obterDriveOrganizacaoId: () => "drive", obterTokenDrive: vi.fn() }));
vi.mock("./credenciais-publicacao", () => ({ obterTokenPublicacaoDrive: vi.fn() }));
vi.mock("./drive-revisao", () => ({ consultarRevisaoDriveFixada: vi.fn(), fixarRevisaoDriveOrganizacional: vi.fn() }));
import { consultarRegularizacoesFonteGravacao } from "./regularizacao-fonte";

const publicacao = (id: string): Item => ({ id, encontroId: `enc-${id}`, arquivoOficialId: `arquivo-${id}`, criadaEm: new Date(), encontro: { inicio: new Date(), turma: { codigo: `T-${id}`, nome: null } }, fontesRevisao: [] });
const material = (id: string): Item => ({ id, reposicaoId: `rep-${id}`, arquivoOficialId: `arquivo-${id}`, publicadoEm: new Date(), reposicao: { matricula: { codigo: `M-${id}`, aluno: { primeiroNome: "Aluno", sobrenome: id } } }, fontesRevisao: [] });
const proposta = (id: string): Item => ({ id, preparadorId: "outro", alvo: "PUBLICACAO_AULA", publicacaoAulaId: `pub-${id}`, materialReposicaoId: null, arquivoOficialId: `arquivo-${id}`, driveRevisionId: `rev-${id}`, motivo: "Fonte conferida por pessoa autorizada", versaoEsperada: 0, criadaEm: new Date(), publicacaoAula: { encontro: { inicio: new Date(), turma: { codigo: `T-${id}`, nome: null } } }, materialReposicao: null, preparador: { nome: "Outra gestão" }, decisao: null });

async function percorrer() {
  const vistos = { p: [] as string[], m: [] as string[], q: [] as string[] }; let cursor: string | undefined;
  do { const pagina = await consultarRegularizacoesFonteGravacao(cursor ? { cursor } : {}); vistos.p.push(...pagina.publicacoes.map((x) => x.id)); vistos.m.push(...pagina.materiais.map((x) => x.id)); vistos.q.push(...pagina.propostas.map((x) => x.id)); cursor = pagina.proximoCursor ?? undefined; } while (cursor);
  return vistos;
}

it.each([[0, 25], [3, 25], [25, 3], [25, 0]])("pagina alvos assimétricos %i/%i sem omitir ou repetir e percorre mais de 50 propostas", async (quantidadePublicacoes, quantidadeMateriais) => {
  estado.publicacoes = Array.from({ length: quantidadePublicacoes }, (_, i) => publicacao(`p${String(i).padStart(2, "0")}`));
  estado.materiais = Array.from({ length: quantidadeMateriais }, (_, i) => material(`m${String(i).padStart(2, "0")}`));
  estado.propostas = Array.from({ length: 51 }, (_, i) => proposta(`q${String(i).padStart(2, "0")}`));
  const vistos = await percorrer();
  expect(vistos.p).toEqual(estado.publicacoes.map((x) => x.id));
  expect(vistos.m).toEqual(estado.materiais.map((x) => x.id));
  expect(vistos.q).toEqual(estado.propostas.map((x) => x.id));
  expect(new Set(vistos.q)).toHaveLength(51);
});