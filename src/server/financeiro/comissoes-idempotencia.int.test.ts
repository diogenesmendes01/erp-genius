import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166, 5º lote: comissões (dinheiro).
// - Fechar o mês com chave: o reenvio da mesma tentativa devolve quantas foram pagas e não paga as comissões
//   aprovadas depois da tentativa (antes, o reenvio pagava tudo o que estivesse aprovado no momento).
// - Estornar: o mesmo estorno, do mesmo autor e com o mesmo motivo, devolve ok sem outro Evento (antes, erro).

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Só a sessão é trocada (os papéis continuam lidos do banco): o `auth` real importa o next-auth na primeira chamada,
// o que falha quando duas chamadas simultâneas chegam juntas.
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const usuario = await original.carregarUsuarioFresco((await authMock())?.user?.id ?? "");
    if (!usuario) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { fecharMesComissoes } from "./acoes";
import { estornarComissao } from "@/server/crm/comissoes-estorno";

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
let finId: string, fin2Id: string, vendedorId: string;
let cat: Awaited<ReturnType<typeof seedCatalogoMinimo>>;
let seq = 0;

async function comissao(status: "PENDENTE" | "APROVADA") {
  seq += 1;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: `Aluno${seq}`, paisId: cat.pais.id } });
  const m = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "BRL", status: "ATIVA", mesesPlano: 2 } });
  return (await prisma.comissao.create({ data: { matriculaId: m.id, vendedorId, tipo: "PERCENTUAL", percentual: 10, valor: 25, moeda: "BRL", status } })).id;
}
const eventos = (tipo: string) => prisma.evento.count({ where: { tipo } });
const status = async (id: string) => (await prisma.comissao.findUniqueOrThrow({ where: { id } })).status;

beforeEach(async () => {
  await truncarBanco();
  seq = 0;
  cat = await seedCatalogoMinimo();
  finId = (await criarUsuario([Papel.FINANCEIRO], "Financeiro")).id;
  fin2Id = (await criarUsuario([Papel.FINANCEIRO], "Financeiro 2")).id;
  vendedorId = (await criarUsuario([Papel.VENDEDOR], "Vendedor")).id;
  entrar(finId);
});

describe("fechar o mês das comissões com chave (#166)", () => {
  it("o reenvio da mesma tentativa devolve o fechamento original e não paga a comissão aprovada depois", async () => {
    await comissao("APROVADA"); await comissao("APROVADA");
    const a = await fecharMesComissoes({ chaveIdempotencia: "chave-fechamento-01" });
    expect(a).toEqual({ ok: true, dado: { pagas: 2 } });
    const nova = await comissao("APROVADA");
    expect(await fecharMesComissoes({ chaveIdempotencia: "chave-fechamento-01" })).toEqual(a);
    expect(await status(nova)).toBe("APROVADA");
    expect(await eventos("ComissaoPaga")).toBe(2);
  });

  it("dois envios simultâneos da mesma tentativa pagam uma vez e devolvem o mesmo resultado", async () => {
    await comissao("APROVADA");
    const [a, b] = await Promise.all([fecharMesComissoes({ chaveIdempotencia: "chave-fechamento-02" }), fecharMesComissoes({ chaveIdempotencia: "chave-fechamento-02" })]);
    expect(a).toEqual({ ok: true, dado: { pagas: 1 } });
    expect(b).toEqual(a);
    expect(await eventos("ComissaoPaga")).toBe(1);
  });

  it("chave nova é outro fechamento; sem chave, o comportamento de antes", async () => {
    await comissao("APROVADA");
    await fecharMesComissoes({ chaveIdempotencia: "chave-fechamento-03" });
    const nova = await comissao("APROVADA");
    expect(await fecharMesComissoes({ chaveIdempotencia: "chave-fechamento-04" })).toEqual({ ok: true, dado: { pagas: 1 } });
    expect(await status(nova)).toBe("PAGA");
    expect(await fecharMesComissoes()).toEqual({ ok: false, erro: "Nenhuma comissão aprovada para pagar." });
  });

  it("a chave é do autor: outra pessoa com a mesma chave fecha o que estiver aprovado", async () => {
    await comissao("APROVADA");
    await fecharMesComissoes({ chaveIdempotencia: "chave-fechamento-05" });
    const nova = await comissao("APROVADA");
    entrar(fin2Id);
    expect(await fecharMesComissoes({ chaveIdempotencia: "chave-fechamento-05" })).toEqual({ ok: true, dado: { pagas: 1 } });
    expect(await status(nova)).toBe("PAGA");
  });
});

describe("estornar comissão repetido (#166)", () => {
  it("o mesmo estorno, inclusive simultâneo, devolve ok com um Evento", async () => {
    const id = await comissao("APROVADA");
    const entrada = { id, motivo: "ERRO_LANCAMENTO" as const };
    const [a, b] = await Promise.all([estornarComissao(entrada), estornarComissao(entrada)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await estornarComissao(entrada)).ok).toBe(true);
    expect(await status(id)).toBe("ESTORNADA");
    expect(await eventos("ComissaoEstornada")).toBe(1);
  });

  it("com outro motivo, ou de outra pessoa, continua recusado", async () => {
    const id = await comissao("PENDENTE");
    await estornarComissao({ id, motivo: "OUTRO", detalhe: "Venda registrada em duplicidade" });
    expect((await estornarComissao({ id, motivo: "OUTRO", detalhe: "Venda registrada em duplicidade" })).ok).toBe(true);
    expect(await estornarComissao({ id, motivo: "OUTRO", detalhe: "Outro detalhe" })).toEqual({ ok: false, erro: "Comissão já estornada." });
    expect(await estornarComissao({ id, motivo: "ERRO_LANCAMENTO" })).toEqual({ ok: false, erro: "Comissão já estornada." });
    entrar(fin2Id);
    expect(await estornarComissao({ id, motivo: "OUTRO", detalhe: "Venda registrada em duplicidade" })).toEqual({ ok: false, erro: "Comissão já estornada." });
    expect(await eventos("ComissaoEstornada")).toBe(1);
  });
});
