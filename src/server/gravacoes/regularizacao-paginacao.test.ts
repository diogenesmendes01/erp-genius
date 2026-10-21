import { expect, it, vi } from "vitest";

type Item = { id: string } & Record<string, unknown>;
const estado = vi.hoisted(() => ({ publicacoes: [] as Item[], materiais: [] as Item[], propostas: [] as Item[], chamadas: [] as { orderBy?: unknown; skip?: number; take?: number }[] }));
// Como o Prisma: os itens já vêm na ordem de id; aplica skip/take e guarda os argumentos para conferir a ordem.
const pagina = (itens: Item[], args: { orderBy?: unknown; skip?: number; take?: number }) => {
  estado.chamadas.push(args);
  const inicio = args.skip ?? 0;
  return itens.slice(inicio, inicio + (args.take ?? itens.length));
};
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({
  $queryRaw: vi.fn().mockResolvedValue([{ id: "admin" }]),
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

const ids = (r: Awaited<ReturnType<typeof consultarRegularizacoesFonteGravacao>>) => ({ p: r.publicacoes.map((x) => x.id), m: r.materiais.map((x) => x.id), q: r.propostas.map((x) => x.id) });

async function percorrer() {
  const vistos = { p: [] as string[], m: [] as string[], q: [] as string[] }, paginas: ReturnType<typeof ids>[] = [];
  for (let numero = 1; ; numero++) {
    const resultado = await consultarRegularizacoesFonteGravacao(numero > 1 ? { pagina: numero } : {});
    expect(resultado.pagina).toBe(numero);
    const lidos = ids(resultado);
    paginas.push(lidos);
    vistos.p.push(...lidos.p); vistos.m.push(...lidos.m); vistos.q.push(...lidos.q);
    if (!resultado.temProxima) break;
  }
  return { vistos, paginas };
}

it.each([[0, 25], [3, 25], [25, 3], [25, 0]])("pagina alvos assimétricos %i/%i sem omitir ou repetir e percorre mais de 50 propostas", async (quantidadePublicacoes, quantidadeMateriais) => {
  estado.publicacoes = Array.from({ length: quantidadePublicacoes }, (_, i) => publicacao(`p${String(i).padStart(2, "0")}`));
  estado.materiais = Array.from({ length: quantidadeMateriais }, (_, i) => material(`m${String(i).padStart(2, "0")}`));
  estado.propostas = Array.from({ length: 51 }, (_, i) => proposta(`q${String(i).padStart(2, "0")}`));
  const { vistos, paginas } = await percorrer();
  expect(vistos.p).toEqual(estado.publicacoes.map((x) => x.id));
  expect(vistos.m).toEqual(estado.materiais.map((x) => x.id));
  expect(vistos.q).toEqual(estado.propostas.map((x) => x.id));
  expect(new Set(vistos.q).size).toBe(51);
  // 51 propostas, 20 por página: três páginas, a última sem próxima.
  expect(paginas).toHaveLength(3);
  // Volta: a segunda e a primeira página, lidas de novo, trazem os mesmos itens.
  expect(ids(await consultarRegularizacoesFonteGravacao({ pagina: 2 }))).toEqual(paginas[1]);
  expect(ids(await consultarRegularizacoesFonteGravacao({}))).toEqual(paginas[0]);
  // Ordem estável: as três listas são lidas por id.
  expect(estado.chamadas.every((args) => JSON.stringify(args.orderBy) === JSON.stringify({ id: "asc" }))).toBe(true);
});
